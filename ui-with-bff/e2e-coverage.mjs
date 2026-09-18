/**
 * Turns the raw V8 coverage the Playwright browser tests capture into a Cobertura report that
 * ReportGenerator can merge with the .NET coverage.
 *
 * `tests/CarvedRock.AppTests/Utils/BrowserCoverageCollector.cs` writes one JSON file per test,
 * holding byte ranges into the bundles the dev server served plus the source maps for those
 * bundles. Everything interesting happens here: monocart walks the ranges back through the source
 * maps onto the original TypeScript and merges every test's contribution into one result.
 *
 * Usage: node e2e-coverage.mjs [inputDir] [outputDir]
 * Defaults come from E2E_COVERAGE_DIR and land the report next to the .NET coverage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoverageReport } from 'monocart-coverage-reports';

const uiRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(uiRoot, '..');

// The single assembly the Angular code appears under in the merged report, next to the .NET ones.
const ASSEMBLY_NAME = path.basename(uiRoot);
const COBERTURA_FILE = 'frontend-e2e.cobertura.xml';

// Coverage keys stay forward-slashed even on Windows: sourceFilter below matches on them, and
// path.relative() understands either separator when the Cobertura reporter re-roots them.
const uiRootPosix = uiRoot.replaceAll('\\', '/');

const inputDir = path.resolve(
  process.argv[2] ?? process.env.E2E_COVERAGE_DIR ?? path.join(repoRoot, 'TestResults', 'e2e-v8-coverage'),
);
const outputDir = path.resolve(
  process.argv[3] ?? path.join(repoRoot, 'TestResults', 'frontend-e2e-coverage'),
);

if (!fs.existsSync(inputDir)) {
  console.log(`[frontend-e2e-coverage] no coverage captured (${inputDir} does not exist) - skipping.`);
  process.exit(0);
}

const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.json'));

if (files.length === 0) {
  console.log(`[frontend-e2e-coverage] no coverage files in ${inputDir} - skipping.`);
  process.exit(0);
}

const report = new CoverageReport({
  name: 'Angular UI (Playwright browser tests)',
  outputDir,

  reports: [
    // Picked up by test-with-coverage.ps1's ./TestResults/**/*.cobertura.xml glob. projectRoot is
    // what the <sources> element and the per-file paths are made relative to; without it the
    // reporter falls back to the current working directory.
    ['cobertura', { file: COBERTURA_FILE, projectRoot: repoRoot }],
    'console-summary',
  ],

  // ReportGenerator turns every Cobertura <package> into a separate assembly. The default "nested"
  // summarizer emits one package per source folder, which scatters the Angular code across a couple
  // of dozen assemblies; "flat" puts every file in a single package instead.
  defaultSummarizer: 'flat',

  // The source maps also carry the third-party bundles Vite pre-optimised and the component
  // templates Angular compiles into the same chunks. Only the app's own TypeScript is of interest.
  sourceFilter: (sourcePath) =>
    sourcePath.includes('/src/app/')
    && sourcePath.endsWith('.ts')
    && !sourcePath.endsWith('.spec.ts'),

  // Source maps name files relative to the Angular project ("src/app/x.ts"); anchor them to the
  // real location on disk so both this report and ReportGenerator can find the sources.
  sourcePath: (filePath) => {
    const index = filePath.lastIndexOf('src/app/');
    return index < 0 ? filePath : `${uiRootPosix}/${filePath.slice(index)}`;
  },

  cleanCache: true,
});

for (const file of files) {
  const entries = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
  await report.add(entries);
}

const results = await report.generate();

relabelCobertura(path.join(outputDir, COBERTURA_FILE));

console.log(
  `[frontend-e2e-coverage] merged ${files.length} test capture(s) into `
  + `${path.join(outputDir, COBERTURA_FILE)}`,
);

if (!results?.files?.length) {
  console.warn(
    '[frontend-e2e-coverage] WARNING: no source files survived sourceFilter - the report is empty.',
  );
}

/**
 * Fixes up the two labels istanbul's Cobertura writer gives us no way to configure. It hardcodes
 * the single flat package's name to "main", which would show up as an assembly called "main"
 * alongside the .NET projects; and it names each class after the bare filename, which collides
 * badly once the folders are flattened (there are several different service.ts/component.ts).
 * Both are rewritten from the filename attribute, which is already correct.
 */
function relabelCobertura(xmlPath) {
  const original = fs.readFileSync(xmlPath, 'utf8');

  let xml = original.replace('<package name="main"', `<package name="${ASSEMBLY_NAME}"`);

  xml = xml.replaceAll(
    /<class name="[^"]*" filename="([^"]*)"/g,
    (_match, filename) => `<class name="${qualifiedClassName(filename)}" filename="${filename}"`,
  );

  if (xml === original) {
    console.warn(
      '[frontend-e2e-coverage] WARNING: could not relabel the Cobertura output - the report will '
      + 'be grouped under "main" instead of the project name.',
    );
  }

  fs.writeFileSync(xmlPath, xml);
}

/**
 * "ui-with-bff\src\app\pages\cart\cart.ts" -> "pages.cart.cart.ts"
 *
 * Dotted rather than slashed: ReportGenerator truncates a Cobertura class name at the first "/",
 * which would merge every file under a folder into a single class. Dots are what it expects as a
 * namespace separator - the same shape the .NET class names arrive in - so they survive intact.
 */
function qualifiedClassName(filename) {
  const normalised = filename.replaceAll('\\', '/');
  const index = normalised.lastIndexOf('src/app/');
  const relative = index < 0 ? normalised : normalised.slice(index + 'src/app/'.length);

  return relative.replaceAll('/', '.');
}
