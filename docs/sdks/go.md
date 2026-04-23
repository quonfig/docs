---
title: Go
---

## Install the latest version

[Github](https://github.com/QuonfigHQ/sdk-go) | [pkg](https://pkg.go.dev/github.com/QuonfigHQ/sdk-go)


```bash
go get github.com/QuonfigHQ/sdk-go@latest
```

## Initialize Client

Add `quonfig "github.com/QuonfigHQ/sdk-go"` to your imports.

Then, initialize the client with your SDK key:

```go
sdk, err := quonfig.NewSdk(quonfig.WithSdkKey(sdkKey))
```

### Typical Usage

We recommend using the SDK client as a singleton in your application.

```go
import quonfig "github.com/QuonfigHQ/sdk-go"

var quonfigSdk quonfig.ClientInterface

func init() {
    // Note: WithSdkKey is not needed if QUONFIG_BACKEND_SDK_KEY env var is set
    sdk, err := quonfig.NewSdk()
    if err != nil {
        panic(err)
    }
    quonfigSdk = sdk
}
```

### API URLs

By default the SDK connects to `https://primary.quonfig.com` for config fetches
and automatically connects to `https://stream.primary.quonfig.com` for live SSE
updates — the stream URL is derived from each API URL by prepending `stream.`
to the hostname, so you don't configure it separately. A fallback
`secondary.quonfig.com` will be added to the default list once the fallback app
exists. Override the list with `WithAPIURLs`:

```go
sdk, err := quonfig.NewSdk(
    quonfig.WithSdkKey(sdkKey),
    quonfig.WithAPIURLs([]string{"https://primary.quonfig.com"}),
)
```

## Feature Flags

For boolean flags, you can use the `FeatureIsOn` function:

```go
enabled, ok := sdk.FeatureIsOn("my.feature.name", quonfig.ContextSet{})
```

Flags that don't exist yet are considered off, so you can happily add `FeatureIsOn` checks to your code before the flag is created.

<details className="alert--info">
<summary>
Feature flags don't have to return just true or false.
</summary>

You can get other data types using `Get*` functions:

```go
value, ok, err := sdk.GetStringValue("my.string.feature.name", quonfig.ContextSet{})
value, ok, err := sdk.GetJSONValue("my.json.feature.name", quonfig.ContextSet{})
```

</details>

## Context

Feature flags become more powerful when we give the flag evaluation rules more information to work with. We do this by providing [context](/docs/explanations/concepts/context) of the current user (and/or team, request, etc.)

### Global Context

When initializing the client, you can set a global context that will be used for all evaluations.

```go
globalContext := quonfig.NewContextSet().
    WithNamedContextValues("host", map[string]interface{}{
        "name": os.Getenv("HOSTNAME"),
        "region":   os.Getenv("REGION"),
        "cpu":      runtime.NumCPU(),
    })


sdk, err := quonfig.NewSdk(
    quonfig.WithSdkKey(sdkKey),
    quonfig.WithGlobalContext(globalContext),
)
```

Global context is the least specific context and will be overridden by more specific context passed in at the time of evaluation.

### Bound Context

To make the best use of Quonfig in a web setting, we recommend setting [context](/docs/explanations/concepts/context) per-request. Setting this context for the life-cycle of the request means the Quonfig logger can be aware of your user/etc. for feature flags and targeted log levels and you won't have to explicitly pass context into your `.FeatureIsOn` and `.Get*` calls.

```go
requestContext := quonfig.NewContextSet().
    WithNamedContextValues("user", map[string]interface{}{
        "name":  currentUser.GetName(),
        "email": currentUser.GetEmail(),
    })

boundSdk := sdk.WithContext(requestContext)
enabled, ok := boundSdk.FeatureIsOn("my.feature.name", quonfig.ContextSet{})
```

### Just-in-time Context

You can also pass context when evaluating individual flags or config values.

```go
enabled, ok := boundSdk.FeatureIsOn("my.feature.name", quonfig.NewContextSet().
    WithNamedContextValues("team", map[string]interface{}{
        "name":  currentTeam.GetName(),
        "email": currentTeam.GetEmail(),
    }))
```

## Dynamic Config

Config values are available via the `Get*` functions:

```go
value, ok, err := sdk.GetJSONValue("slack.bot.config", quonfig.ContextSet{})

value, ok, err := sdk.GetStringValue("some.string.config", quonfig.ContextSet{})

value, ok, err := sdk.GetFloatValue("some.float.config", quonfig.ContextSet{})
```

<details>
<summary>

#### Default Values for Configs

</summary>

Here we ask for the value of a config named `max-jobs-per-second`, and we specify `10` as a default value if no value is available.

```go
value, wasFound := sdk.GetIntValueWithDefault("max-jobs-per-second", 10, quonfig.ContextSet{})
```

If `max-jobs-per-second` is available, `wasFound` will be `true` and `value` will be the value of the config. If `max-jobs-per-second` is not available, `wasFound` will be `false` and `value` will be `10`.

</details>

## Dynamic Log Levels

Log levels in Quonfig are stored as a `log_level` config (e.g. `log-level.my-app`). The SDK consults that config on every log call, so changes made in Quonfig take effect immediately via SSE with no polling or restart.

### Concept

- One `log_level` config per app, keyed like `log-level.my-app`. Value is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`.
- Tell the client which config to consult with `WithLoggerKey(...)`.
- `ShouldLogPath(loggerPath, desiredLevel, ctx)` pushes `loggerPath` into the evaluation context as `quonfig-sdk-logging.key` (verbatim — no normalization) so a single config can drive per-logger rules.
- The `ShouldLog(configKey, desiredLevel, ctx)` primitive is also available when you want to evaluate a specific config without the convenience layer.
- Logger names flowing through `quonfig-sdk-logging.key` are auto-captured by example-context telemetry, so the dashboard can auto-suggest rule targets.

### Basic usage

```go
import (
    "log/slog"
    "os"
    quonfig "github.com/QuonfigHQ/sdk-go"
)

client, _ := quonfig.NewClient(
    quonfig.WithSdkKey("your-key"),
    quonfig.WithLoggerKey("log-level.my-app"),
)

if client.ShouldLogPath("com.example.auth", "DEBUG", nil) {
    // …
}
```

### Rule example

Create a `log_level` config with key `log-level.my-app` and target individual loggers via `quonfig-sdk-logging.key`:

```yaml
# Default to INFO for every logger in this app
default: INFO

rules:
  # Bump a subsystem to DEBUG
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "com.example.auth"
    value: DEBUG

  # Silence a chatty third-party package
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "github.com/somelib"
    value: ERROR

  # Turn DEBUG on for one developer, everywhere
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG
```

Because the evaluator sees your full context — global context set via `WithGlobalContext`, per-call context passed into `ShouldLogPath`, and `quonfig-sdk-logging.key` — you can combine logger rules with user, environment, or request context to crank verbosity up for one user, one staging deploy, or one bad request, without touching anyone else.

### slog handler

The SDK ships a `slog.Handler` that wraps any inner handler and gates each record through `ShouldLogPath`:

```go
import (
    "log/slog"
    "os"
    quonfig "github.com/QuonfigHQ/sdk-go"
)

client, _ := quonfig.NewClient(
    quonfig.WithSdkKey("your-key"),
    quonfig.WithLoggerKey("log-level.my-app"),
)

inner := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
handler := quonfig.NewQuonfigHandler(client, inner, "com.example.auth")
logger := slog.New(handler)

logger.Debug("debug line")
logger.Info("info line")
```

If you'd rather let slog drive the level decision itself, use `QuonfigLeveler`:

```go
leveler := quonfig.NewQuonfigLeveler(client, "com.example.auth")
handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: leveler,
})
logger := slog.New(handler)
```

### Attaching per-request context

Both `NewQuonfigHandler` and `NewQuonfigLeveler` read any `*ContextSet` attached to the `context.Context` passed through slog, so per-request user/team context flows into rule evaluation:

```go
cs := quonfig.NewContextSet()
cs.WithNamedContextValues("user", map[string]interface{}{
    "email": "developer@example.com",
})
ctx := quonfig.ContextWithContextSet(context.Background(), cs)

