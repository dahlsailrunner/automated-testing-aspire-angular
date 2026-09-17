using Aspire.Hosting.JavaScript;

var builder = DistributedApplication.CreateBuilder(args);

var db = builder.AddPostgres("db")
    .WithUrlForEndpoint("tcp", u => u.DisplayLocation = UrlDisplayLocation.DetailsOnly)
    .AddDatabase("CarvedRockPostgres");

var smtp = builder.AddMailPit("smtp")
    .WithUrlForEndpoint("http", u => u.DisplayText = "Email Inbox")
    .WithUrlForEndpoint("smtp", u => u.DisplayLocation = UrlDisplayLocation.DetailsOnly);

var api = builder.AddProject<Projects.CarvedRock_Api>("api")
    .WithUrlForEndpoint("https", url => url.DisplayText = "API Scalar")
    .WithHttpHealthCheck("/alive")
    .WithReference(db)
    .WaitFor(db)
    .WithReference(smtp)
    .WaitFor(smtp)
    .WithHttpCommand(
        path: "/internal/reset-data",
        displayName: "Reset Data",
        commandOptions: new HttpCommandOptions()
        {
            Description = """
                Resets data.  All changes wiped out and database 
                is fully reset to original state and list of products!
                """,
            IconName = "DatabaseLightning",
            IsHighlighted = true
        });

var mcp = builder.AddProject<Projects.CarvedRock_Mcp>("mcp")
    .WithUrlForEndpoint("https", u => u.DisplayLocation = UrlDisplayLocation.DetailsOnly)
    .WithHttpHealthCheck("/alive")
    .WithReference(api)
    .WaitFor(api);

var openAiKeyParam = builder.AddParameter("openaiKey", 
        value: builder.Configuration["Parameters:openaiKey"] ?? "", secret: true)
    .WithDescription("OpenAI API Key.  Get one from " +
    "[OpenAI](https://platform.openai.com). Note " +
     "that without this set, all features except the AI chat and the " +
     "Agent API will still work fine.",
                enableMarkdown: true);

var agent = builder.AddProject<Projects.CarvedRock_Agent>("agent")
    .WithHttpHealthCheck("/alive")
    .WithUrlForEndpoint("https", u => u.DisplayText = "Agent Scalar")
    .WithEnvironment("AIConnection__OpenAIKey", openAiKeyParam)
    .WithReference(mcp)
    .WaitFor(mcp);

var webapp = builder.AddProject<Projects.CarvedRock_WebApp>("webapp")
    .WithUrlForEndpoint("https", u => u.DisplayText = "Web App")
    .WithHttpHealthCheck("/alive")
    .WithReference(api)
    .WithReference(agent)
    .WaitFor(api)
    .WithExternalHttpEndpoints();

var angularUi = builder.AddJavaScriptApp("angular-ui", "../ui-with-bff", "start")
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithUrlForEndpoint("http", u => u.DisplayLocation = UrlDisplayLocation.DetailsOnly);

var bff = builder.AddProject<Projects.CarvedRock_Bff>("bff")
    .WithUrlForEndpoint("https", u => u.DisplayText = "Angular Web App")
    .WithHttpHealthCheck("/alive")
    .WithReference(db)
    .WithReference(api)
    .WithReference(agent)
    .WithEnvironment("RemoteApis__api", api.GetEndpoint("https"))
    .WithEnvironment("RemoteApis__agent", agent.GetEndpoint("https"))
    .WaitFor(db)
    .WaitFor(api)
    .WaitFor(angularUi)
    .WithExternalHttpEndpoints();

builder.AddMcpInspector("mcp-inspector")
    .WithMcpServer(mcp, path: "")
    .WithUrlForEndpoint("client", u => u.DisplayText = "MCP Inspector")
    .WithUrlForEndpoint("server-proxy", u => u.DisplayLocation = UrlDisplayLocation.DetailsOnly);

builder.Build().Run();
