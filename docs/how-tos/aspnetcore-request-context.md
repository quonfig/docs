---
title: Per-Request Context in ASP.NET Core
sidebar_label: ASP.NET Core Request Context
---

You can target flags and configs in Quonfig per-request — by user, plan, region,
feature opt-in, anything you can read off `HttpContext`. The trick is to bind
that context **once** per request, then inject `IBoundQuonfig` into your
controllers and minimal API handlers so call sites don't have to thread a
`ContextSet` through every method.

The `Quonfig.Sdk.AspNetCore` companion package does this with two pieces:

- `AddQuonfig(...)` — registers the singleton client, runs `InitAsync()` via
  `IHostedService`, and registers a request-scoped `IBoundQuonfig`.
- `UseQuonfigContext(...)` — middleware that builds the per-request
  `ContextSet` from `HttpContext` before the bound client is constructed.

## Install

```bash
dotnet add package Quonfig.Sdk
dotnet add package Quonfig.Sdk.AspNetCore
```

The `Quonfig.Sdk` core package is a transitive dependency, but list it
explicitly so version bumps to the core don't have to wait on the AspNetCore
package republishing.

## Wire it up

```csharp
// Program.cs
using System.Security.Claims;
using Quonfig.Sdk;
using Quonfig.Sdk.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddQuonfig(opts =>
{
    opts.SdkKey = builder.Configuration["Quonfig:SdkKey"];
    opts.Environment = builder.Environment.EnvironmentName.ToLowerInvariant();
});

var app = builder.Build();

// Middleware runs BEFORE controllers/minimal APIs. Anything you put on `ctx`
// here is visible to every IBoundQuonfig call during that request.
app.UseQuonfigContext((http, ctx) =>
{
    if (http.User.Identity?.IsAuthenticated == true)
    {
        ctx["user"] = new()
        {
            ["key"] = http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "",
            ["email"] = http.User.FindFirstValue(ClaimTypes.Email) ?? "",
            ["plan"] = http.User.FindFirstValue("plan") ?? "free",
        };
    }

    // Tenant / org from a custom header
    if (http.Request.Headers.TryGetValue("X-Tenant-Id", out var tenant))
    {
        ctx["tenant"] = new() { ["key"] = tenant.ToString() };
    }

    // Coarse-grained device info from the user agent
    var ua = http.Request.Headers["User-Agent"].ToString();
    ctx["device"] = new()
    {
        ["key"] = ua,
        ["mobile"] = ua.Contains("Mobile", StringComparison.OrdinalIgnoreCase),
    };
});

app.MapGet("/beta", (IBoundQuonfig q) =>
    q.IsFeatureEnabled("beta.dashboard") ? "yes" : "no");

app.Run();
```

`IBoundQuonfig` is registered with **scoped** lifetime, so each request gets a
fresh bound view of the singleton client. The bound view is a lightweight
wrapper — there's no data copy and no allocation in the hot path.

## Using the bound client

Inject `IBoundQuonfig` anywhere ASP.NET Core resolves services for you:

```csharp
public class CheckoutController : ControllerBase
{
    private readonly IBoundQuonfig _quonfig;

    public CheckoutController(IBoundQuonfig quonfig)
    {
        _quonfig = quonfig;
    }

    [HttpPost]
    public IActionResult Submit()
    {
        if (_quonfig.IsFeatureEnabled("checkout.v2"))
        {
            // new flow — bound user/tenant/device context is already applied
            return Ok("v2");
        }

        return Ok("v1");
    }
}
```

When you have information that wasn't on `HttpContext` yet, layer it on with
`WithContext(...)`, which returns a new bound view with the extra context merged
in — per-call values win over the existing bound context when they share a key.
(`IBoundQuonfig` getters don't take a `ContextSet` argument directly; chain
`WithContext` instead.)

```csharp
var jitCtx = new ContextSet { ["experiment"] = new() { ["bucket"] = bucket } };
_quonfig.WithContext(jitCtx).IsFeatureEnabled("pricing.experiment");
```

## Background work

The bound client is request-scoped, so it's not available from background
services or hosted services. Those should consume the singleton `IQuonfig` and
build their own context explicitly:

```csharp
public class NightlyJob(IQuonfig quonfig) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var ctx = new ContextSet { ["job"] = new() { ["name"] = "nightly" } };
        var batch = quonfig.GetInt("nightly.batch-size", ctx, defaultValue: 1000);
        // ...
    }
}
```

## Testing

The middleware reads from `HttpContext`, so unit tests on the builder lambda
can stub `HttpContext` directly. For integration tests, use
`WebApplicationFactory<TEntryPoint>` and replace `IQuonfig` with a datadir-backed
instance — every typed getter (and `IBoundQuonfig`) keeps working without
touching the network:

```csharp
public class TestFixture : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IQuonfig>();
            services.AddSingleton<IQuonfig>(_ => new Quonfig.Sdk.Quonfig(new QuonfigOptions
            {
                Datadir = "TestData/quonfig-fixtures",
                Environment = "test",
            }));
        });
    }
}
```

## Related

- [.NET SDK reference](/docs/sdks/dotnet) — full `QuonfigOptions`,
  getters, `EvaluationDetails<T>`, and health primitives.
- [Open Source / Fully Local](/docs/how-tos/open-source-local) — point the
  SDK at a local workspace directory for tests, CI, or fully offline dev.
