param(
    [switch]$ShowReports
)

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue TestResults, coveragereport, "tests/CarvedRock.AppTests/bin/Debug/Net10.0/playwright-artifacts"

# Opts the WebAppTests browser tests into recording the Angular app's V8 coverage while they drive
# the browser. Absolute, because the test host runs from its own output directory.
$env:E2E_COVERAGE_DIR = Join-Path $PSScriptRoot 'TestResults\e2e-v8-coverage'

dotnet test --coverage --coverage-output-format cobertura --coverage-settings testconfig.json

# Maps those raw byte ranges back through the dev server's source maps onto the TypeScript sources,
# writing TestResults/frontend-e2e-coverage/frontend-e2e.cobertura.xml for the merge below. Skips
# itself when the browser tests did not run, so an API-only test run still produces a report.
if (Get-Command node -ErrorAction SilentlyContinue) {
    node (Join-Path $PSScriptRoot 'ui-with-bff\e2e-coverage.mjs')
}
else {
    Write-Warning 'node was not found on PATH - skipping the Angular UI coverage report.'
}

reportgenerator -reports:"TestResults/**/*.cobertura.xml" -targetdir:coveragereport -reporttypes:"Html;TextSummary;"

if ($ShowReports) {
    Invoke-Item ./coveragereport/index.html
    Invoke-Item ./TestResults/*.html
}