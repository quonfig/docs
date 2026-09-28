---
title: .NET (OpenFeature)
---

[OpenFeature](https://openfeature.dev) is a CNCF standard for feature flag evaluation.
`Quonfig.OpenFeature.ServerProvider` is a thin provider that wraps the native `Quonfig.Sdk`
.NET SDK and implements the OpenFeature .NET `FeatureProvider`. It targets `net8.0`.

## Install

```bash
dotnet add package Quonfig.OpenFeature.ServerProvider
dotnet add package OpenFeature
```

The provider brings in `Quonfig.Sdk` as a transitive dependency.

## Initialize

```csharp
using OpenFeature;
using OpenFeature.Model;
using Quonfig.OpenFeature.ServerProvider;

var provider = new QuonfigProvider(new QuonfigProviderOptions
{
    SdkKey = "qf_sk_production_...",
});

// SetProviderAsync awaits the provider's initialization.
await Api.Instance.SetProviderAsync(provider);

var client = Api.Instance.GetClient();
```

## Evaluate flags

```csharp
// Boolean flag
bool enabled = await client.GetBooleanValueAsync("checkout-v2", false);

// String config
string welcome = await client.GetStringValueAsync("welcome-message", "Hello!");

// Integer config
int seats = await client.GetIntegerValueAsync("max-seats", 5);

// Double config
double limit = await client.GetDoubleValueAsync("upload-limit-gb", 1.0);

// Object config (JSON or string_list)
Value allowedPlans = await client.GetObjectValueAsync("allowed-plans", new Value());
```

Use the `Get*DetailsAsync` variants (for example `GetBooleanDetailsAsync`) to read the
reason, variant and error type alongside the value.

## Evaluation context

Pass per-request context as an `EvaluationContext`:

```csharp
var ctx = EvaluationContext.Builder()
    .SetTargetingKey("user-123")          // maps to user.id by default
    .Set("user.plan", new Value("pro"))
    .Set("org.tier", new Value("enterprise"))
    .Build();

bool isPro = await client.GetBooleanValueAsync("pro-feature", false, ctx);
```

OpenFeature context is flat; Quonfig context is namespace-nested. The provider maps
between them using dot-notation:

| OpenFeature key | Quonfig namespace | Quonfig property |
|----------------|-------------------|-----------------|
| `targetingKey` | `user` | `id` (configurable) |
| `"user.email"` | `user` | `email` |
| `"org.tier"` | `org` | `tier` |
| `"country"` (no dot) | `""` (default) | `country` |
| `"user.ip.address"` | `user` | `ip.address` (split on first dot) |

### Custom targetingKey mapping

```csharp
var provider = new QuonfigProvider(new QuonfigProviderOptions
{
    SdkKey = "qf_sk_...",
    TargetingKeyMapping = "org.id",
});
```

## Local / offline mode

Use `Datadir` instead of `SdkKey` to evaluate against a Quonfig workspace on disk:

```csharp
var provider = new QuonfigProvider(new QuonfigProviderOptions
{
    Datadir = "/path/to/workspace",
    Environment = "Production",
});
```

## Configuring the underlying client

`ConfigureClient` lets you adjust the `Quonfig.Sdk` `QuonfigOptions` before the client is
built, for any option the provider does not expose directly:

```csharp
var provider = new QuonfigProvider(new QuonfigProviderOptions
{
    SdkKey = "qf_sk_...",
    ConfigureClient = o => o.LoggerKey = "log-level.my-app",
});
```

## Lifecycle events

The provider emits standard OpenFeature provider events:

- `PROVIDER_READY` after `InitializeAsync` succeeds.
- `PROVIDER_ERROR` if initialization fails.
- `PROVIDER_CONFIGURATION_CHANGED` on every config refresh after the provider is ready (SSE,
  fallback poll, or datadir watcher).
- `PROVIDER_STALE` is not emitted.

```csharp
using OpenFeature.Constant;

Api.Instance.AddHandler(ProviderEventTypes.ProviderReady, details =>
    Console.WriteLine("Quonfig provider ready"));

Api.Instance.AddHandler(ProviderEventTypes.ProviderConfigurationChanged, details =>
    Console.WriteLine("Config updated"));
```

## Reasons and errors

Evaluation never throws. On an error you get your default value back, with an `ErrorType`
set on the resolution details.

- Reasons pass through from the SDK: `STATIC`, `TARGETING_MATCH`, `SPLIT`, `DEFAULT`
  (anything else becomes `UNKNOWN`).
- A missing flag returns reason `DEFAULT` with `FLAG_NOT_FOUND`. Other errors
  (`TYPE_MISMATCH`, `GENERAL`) return reason `ERROR`.
- Calls made before the provider is initialized return the default with
  `PROVIDER_NOT_READY`.

## Native SDK escape hatch

`provider.GetClient()` returns the underlying `Quonfig.Sdk.IQuonfig` client for features
not available in OpenFeature. It returns `null` until the provider has been initialized.

```csharp
var native = provider.GetClient();

// Parsed duration values
TimeSpan? ttl = native?.GetDuration("cache.ttl");

// 64-bit integer values
long? big = native?.GetLong("events.max-offset");

// Log level integration
bool shouldLog = native?.ShouldLog("MyApp.Auth", Quonfig.Sdk.LogLevel.Debug) ?? true;

// List all config keys
var keys = native?.Keys();
```

## What you lose vs. the native SDK

OpenFeature is designed for feature flags, not general configuration. Some Quonfig
features require the native `Quonfig.Sdk` directly:

1. **Log levels** -- `ShouldLog()` and `GetLogLevel()` are native-only; use `provider.GetClient()`.
2. **`string_list` configs** -- returned as a list `Value` via `GetObjectValueAsync()`.
3. **`duration` configs** -- returned as an ISO 8601 string (e.g. `"PT1M30S"`) via `GetStringValueAsync()`; use `GetClient().GetDuration()` for a `TimeSpan`.
4. **64-bit integers** -- `GetIntegerValueAsync()` returns `int`; use `GetClient().GetLong()` for `long`.
5. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
6. **`Keys()`** and raw config access -- use `provider.GetClient()`.
7. **Context keys use dot-notation** -- pass `"user.email"`, not nested objects.
8. **`targetingKey` maps to `user.id` by default** -- configure `TargetingKeyMapping` if different.