logger.DebugContext(ctx, "debug line — evaluated with user context")
```

### Reference

| Name                                          | Example                                                                              | Description                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `WithLoggerKey(key)`                          | `quonfig.WithLoggerKey("log-level.my-app")`                                          | Tells the client which `log_level` config `ShouldLogPath` and the slog adapter should consult. Required for either.           |
| `ShouldLogPath(loggerPath, desiredLevel, ctx)`| `client.ShouldLogPath("com.example.auth", "DEBUG", nil)`                             | Convenience. Uses `LoggerKey` + injects `quonfig-sdk-logging.key = loggerPath` so rules can target individual loggers.        |
| `ShouldLog(configKey, desiredLevel, ctx)`     | `client.ShouldLog("log-level.my-app", "DEBUG", nil)`                                 | Primitive. Evaluates the named config directly — no auto-injection. Use when building a custom adapter.                       |
| `NewQuonfigHandler(client, inner, loggerPath)`| `slog.New(quonfig.NewQuonfigHandler(client, inner, "com.example.auth"))`             | `slog.Handler` that gates each record through `ShouldLogPath`.                                                                |
| `NewQuonfigLeveler(client, loggerPath)`       | `slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: leveler})`               | `slog.Leveler` backed by Quonfig. Use when you want slog's own enabled-check path to see the dynamic level.                   |
| `ContextWithContextSet(ctx, cs)`              | `ctx := quonfig.ContextWithContextSet(ctx, cs)`                                      | Attach a `*ContextSet` to a `context.Context` so the slog adapter picks it up on each record.                                 |

## Telemetry

By default, Quonfig uploads telemetry that enables a number of useful features. You can alter or disable this behavior using the following options:

| Name                       | Description                                                                                                                           | Default          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| collectEvaluationSummaries | Send counts of config/flag evaluation results back to Quonfig to view in web app                                                       | true             |
| contextTelemetryMode       | Upload either context "shapes" (the names and data types your app uses in Quonfig contexts) or periodically send full example contexts | PERIODIC_EXAMPLE |

If you want to change any of these options, you can pass options when initializing the Quonfig SDK:

```go
sdk, err := quonfig.NewSdk(
    quonfig.WithSdkKey(sdkKey),
    quonfig.WithCollectEvaluationSummaries(true),
    quonfig.WithContextTelemetryMode(quonfig.ContextTelemetryMode.PeriodicExample),
)
```

Available context telemetry modes:
- `quonfig.ContextTelemetryMode.None` - Don't upload any context information
- `quonfig.ContextTelemetryMode.Shapes` - Upload only context shapes (names and data types)
- `quonfig.ContextTelemetryMode.PeriodicExample` - Periodically send full example contexts (default)

To disable all telemetry at once:

```go
sdk, err := quonfig.NewSdk(
    quonfig.WithAllTelemetryDisabled(),
)
```

## Offline and Testing Modes

### Offline Sources (Datafiles)

For offline development, testing, or air-gapped environments, you can use datafiles instead of connecting to the Quonfig API. See [Testing with DataFiles](/docs/explanations/concepts/testing#testing-with-datafiles) for more information on generating and using datafiles.

When using offline sources, you must provide the `WithProjectEnvID` to identify which environment's configuration you're using:

```go
sdk, err := quonfig.NewSdk(
    quonfig.WithProjectEnvID(123456789), // Your project environment ID
    quonfig.WithOfflineSources([]string{
        "datafile:///path/to/your/datafile.json",
    }),
)
```

**Important notes:**
- `WithOfflineSources` excludes the default API and SSE sources - the SDK will only use the sources you specify
- Telemetry is automatically disabled when using offline sources
- You can find your project environment ID in the Quonfig UI or from your datafile metadata

### In-Memory Configs (Testing)

If you need to test multiple scenarios that depend on a single config or feature key, you can set up an SDK with in-memory configs:

```go
configs := map[string]interface{}{
	"string.key": "value",
	"int.key":    int64(42),
	"bool.key":   true,
	"float.key":  3.14,
	"slice.key":  []string{"a", "b", "c"},
	"json.key": map[string]interface{}{
		"nested": "value",
	},
}

