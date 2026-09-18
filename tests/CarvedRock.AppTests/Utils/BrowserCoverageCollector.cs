using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Playwright;

namespace CarvedRock.AppTests.Utils;

/// <summary>
/// Records which of the Angular app's JavaScript actually executed during a test, so the browser
/// tests contribute to the consolidated coverage report alongside the .NET projects.
///
/// Playwright's <c>Coverage</c> API is JavaScript-only, so V8's precise-coverage profiler is driven
/// directly over a raw CDP session. Each test drops one file of raw V8 coverage - byte ranges into
/// the bundles the dev server served - and <c>ui-with-bff/e2e-coverage.mjs</c> maps those ranges
/// back through the bundles' source maps onto the original TypeScript, then emits Cobertura.
///
/// Collection is opt-in: without <c>E2E_COVERAGE_DIR</c> nothing here runs, so an ordinary
/// <c>dotnet test</c> pays none of the cost. <c>test-with-coverage.ps1</c> sets the variable.
/// </summary>
public sealed class BrowserCoverageCollector
{
    private const string OutputDirectoryVariable = "E2E_COVERAGE_DIR";

    private readonly ICDPSession _session;
    private readonly IPage _page;
    private readonly string _originPrefix;
    private readonly string _outputDirectory;
    private readonly string _testName;

    /// <summary>
    /// Sources captured as each script is parsed, keyed by script id. Capturing at parse time is
    /// the whole trick: once the page navigates, the previous document's scripts can no longer be
    /// read back, but the profiler still reports coverage for them.
    /// </summary>
    private readonly ConcurrentDictionary<string, Task<CachedScript?>> _scripts = new();

    private BrowserCoverageCollector(
        ICDPSession session, IPage page, string originPrefix, string outputDirectory, string testName)
    {
        _session = session;
        _page = page;
        _originPrefix = originPrefix;
        _outputDirectory = outputDirectory;
        _testName = testName;
    }

    private sealed record CachedScript(string Url, string Source, string? SourceMapUrl);

    public static string? OutputDirectory => Environment.GetEnvironmentVariable(OutputDirectoryVariable);

    public static bool IsEnabled => !string.IsNullOrWhiteSpace(OutputDirectory);

