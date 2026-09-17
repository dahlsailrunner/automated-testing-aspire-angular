using CarvedRock.Bff;
using CarvedRock.Core;
using Duende.Bff;
using Duende.Bff.AccessTokenManagement;
using Duende.Bff.Yarp;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddSpaYarp();
builder.Services.AddAuthorization();

builder.AddNpgsqlDbContext<LocalDbContext>("CarvedRockPostgres");
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<LocalDbContext>();

var authority = builder.Configuration.GetValue<string>("Auth:Authority");

JwtSecurityTokenHandler.DefaultMapInboundClaims = false;
builder.Services.AddBff()
    .ConfigureOpenIdConnect(options =>
    {
        options.Authority = authority;
        options.ClientId = "interactive.confidential";
        options.ClientSecret = "secret";
        options.ResponseType = "code";
        options.Scope.Clear();
        options.Scope.Add("openid");
        options.Scope.Add("profile");
        options.Scope.Add("email");
        options.Scope.Add("api");
        options.Scope.Add("offline_access");
        options.GetClaimsFromUserInfoEndpoint = true;
        options.SaveTokens = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            NameClaimType = "email"
        };
    })
    .ConfigureCookies(options =>
    {
        options.Cookie.Name = "__Host-carvedrock-bff";
    })
    .AddRemoteApis()
    .AddServerSideSessions();

builder.Services.AddTransient<IClaimsTransformation, AdminClaimsTransformation>();

var app = builder.Build();

app.MapDefaultEndpoints();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
    context.Database.Migrate();
}

app.UseStaticFiles();

app.UseAuthentication();
app.UseBff();
app.UseAuthorization();

var remoteApis = builder.Configuration.GetSection("RemoteApis").Get<Dictionary<string, string>>() ?? [];
foreach (var (path, baseUrl) in remoteApis)
{
    app.MapRemoteBffApiEndpoint($"/{path}", new Uri(baseUrl))
        .WithAccessToken(RequiredTokenType.User);
}

app.UseSpaYarp(); // dev-only: proxies non-matched requests to the Angular dev server

app.MapFallbackToFile("index.html");

app.Run();