client, err := quonfig.NewSdk(quonfig.WithConfigs(configs))
```

## Reference

### Options

```go
client, err := quonfig.NewSdk(
    quonfig.WithSdkKey(os.Getenv("QUONFIG_SDK_KEY")), // or use QUONFIG_BACKEND_SDK_KEY env var
    quonfig.WithGlobalContext(globalContext),
    quonfig.WithCollectEvaluationSummaries(true),
    quonfig.WithContextTelemetryMode(quonfig.ContextTelemetryMode.PeriodicExample),
)
```

#### Option Definitions

| Name                           | Description                                                                                                                           | Default          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| WithSdkKey                     | Your Quonfig SDK key (not needed if QUONFIG_BACKEND_SDK_KEY env var is set)                                                           | from env var     |
| WithAPIURLs                    | Ordered list of API base URLs. SSE URL is derived by prepending `stream.` to the hostname                                             | `["https://primary.quonfig.com"]` |
| WithProjectEnvID               | Project environment ID (required when using WithOfflineSources)                                                                       | nil              |
| WithOfflineSources             | Use offline data sources (datafiles) instead of API/SSE. Automatically disables telemetry. Requires WithProjectEnvID                  | nil              |
| WithGlobalContext              | Set a static context to be used as the base layer in all configuration evaluation                                                     | empty            |
| WithCollectEvaluationSummaries | Send counts of config/flag evaluation results back to Quonfig to view in web app                                                      | true             |
| WithContextTelemetryMode       | Upload either context "shapes" (the names and data types your app uses in Quonfig contexts) or periodically send full example contexts | PERIODIC_EXAMPLE |
| WithAllTelemetryDisabled       | Disable all telemetry (evaluation summaries and context telemetry)                                                                    | n/a              |
| WithConfigs                    | Provide in-memory configs for testing                                                                                                 | nil              |
| WithOnInitializationFailure    | Choose to crash or continue with local data only if unable to fetch config data from Quonfig at startup                               | RAISE (crash)    |
| WithInitializationTimeoutSeconds | Timeout for initial config fetch                                                                                                    | 10               |
| WithLoggerKey                  | The `log_level` config key consulted by `ShouldLogPath` and the slog adapter. No default — set it to enable the `loggerPath` convenience. | `""`             |
