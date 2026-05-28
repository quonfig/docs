---
title: .NET
---

## Install the latest version

[GitHub](https://github.com/quonfig/sdk-net) | [NuGet](https://www.nuget.org/profiles/quonfig)

Replace `0.0.1` with the [latest version on NuGet](https://www.nuget.org/packages/Quonfig.Sdk).

<Tabs groupId="dotnet-build">
<TabItem value="dotnet-cli" label=".NET CLI">

```bash
dotnet add package Quonfig.Sdk --version 0.0.1
```

</TabItem>

<TabItem value="packagereference" label="PackageReference">

```xml
<ItemGroup>
  <PackageReference Include="Quonfig.Sdk" Version="0.0.1" />
</ItemGroup>
```

</TabItem>

<TabItem value="paket" label="Paket">

```paket
nuget Quonfig.Sdk ~> 0.0.1
```

</TabItem>

<TabItem value="cpm" label="Directory.Packages.props (CPM)">

```xml
<Project>
  <ItemGroup>
    <PackageVersion Include="Quonfig.Sdk" Version="0.0.1" />
  </ItemGroup>
</Project>
```

Then reference it without a version in the consuming project:

```xml
<ItemGroup>
  <PackageReference Include="Quonfig.Sdk" />
</ItemGroup>
```

</TabItem>
</Tabs>

**Requirements:** `net8.0` (current LTS) or any runtime compatible with `netstandard2.0` (including .NET Framework 4.6.2+).

### Companion packages

The .NET SDK ships as four NuGet packages published lock-step from one tag. Add only what you need:

| Package                            | Purpose                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `Quonfig.Sdk`                      | Core SDK — evaluation, transport, SSE, telemetry, datadir, datafile.     |
| `Quonfig.Sdk.AspNetCore`           | DI + `IHostedService` + per-request `ContextSet` via `HttpContext`.      |
| `Quonfig.Sdk.Extensions.Logging`   | `ILoggerProvider` filter for dynamic log levels via `Microsoft.Extensions.Logging`. |
| `Quonfig.Sdk.Serilog`              | Serilog `LoggingLevelSwitch` provider for dynamic log levels.            |

## Initialize the client

The core SDK exposes a single client class, `Quonfig.Sdk.Quonfig`, configured with a `QuonfigOptions` instance.

If you set `QUONFIG_BACKEND_SDK_KEY` in your environment, initialization is a one-liner:

```csharp
using Quonfig.Sdk;

await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions());
await client.InitAsync();
```

:::note Why `Quonfig.Sdk.Quonfig`?

The client type `Quonfig` lives in the `Quonfig.Sdk` namespace, so the bare name `Quonfig` collides with the root `Quonfig` namespace (`error CS0118: 'Quonfig' is a namespace but is used like a type`). The examples below fully-qualify the constructor as `new Quonfig.Sdk.Quonfig(...)`. If you prefer the short name, add a `using` alias: `using QuonfigClient = Quonfig.Sdk.Quonfig;`.

:::

Or pass the SDK key explicitly:

```csharp
await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    SdkKey = Environment.GetEnvironmentVariable("QUONFIG_BACKEND_SDK_KEY"),
});
await client.InitAsync();
```

`Quonfig` implements `IAsyncDisposable`. We recommend wiring it as a singleton in your DI container and letting the container call `DisposeAsync()` on shutdown to stop the SSE stream and flush telemetry. In ASP.NET Core the [`Quonfig.Sdk.AspNetCore`](#aspnet-core-integration) package handles this for you.

### Initialization is asynchronous

`InitAsync()` runs the first config fetch (or datadir read) and completes once the initial envelope has been installed. After it returns, every typed getter (`GetString`, `GetBool`, etc.) is a synchronous in-memory read — no `Async` suffix, no `Task` allocation per call.

If initialization fails or times out, the `OnInitFailure` option decides what happens:

- `OnInitFailure.Throw` (default) — `InitAsync()` throws `QuonfigInitTimeoutException`.
- `OnInitFailure.ReturnDefaults` — `InitAsync()` returns; subsequent getter calls fall back to the caller's `defaultValue` until the background fetch eventually succeeds.

```csharp
await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    SdkKey = "sdk-...",
    InitTimeout = TimeSpan.FromSeconds(10),
    OnInitFailure = OnInitFailure.ReturnDefaults,
});
await client.InitAsync();
```

### Datadir mode (local development)

To run the SDK against a local checkout of a Quonfig workspace directory (the `configs/`, `feature-flags/`, `segments/`, `log-levels/` tree), use `Datadir`. **`Environment` is required in datadir mode** — set it on `QuonfigOptions` or via the `QUONFIG_ENVIRONMENT` env var.

```csharp
await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    Datadir = "/path/to/your-workspace",
    Environment = "development",
});
await client.InitAsync();
```

In datadir mode the SDK loads everything synchronously from disk; there is no background fetch and no SSE connection. Telemetry is still uploaded if an `SdkKey` is also set.

To pick up edits to the workspace without restarting the process, opt into auto-reload — see [Auto-reload on file changes](/docs/how-tos/open-source-local#auto-reload-on-file-changes).

```csharp
await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    Datadir = "/path/to/your-workspace",
    Environment = "development",
    DatadirAutoReload = true,
    DatadirAutoReloadDebounce = TimeSpan.FromMilliseconds(200),
});
await client.InitAsync();
```

### Datafile mode

For build-time embedding (or tests), point `Datafile` at a single serialized envelope. The SDK loads it synchronously and makes no network calls.

```csharp
await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    Datafile = "/path/to/envelope.json",
});
await client.InitAsync();
```

You can also pass a pre-parsed envelope via `DatafileEnvelope` — useful when you already have the JSON in memory and don't want to round-trip through the filesystem.

### Domain and API URL configuration

By default the SDK derives every service URL from a single domain (`quonfig.com`):

- API: `https://primary.quonfig.com`, `https://secondary.quonfig.com`
- SSE stream: `https://stream.primary.quonfig.com`, `https://stream.secondary.quonfig.com`
- Telemetry: `https://telemetry.quonfig.com`

You can override the URL lists directly on `QuonfigOptions`:

```csharp
await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    SdkKey = "sdk-...",
    ApiUrls = new[] { "https://primary.example.com" },
    StreamUrls = new[] { "https://stream.primary.example.com" },
    TelemetryUrl = "https://telemetry.example.com",
});
```

For local development with the bundled Caddy reverse proxy (`scripts/local-proxy/setup.sh` in the monorepo), set `QUONFIG_DOMAIN=quonfig-localhost` in your environment — the SDK will route to `primary.quonfig-localhost`, `stream.primary.quonfig-localhost`, etc.

## Feature Flags

For boolean flags, use `IsFeatureEnabled` — it always returns a `bool`, never throws, and defaults to `false` when the key is missing:

```csharp
if (client.IsFeatureEnabled("my.feature.name"))
{
    // ...
}
```

A flag that doesn't exist yet evaluates to `false`, so you can safely add `IsFeatureEnabled` checks before the flag is created.

<details className="alert--info">
<summary>
Feature flags don't have to return just true or false.
</summary>

You can return any supported type using the typed getters described in [Dynamic Config](#dynamic-config) below.

```csharp
string variant = client.GetString("my.string.feature.name", defaultValue: "control")!;
```

</details>

## Context

Feature flags become more powerful when you give the evaluator [context](/docs/explanations/concepts/context) about the current user, team, request, or host. The .NET SDK uses `Quonfig.Sdk.ContextSet` to bundle one or more **named contexts** (e.g. `user`, `team`, `device`).

```csharp
using Quonfig.Sdk;

var ctx = new ContextSet
{
    ["user"] = new()
    {
        ["key"] = "user-123",
        ["email"] = "alice@example.com",
    },
    ["team"] = new()
    {
        ["key"] = "team-abc",
        ["plan"] = "pro",
    },
};
```

Implicit conversions on `ContextValue` let you assign primitive C# values directly — `string`, `int`, `long`, `double`, `bool`, and `string[]` all work without wrapping.

Properties are looked up in rules using dotted notation: `user.email`, `team.plan`. The magic property `quonfig.current-time` (also `prefab.current-time` and `reforge.current-time`, kept for compatibility) resolves to the current wall-clock time in milliseconds since the epoch — useful for time-windowed rollouts.

### Global Context

A global context is merged into every evaluation. Use it for values that don't change at runtime (application name, region, host).

```csharp
var global = new ContextSet
{
    ["application"] = new()
    {
        ["key"] = "my-api",
        ["region"] = Environment.GetEnvironmentVariable("REGION") ?? "us-east",
    },
};

await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    SdkKey = "sdk-...",
    GlobalContext = global,
});
await client.InitAsync();
```

Global context is the least specific layer and is overridden by any per-call context that supplies the same key.

### Bound Context (per-request)

For web servers, bind context for the lifetime of a request via `WithContext(...)`. The returned `IBoundQuonfig` mirrors every typed getter, with the bound context pre-applied — no need to thread `ContextSet` through every call site.

```csharp
var requestCtx = new ContextSet
{
    ["user"] = new()
    {
        ["key"] = currentUser.Id,
        ["email"] = currentUser.Email,
    },
};

IBoundQuonfig bound = client.WithContext(requestCtx);

if (bound.IsFeatureEnabled("my.feature.name"))
{
    // ...
}
```

In ASP.NET Core, `Quonfig.Sdk.AspNetCore` builds the bound client per request automatically — see [ASP.NET Core integration](#aspnet-core-integration) below, or the [per-request context how-to](/docs/how-tos/aspnetcore-request-context).

### Just-in-time Context

You can also pass a `ContextSet` directly to any getter call. It merges with the global (and bound) context; per-call values win on key collision.

```csharp
var jitCtx = new ContextSet
{
    ["device"] = new() { ["mobile"] = true },
};

bool enabled = client.IsFeatureEnabled("my.feature.name", jitCtx);
```

## Dynamic Config

Config values are read with typed getters that take a key, an optional `ContextSet`, and a default. Getters never throw on missing or wrong-type config when you pass a default — they fall back to the supplied value.

```csharp
string  backend     = client.GetString("backend.url", defaultValue: "https://api.example.com")!;
bool    newCheckout = client.GetBool("checkout.v2", defaultValue: false) ?? false;
long    maxJobs     = client.GetLong("max-jobs-per-second", defaultValue: 10L) ?? 10L;
double  sampleRate  = client.GetDouble("trace.sample-rate", defaultValue: 0.1) ?? 0.1;
var     regions     = client.GetStringList("regions", defaultValue: new[] { "us-east" });
TimeSpan cacheTtl   = client.GetDuration("cache.ttl", defaultValue: TimeSpan.FromSeconds(30)) ?? TimeSpan.FromSeconds(30);
object? slackConfig = client.GetJson("slack.bot.config", defaultValue: new Dictionary<string, object>());
```

:::note 32-bit `GetInt` narrows from a 64-bit wire format

Quonfig stores int configs as 64-bit values everywhere. `GetInt` narrows to `int`; if you need the full range, use `GetLong`. The narrower getter is provided for convenience when you know the value fits in 32 bits.

:::

### OnNoDefault policy

If you call a getter without a `defaultValue` and the key cannot be resolved, the SDK consults the `OnNoDefault` option:

- `OnNoDefault.Throw` (default) — throws `QuonfigKeyNotFoundException`.
- `OnNoDefault.Warn` — logs a warning and returns `null` / `default(T)`.
- `OnNoDefault.Ignore` — silent default.

`IsFeatureEnabled` always returns `bool` and bypasses `OnNoDefault` — it defaults to `false` on missing.
`ShouldLog` always returns `bool` and walks the dotted-key hierarchy before falling back to `true`.

Each getter also accepts a context-bearing overload:

```csharp
var ctx = new ContextSet { ["user"] = new() { ["plan"] = "pro" } };
long maxJobs = client.GetLong("max-jobs-per-second", contexts: ctx, defaultValue: 10L) ?? 10L;
```

### Evaluation details (reason, variant, errors)

Each typed getter has a `GetXDetails(...)` variant that returns an `EvaluationDetails<T>` instead of just the value. Use it when you need the resolution `Reason`, the synthetic OpenFeature `Variant` identifier, the matching rule index, or the error code on failure.

```csharp
EvaluationDetails<string?> details = client.GetStringDetails(
    "backend.url",
    contexts: ctx,
    defaultValue: "https://api.example.com");

if (details.Reason == Reason.Error)
{
    logger.LogWarning(
        "backend.url evaluation failed: {Message} ({Code})",
        details.ErrorMessage, details.ErrorCode);
}
```

`EvaluationDetails<T>` carries:

| Field             | Description                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `Value`           | The typed value (or your default on `Default` / `Error`).                                            |
| `Reason`          | `Static`, `TargetingMatch`, `Default`, `Error`, or `Unknown` (see note on `Split` below).            |
| `Variant`         | OpenFeature-style identifier — `"static"`, `"targeting:<n>"`, or `"default"`.                        |
| `VariantIndex`    | Reserved for weighted splits — always `null` in `0.0.1`.                                              |
| `ErrorCode`       | `FlagNotFound`, `TypeMismatch`, or `General` on `Error`; `null` otherwise.                           |
| `ErrorMessage`    | Companion to `ErrorCode`.                                                                            |
| `Metadata`        | `configId`, `configKey`, `configType`, optional `ruleIndex`, `environment`.                          |

:::note Weighted splits report `TargetingMatch` in `0.0.1`

The `Reason` enum and `VariantIndex` field include a `Split` variant (`"split:<n>"`) for OpenFeature parity, but the `0.0.1` evaluator never emits it: weighted-value configs resolve to the correct value and report `Reason.TargetingMatch` with `VariantIndex == null`. The dedicated split reason/index is reserved for a later release.

:::

## ASP.NET Core integration

The `Quonfig.Sdk.AspNetCore` companion package wires `Quonfig` into the ASP.NET Core host: it registers the singleton, runs `InitAsync` via `IHostedService`, and (optionally) binds per-request `ContextSet` from `HttpContext` so controllers can inject `IBoundQuonfig` directly.

```bash
dotnet add package Quonfig.Sdk.AspNetCore --version 0.0.1
```

```csharp
// Program.cs
using Quonfig.Sdk;
using Quonfig.Sdk.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddQuonfig(opts =>
{
    opts.SdkKey = builder.Configuration["Quonfig:SdkKey"];
    opts.Environment = builder.Environment.EnvironmentName.ToLowerInvariant();
});

var app = builder.Build();

app.UseQuonfigContext((http, ctx) =>
{
    if (http.User.Identity?.IsAuthenticated == true)
    {
        ctx["user"] = new()
        {
            ["key"] = http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "",
            ["email"] = http.User.FindFirstValue(ClaimTypes.Email) ?? "",
        };
    }
});

// Minimal API: inject the bound client and the request context is applied for you.
app.MapGet("/beta", (IBoundQuonfig q) =>
    q.IsFeatureEnabled("beta.dashboard") ? "yes" : "no");

app.Run();
```

`AddQuonfig` registers `IQuonfig` and `Quonfig` as singletons, the request-scoped `IBoundQuonfig`, and an `IHostedService` that runs `InitAsync()` during application startup and `CloseAsync()` on shutdown. `UseQuonfigContext` registers middleware that builds the per-request `ContextSet` from `HttpContext`.

See the [per-request context binding how-to](/docs/how-tos/aspnetcore-request-context) for a full walkthrough.

## Dynamic Log Levels

Log levels in Quonfig are stored as `log_level` configs. The SDK consults them via `ShouldLog(...)`, so changes pushed to Quonfig take effect immediately over SSE — no redeploy or polling.

`ShouldLog(loggerPath, desired [, contexts])` returns `true` when a record at `desired` should be emitted for `loggerPath`. It always injects the logger path into the evaluation context as `quonfig-sdk-logging.key`, and uses one of two lookup strategies:

- **Single-config dispatch** — when you set `LoggerKey = "..."` on `QuonfigOptions`, that one config is evaluated with `quonfig-sdk-logging.key=<loggerPath>` so a single config drives per-logger rules. This is the recommended pattern.
- **Per-logger lookup** — when `LoggerKey` is unset, the SDK looks up a config keyed by `loggerPath` itself, then walks up dotted parents (`Acme.Web.AuthService` → `Acme.Web` → `Acme` → `""`) until one matches.

If no log-level config is found at any level, `ShouldLog` returns `true` — the SDK never silently swallows logs.

### Microsoft.Extensions.Logging integration

The `Quonfig.Sdk.Extensions.Logging` package wires `ShouldLog` into the BCL logging pipeline by wrapping the providers already registered on the `ILoggingBuilder`:

```bash
dotnet add package Quonfig.Sdk.Extensions.Logging --version 0.0.1
```

`AddQuonfigFilter(quonfig)` takes the client instance and must be called **last** in the logging setup — it snapshots and wraps every `ILoggerProvider` registered up to that point. Because it needs the instance at logging-config time, construct the client up front and register the same instance with DI:

```csharp
using Quonfig.Sdk;
using Quonfig.Sdk.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

// Construct the client up front so the one instance drives both the logging
// filter and DI.
var quonfig = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    SdkKey = builder.Configuration["Quonfig:SdkKey"],
    LoggerKey = "log-level.my-app",
});
builder.Services.AddSingleton<IQuonfig>(quonfig);

// Add LAST, after the default console/debug providers are wired.
builder.Logging.AddQuonfigFilter(quonfig);
```

Every `ILogger<T>` call site is then automatically gated by Quonfig: the logger category name is used as `loggerPath`, the requested level becomes `desired`, and the SDK answers with the current ruleset. (This is exactly how the [`test-net`](https://github.com/quonfig/test-net) sample wires it.) When you also use `Quonfig.Sdk.AspNetCore`, register the singleton as above and let `AddQuonfig(...)` mirror the same options — that way the `IHostedService` still drives `InitAsync`/`CloseAsync` on the instance you handed to the filter.

### Serilog integration

For Serilog, use `Quonfig.Sdk.Serilog`. The `QuonfigLoggingLevelSwitchProvider` manages a set of Serilog `LoggingLevelSwitch` instances keyed by source context and re-evaluates them whenever the config envelope changes (it subscribes to the SDK's `OnConfigChange`, which fires after every successful install).

```bash
dotnet add package Quonfig.Sdk.Serilog --version 0.0.1
```

The provider resolves levels via `IQuonfig.GetLogLevel(...)`, so the config key is configured by `LoggerKey` on the **client** options — you don't pass a key to the provider. `GetSwitch(category)` returns (and caches) the switch for a source context; pass an empty string for the root switch used by `MinimumLevel.ControlledBy`:

```csharp
using Serilog;
using Serilog.Events;
using Quonfig.Sdk.Serilog;

// `client` is a Quonfig instance whose options set LoggerKey = "log-level.my-app".
var levelSwitches = new QuonfigLoggingLevelSwitchProvider(
    client,
    defaultLevel: LogEventLevel.Information);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.ControlledBy(levelSwitches.GetSwitch(string.Empty)) // root switch
    .WriteTo.Console()
    .CreateLogger();
```

To control a specific source context, request its switch with `levelSwitches.GetSwitch("Acme.Web.Auth")` and apply it with `Serilog`'s `MinimumLevel.Override`. Every switch the provider hands out is refreshed automatically when the Quonfig config changes — no enricher or per-event hook required. Call `levelSwitches.Dispose()` on shutdown to unsubscribe from `OnConfigChange`.

### Rule example

Create a `log_level` config keyed `log-level.my-app` and target individual loggers via `quonfig-sdk-logging.key`:

```yaml
# Default to INFO for every logger in this app
default: INFO

rules:
  # Bump a subsystem to DEBUG
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "Acme.Web.Auth"
    value: DEBUG

  # Silence a chatty third-party package
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "Microsoft.AspNetCore.HostFiltering"
    value: ERROR

  # Turn DEBUG on for one developer, everywhere
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG
```

Because the evaluator sees your full context — global, bound, and the injected logger key — you can combine logger rules with user, environment, or request context to crank verbosity up for one user, one staging deploy, or one bad request, without touching anyone else.

### Manual gating

If you'd rather gate a single call site by hand instead of installing the filter, call `ShouldLog` directly. The `LogLevel` enum lives in `Quonfig.Sdk` (its values mirror `Microsoft.Extensions.Logging.LogLevel`).

```csharp
using Quonfig.Sdk;

if (client.ShouldLog("Acme.Web.AuthService", LogLevel.Debug))
{
    logger.LogDebug("expensive thing happened: {Description}", expensiveDescription());
}
```

## Health primitives

The client exposes two diagnostic surfaces useful for dashboards and structured logging:

```csharp
DateTimeOffset? lastRefresh = client.LastSuccessfulRefresh;
ConnectionState state       = client.ConnectionState;
// Initializing | Connected | Disconnected | FallingBack

client.OnConnectionStateChange += newState =>
    logger.LogInformation("Quonfig SSE state -> {State}", newState);
```

:::warning Do not use these as a Kubernetes liveness probe

The SDK is designed so that a transient delivery outage never affects your application: in-memory evaluation continues against the last-good envelope, and the Layer 2 fallback poller takes over if SSE stays down. Using `ConnectionState != Connected` as a liveness signal would restart healthy pods during a delivery hiccup — the opposite of what you want.

Use these primitives for telemetry, dashboards, and alerting on extended outages instead.

:::

## Telemetry

By default Quonfig uploads telemetry that powers the dashboard's evaluation counts, context-shape detection, and example-context capture. Tune or disable via `QuonfigOptions`:

| Name                          | Description                                                                                                                  | Default       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `CollectEvaluationSummaries`  | Send aggregate counts of config/flag evaluation results back to Quonfig.                                                     | `true`        |
| `ContextUploadMode`           | How named-context data is reported. One of `None`, `ShapesOnly` (names + types), or `PeriodicExample` (full sample, redacted). | `ShapesOnly`  |

```csharp
await using var client = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    SdkKey = "sdk-...",
    CollectEvaluationSummaries = true,
    ContextUploadMode = ContextUploadMode.ShapesOnly,
});
```

To turn telemetry off entirely, set both fields:

```csharp
new QuonfigOptions
{
    SdkKey = "sdk-...",
    CollectEvaluationSummaries = false,
    ContextUploadMode = ContextUploadMode.None,
};
```

`client.DisposeAsync()` (or `CloseAsync()`) stops the SSE client, fallback poller, datadir watcher, and telemetry reporter, and drains any pending telemetry before returning.

## Testing

`Quonfig` is a regular class with no static state. The cleanest way to unit-test code that reads configs is to point a `Quonfig` instance at a small datadir of test fixtures:

```csharp
await using var testClient = new Quonfig.Sdk.Quonfig(new QuonfigOptions
{
    Datadir = "TestData/quonfig-fixtures",
    Environment = "test",
    CollectEvaluationSummaries = false,
    ContextUploadMode = ContextUploadMode.None,
});
await testClient.InitAsync();
```

For finer-grained tests, mock `IQuonfig` (or `IBoundQuonfig`) with your favorite mocking library and stub the typed getters directly — both interfaces expose the full public surface.

## Troubleshooting

### `QuonfigInitTimeoutException` on startup

`InitAsync` waits up to `InitTimeout` (default 10s) for the first envelope. The most common causes:

- Network or DNS issue reaching `primary.quonfig.com` / `secondary.quonfig.com`. Verify `ApiUrls` and proxy settings.
- A wrong or revoked SDK key. The SDK uses the SDK key as the HTTP Basic-auth password; a 401 surfaces as init failure.
- A custom `HttpMessageHandler` is dropping the request. Confirm the handler forwards to a real network sink.

To soft-fail instead of throwing, set `OnInitFailure = OnInitFailure.ReturnDefaults`. Getters then serve caller-supplied defaults until the background fetch eventually succeeds.

### `QuonfigKeyNotFoundException` on a typed getter

The key isn't in the active envelope and you didn't pass a `defaultValue` while `OnNoDefault = Throw`. Either pass a default, switch `OnNoDefault` to `Warn` / `Ignore`, or check `client.Keys()` to confirm the key was loaded for the current `Environment`.

### Datadir mode loads zero keys

`Datadir` mode requires `Environment` to be set (on `QuonfigOptions` or via `QUONFIG_ENVIRONMENT`). The SDK reads the entire workspace tree but only the matching environment's rules are surfaced. Verify the workspace's `quonfig.json` lists your environment and that the JSON files live in the expected `configs/`, `feature-flags/`, `segments/`, `log-levels/` directories.

### SSE stays disconnected

Check `client.ConnectionState`. If you're seeing `FallingBack` for long stretches, the Layer 2 poller is keeping the cache fresh — your app is still serving correct values, but real-time updates are not flowing. Inspect logs for SSE reconnect attempts and verify `stream.primary.quonfig.com` is reachable from the deploy environment.

### `OnConnectionStateChange` doesn't fire

Subscribers run inline. If your handler throws, the SDK logs and swallows the exception — verify you're not throwing on the first invocation. Also confirm you subscribed before calling `InitAsync()`; the first transition (`Initializing → Connected`) happens during init.

## Reference

### QuonfigOptions

```csharp
using Quonfig.Sdk;

var options = new QuonfigOptions
{
    SdkKey = Environment.GetEnvironmentVariable("QUONFIG_BACKEND_SDK_KEY"),
    Environment = "production",
    GlobalContext = global,
    InitTimeout = TimeSpan.FromSeconds(10),
    OnInitFailure = OnInitFailure.Throw,
    OnNoDefault = OnNoDefault.Throw,
    LoggerKey = "log-level.my-app",
    CollectEvaluationSummaries = true,
    ContextUploadMode = ContextUploadMode.ShapesOnly,
};
```

#### Option Definitions

| Name                          | Description                                                                                                                                | Default                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `SdkKey`                      | Your Quonfig SDK key. Required for HTTP+SSE mode. Falls back to `QUONFIG_BACKEND_SDK_KEY` env var.                                         | (env var)                                                |
| `ApiUrls`                     | Ordered API base URLs (primary first, then failover).                                                                                       | `[primary.quonfig.com, secondary.quonfig.com]`           |
| `StreamUrls`                  | Ordered SSE stream base URLs.                                                                                                              | `[stream.primary.quonfig.com, stream.secondary.…]`       |
| `TelemetryUrl`                | Telemetry endpoint.                                                                                                                        | `https://telemetry.quonfig.com`                          |
| `Environment`                 | Environment name to evaluate against. Required in datadir mode. Falls back to `QUONFIG_ENVIRONMENT`.                                       | (env var)                                                |
| `Datadir`                     | Path to a Quonfig workspace directory. Switches the client to datadir mode (no HTTP fetch, no SSE).                                        | `null`                                                   |
| `Datafile`                    | Path to a serialized envelope file. Switches the client to datafile mode.                                                                  | `null`                                                   |
| `DatafileEnvelope`            | Pre-parsed envelope instance (mutually exclusive with `Datafile`).                                                                          | `null`                                                   |
| `DatadirAutoReload`           | Opt-in: watch `Datadir` for file changes and reload atomically.                                                                            | `false`                                                  |
| `DatadirAutoReloadDebounce`   | Debounce window when `DatadirAutoReload` is on.                                                                                            | `200ms`                                                  |
| `InitTimeout`                 | How long the initial fetch / load may take before `OnInitFailure` applies.                                                                 | `10s`                                                    |
| `OnInitFailure`               | `Throw` or `ReturnDefaults` when init exceeds `InitTimeout`.                                                                               | `Throw`                                                  |
| `OnNoDefault`                 | `Throw`, `Warn`, or `Ignore` when a getter has no value and no `defaultValue`.                                                             | `Throw`                                                  |
| `GlobalContext`               | A `ContextSet` merged into every evaluation as the base layer.                                                                             | `null`                                                   |
| `FallbackPollEnabled`         | Master switch for the Layer 2 fallback poller.                                                                                             | `true`                                                   |
| `FallbackPollInterval`        | Cadence between fallback fetches once engaged.                                                                                             | `60s`                                                    |
| `FallbackPollThreshold`       | SSE-down duration before Layer 2 engages.                                                                                                  | `120s`                                                   |
| `SseReadTimeout`              | Layer 1 SSE read watchdog. Pass `TimeSpan.Zero` to disable.                                                                                | `90s`                                                    |
| `LoggerKey`                   | Config key consulted by `ShouldLog(...)`. When set, enables single-config dispatch via injected `quonfig-sdk-logging.key`.                  | `null`                                                   |
| `CollectEvaluationSummaries`  | Send aggregate evaluation counts to Quonfig.                                                                                                | `true`                                                   |
| `ContextUploadMode`           | `None`, `ShapesOnly`, or `PeriodicExample`.                                                                                                | `ShapesOnly`                                             |
| `Logger`                      | Optional `ILogger`. Defaults to a no-op logger.                                                                                            | no-op                                                    |
| `HttpMessageHandler`          | Optional `HttpMessageHandler` for tests / DI. Ownership stays with the caller.                                                              | `null`                                                   |
| `EnvLookup`                   | Optional env-var lookup override (testability).                                                                                            | `Environment.GetEnvironmentVariable`                     |
