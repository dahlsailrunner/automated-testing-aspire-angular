using TUnit.Core.Interfaces;
using TUnit.Playwright;

namespace CarvedRock.AppTests.Utils;

public class CustomPageTest : PageTest
{
    [ClassDataSource<AppFixture>(Shared = SharedType.PerTestSession)]
    public required AppFixture Fixture { get; init; }

    public string WebAppUrl => Fixture.App.GetEndpoint("bff").ToString();

    // When a navigation dies at the network layer, Chromium reports only
    // "chrome-error://chromewebdata/" with an empty document - the actual reason
    // (net::ERR_CONNECTION_RESET vs ERR_ABORTED vs a renderer crash) is available
    // solely from these events, and only while the test is still running. Record
    // them as they happen so DescribeLandingPageAsync can report the cause.
    private readonly List<string> _pageEvents = [];

    [Before(Test)]
    public Task AddPageFailureHandling()
    {
        // No need to unsubscribe: Page lives exactly as long as this test instance.
        Page.RequestFailed += (_, request) => _pageEvents.Add(
            $"request failed: {request.Method} {request.Url} " +
            $"[{request.ResourceType}] -> {request.Failure ?? "(no reason given)"}");

        Page.Response += (_, response) =>
        {
            if (response.Status >= 400)
                _pageEvents.Add($"http {response.Status}: " +
                                $"{response.Request.Method} {response.Url}");
        };

        Page.Crash += (_, _) => _pageEvents.Add("*** the renderer process crashed ***");
        Page.PageError += (_, error) => _pageEvents.Add($"page error: {error}");
        Page.Console += (_, message) =>
        {
            if (message.Type == "error") _pageEvents.Add($"console error: {message.Text}");
        };

        return Task.CompletedTask;
    }

    private BrowserCoverageCollector? _coverage;

    // TUnit runs Before(Test) hooks base-class first, so Page (created by PageTest) already
    // exists here; After(Test) hooks run derived-class first, so StopCoverage below still has
    // a live Page/CDP session before PageTest tears it down.
    [Before(Test)]
    public async Task StartCoverage(TestContext testContext) =>
        _coverage = await BrowserCoverageCollector.StartAsync(
            Page, BrowserName, WebAppUrl, testContext.Metadata.TestName);

    [After(Test)]
    public async Task StopCoverage()
    {
        if (_coverage is not null)
        {
            await _coverage.StopAndWriteAsync();
        }
    }

    // playwright browsers on linux don't play well with the self-signed certs
    // this override is really only to support CI pipelines
    public override BrowserNewContextOptions ContextOptions(TestContext testContext)
    {
        var options = base.ContextOptions(testContext);
        options.IgnoreHTTPSErrors = true;

        return options;
    }
}

// Browser tests are the heaviest thing in this suite: every one is its own Chromium
// instance, running on top of the Aspire AppHost (two containers plus four services)
// and whatever the sibling test projects are doing in the same `dotnet test` run.
public record BrowserParallelLimit : IParallelLimit
{
    public int Limit => 3;
}

public static class PageExtensions
{
    public static async Task Login(this IPage page, string username, string password)
    {
        await page.GetByRole(AriaRole.Textbox, new() { Name = "Username" })
                                .FillAsync(username);
        await page.GetByRole(AriaRole.Textbox, new() { Name = "Password" })
                                .ClickAsync();
        await page.GetByRole(AriaRole.Textbox, new() { Name = "Password" })
                                .FillAsync(password);
        await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();

        //await Assertions.Expect(page.GetByRole(AriaRole.Link, new() { Name = "Sign Out" }))
        //                        .ToBeVisibleAsync();
        await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Sign Out" }))
                                .ToBeVisibleAsync();
    }
}