    /// <summary>
    /// Begins recording on <paramref name="page"/>, or returns null when collection is switched off
    /// or the browser is not Chromium (the profiler is a Chrome DevTools Protocol feature).
    /// Call before the test navigates - scripts that ran before this point are not counted.
    /// </summary>
    /// <param name="originPrefix">
    /// Only scripts served from this origin are kept, which drops any CDN-hosted bundles and any
    /// browser-injected script from the report.
    /// </param>
    public static async Task<BrowserCoverageCollector?> StartAsync(
        IPage page, string browserName, string originPrefix, string testName)
    {
        var outputDirectory = OutputDirectory;

        if (string.IsNullOrWhiteSpace(outputDirectory)
            || !string.Equals(browserName, "chromium", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        Directory.CreateDirectory(outputDirectory);

        var session = await page.Context.NewCDPSessionAsync(page);
        var collector = new BrowserCoverageCollector(
            session, page, originPrefix, outputDirectory, testName);

        await collector.StartRecordingAsync();

        return collector;
    }

    private async Task StartRecordingAsync()
    {
        // Subscribe before enabling: Debugger.enable replays scriptParsed for anything already
        // loaded, and those events would otherwise be missed.
        _session.Event("Debugger.scriptParsed").OnEvent += OnScriptParsed;

        await _session.SendAsync("Debugger.enable");

        // Debugger is what makes the executed source text retrievable at all; skipping all pauses
        // keeps it from ever suspending the page on a breakpoint or an uncaught exception.
        await _session.SendAsync("Debugger.setSkipAllPauses", new() { ["skip"] = true });

        await _session.SendAsync("Profiler.enable");
        await _session.SendAsync("Profiler.startPreciseCoverage", new()
        {
            ["callCount"] = true,
            ["detailed"] = true,   // block-level, not just per-function
        });
    }

    /// <summary>
    /// Stops recording and writes this test's raw V8 coverage. Never throws: a coverage problem must
    /// not turn a passing browser test red, so failures are reported to the test output and swallowed.
    /// </summary>
    public async Task StopAndWriteAsync()
    {
        try
        {
            await WriteCoverageAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[coverage] '{_testName}' produced no coverage: {ex.Message}");
        }
        finally
        {
            _session.Event("Debugger.scriptParsed").OnEvent -= OnScriptParsed;

            try
            {
                await _session.DetachAsync();
            }
            catch (PlaywrightException)
            {
                // The context is already going away; nothing to detach from.
            }
        }
    }

    private void OnScriptParsed(object? sender, JsonElement? payload)
    {
        if (payload is not { } script)
        {
            return;
        }

        var url = script.TryGetProperty("url", out var urlProperty) ? urlProperty.GetString() : null;

        if (string.IsNullOrEmpty(url) || !url.StartsWith(_originPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var scriptId = script.GetProperty("scriptId").GetString()!;
        var sourceMapUrl = script.TryGetProperty("sourceMapURL", out var mapProperty)
            ? mapProperty.GetString()
            : null;

        // Kick the read off now and join on it later, so the CDP event pump is never blocked.
        _scripts.TryAdd(scriptId, ReadScriptSourceAsync(scriptId, url, sourceMapUrl));
    }

    private async Task<CachedScript?> ReadScriptSourceAsync(string scriptId, string url, string? sourceMapUrl)
    {
        try
        {
            var response = await _session.SendAsync(
                "Debugger.getScriptSource", new() { ["scriptId"] = scriptId });

            return response?.GetProperty("scriptSource").GetString() is { } source
                ? new CachedScript(url, source, sourceMapUrl)
                : null;
        }
        catch (PlaywrightException)
        {
            // Raced with a navigation, or the session closed as the test ended.
            return null;
        }
    }

    private async Task WriteCoverageAsync()
    {
        var taken = await _session.SendAsync("Profiler.takePreciseCoverage");
        await _session.SendAsync("Profiler.stopPreciseCoverage");

        await Task.WhenAll(_scripts.Values);

        if (taken is not { } result || !result.TryGetProperty("result", out var scripts))
        {
            return;
        }

        var entries = new JsonArray();

        foreach (var script in scripts.EnumerateArray())
        {
            if (await BuildEntryAsync(script) is { } entry)
            {
                entries.Add(entry);
            }
        }

        if (entries.Count == 0)
        {
            return;
        }

        var path = Path.Combine(_outputDirectory, $"{Sanitize(_testName)}-{Guid.NewGuid():N}.json");

        await File.WriteAllTextAsync(path, entries.ToJsonString());
    }

    /// <summary>
    /// Turns one raw V8 script record into the shape monocart-coverage-reports consumes: the
    /// coverage ranges, the exact source those byte offsets index into, and the source map that
    /// puts the ranges back onto the original TypeScript.
    ///
    /// Skips scripts with no source map entirely, rather than passing them through unmapped: with
    /// nothing to attribute their coverage to, e2e-coverage.mjs's sourceFilter can't ever match
    /// them, so they'd only survive as junk "classes" named after the raw request - Angular's dev
    /// server serves plenty of these for HMR/component-transform requests, whose query strings
    /// (e.g. "...&t=1789751640489") contain a literal unescaped "&" that produces invalid Cobertura
    /// XML and fails ReportGenerator entirely.
    /// </summary>
    private async Task<JsonNode?> BuildEntryAsync(JsonElement script)
    {
        var scriptId = script.GetProperty("scriptId").GetString()!;

        if (!_scripts.TryGetValue(scriptId, out var cachedTask) || await cachedTask is not { } cached)
        {
            return null;
        }

        if (await GetSourceMapAsync(cached) is not { } sourceMap)
        {
            return null;
        }

        return new JsonObject
        {
            ["url"] = cached.Url,
            ["scriptId"] = scriptId,
            ["source"] = cached.Source,
            ["functions"] = JsonNode.Parse(script.GetProperty("functions").GetRawText()),
            ["sourceMap"] = sourceMap,
        };
    }

    private async Task<JsonNode?> GetSourceMapAsync(CachedScript script)
    {
        if (string.IsNullOrEmpty(script.SourceMapUrl))
        {
            return null;
        }

        try
        {
            var json = script.SourceMapUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase)
                ? DecodeDataUri(script.SourceMapUrl)
                : await FetchAsync(new Uri(new Uri(script.Url), script.SourceMapUrl).ToString());

            return json is null ? null : JsonNode.Parse(json);
        }
        catch (Exception ex) when (ex is PlaywrightException or JsonException or UriFormatException or FormatException)
        {
            // Without a source map this script's coverage can't be attributed to any TypeScript
            // file, so the conversion step drops it. Not worth failing the test over.
            return null;
        }
    }

    private static string? DecodeDataUri(string dataUri)
    {
        var comma = dataUri.IndexOf(',');

        if (comma < 0)
        {
            return null;
        }

        var payload = dataUri[(comma + 1)..];

        return dataUri[..comma].Contains(";base64", StringComparison.OrdinalIgnoreCase)
            ? System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(payload))
            : Uri.UnescapeDataString(payload);
    }

    /// <summary>
    /// Fetches from inside the page rather than over HttpClient, so the request carries the
    /// browser's session cookies - the BFF only proxies the dev server for a signed-in caller -
    /// and inherits its tolerance for Aspire's self-signed certificate.
    /// </summary>
    private async Task<string?> FetchAsync(string url) =>
        await _page.EvaluateAsync<string?>(
            "async url => { const r = await fetch(url); return r.ok ? await r.text() : null; }", url);

    private static string Sanitize(string name) =>
        string.Concat(name.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
}
