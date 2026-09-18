# Automated Testing Strategies for ASP.NET Core 10 - With an Angular Front End (and Duende BFF)

This repo is an "expansion" on my [Automated Testing for ASP.NET Core 10 repo](https://github.com/dahlsailrunner/automated-testing-aspnetcore10) - with the Razor pages ui replaced by an Angular front end
that uses the Duende BFF library to support the backend-for-frontend (BFF) pattern.

**The awesome thing shown in this repo is that running the "AppTests" - which run the
entire Aspire application for testing - actually includes coverage information on the
Angular front end as well.**

## Getting Started

You need the [Aspire prerequisites](https://aspire.dev/get-started/prerequisites/).
You also need Node 24 or greater for the npm install and Angular stuff.

To run the tests and look at the reports that get created, run the following command:

```bash
./test-with-coverage.ps1 -ShowReports
```

When this completes, three TUnit reports will open in the browser, as well as a code
coverage report -- and the coverage report shows the Angular application!  You can drill
into the `.ts` files and see covered and uncovered lines, which is awesome.

Also, the `tests/CarvedRock.AppTests/bin/Debug/Net10.0/playwright-artifacts` folder
will have a screenshot and some videos that were captured during Playwright tests.

### VS Code Setup

You need the following extension:

* [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit)

Then just hit `F5` to run the app.

The [Aspire CLI](https://aspire.dev/get-started/install-cli/#install-the-aspire-cli) is highly recommended, along with the [Aspire VS Code Extension](https://aspire.dev/get-started/aspire-vscode-extension/).

### AI

It's not required, but if you want to use the AI features in the app, you
need to have an OpenAI key (use it to set the `openaiKey` parameter).

### More Information

If you're looking for some more information about the tests, features, or whatever,
check [the original repo](https://github.com/dahlsailrunner/automated-testing-aspnetcore10).
The rest of this content will focus on the coverage information for the Angular app.

## Getting Angular Coverage

Getting code coverage for the Angular app out of Playwright-driven browser tests takes three
steps: capture, convert, and merge.

### 1. Capture - V8 precise coverage during the browser tests

Playwright's own `Coverage` API only works for JavaScript, and even then it's not enough on
its own to map execution back to the original TypeScript. Instead,
[`BrowserCoverageCollector`](tests/CarvedRock.AppTests/Utils/BrowserCoverageCollector.cs) drives
the Chrome DevTools Protocol directly against each test's Chromium page:

* It opens a raw CDP session and calls `Profiler.startPreciseCoverage` (with `callCount` and
  `detailed: true` for block-level granularity) before the test navigates anywhere.
* While the page runs, `Debugger.scriptParsed` events are used to cache the source text and
  source-map URL for every script served from the app's own origin, since a script's source can
  no longer be read back once the page navigates away from it.
* When the test finishes, `Profiler.takePreciseCoverage` returns the raw V8 coverage (byte ranges
  into each script), which is bundled together with the cached source and source map and written
  out as one intermediate JSON file per test.

This only runs when the `E2E_COVERAGE_DIR` environment variable is set, so an ordinary
`dotnet test` doesn't pay for any of it - `test-with-coverage.ps1` is what sets it, pointing at
`TestResults/e2e-v8-coverage`.

### 2. Convert - intermediate files to Cobertura

Once the test run finishes, [`ui-with-bff/e2e-coverage.mjs`](ui-with-bff/e2e-coverage.mjs) turns
those intermediate JSON files into a Cobertura report using
[`monocart-coverage-reports`](https://www.npmjs.com/package/monocart-coverage-reports). Monocart
does the hard part: it walks the raw V8 byte ranges back through each script's source map onto
the original `.ts` files and merges every test's contribution into a single coverage result. The
script also:

* Filters the result down to the app's own source (`src/app/**/*.ts`, excluding specs) - the
  source maps also carry Vite-optimized third-party bundles and compiled component templates that
  aren't interesting here.
* Flattens the report into a single assembly (named after the `ui-with-bff` folder) instead of the
  default per-folder grouping, so the Angular code shows up as one project instead of being spread
  across dozens of tiny ones.
* Relabels the Cobertura output's package and class names, since istanbul's writer otherwise
  hardcodes the package to `"main"` and names classes after the bare filename, which collides once
  several `service.ts`/`component.ts` files get flattened together.

The result is written to `TestResults/frontend-e2e-coverage/frontend-e2e.cobertura.xml`.

### 3. Merge - ReportGenerator ties it all together

`test-with-coverage.ps1` runs this conversion step right after `dotnet test`, then hands
ReportGenerator a glob across `TestResults/**/*.cobertura.xml` - which now includes both the
.NET projects' coverage and `frontend-e2e.cobertura.xml`. Because ReportGenerator treats each
Cobertura package as its own assembly, the Angular app shows up as just another project alongside
the .NET ones in the combined HTML report, complete with line-by-line covered/uncovered
highlighting in the original TypeScript source.
