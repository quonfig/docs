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

Quonfig provides real-time dynamic log level control for popular Go logging libraries. When you change a log level in Quonfig, it takes effect immediately in your application via SSE without any polling or restarts.

### Standard Library (slog)

The SDK includes built-in support for Go's standard library `log/slog` package with no additional dependencies:

```go
import (
    "log/slog"
    "os"
    quonfig "github.com/QuonfigHQ/sdk-go"
)

sdk, _ := quonfig.NewSdk(quonfig.WithSdkKey("your-key"))

// Create a Quonfig handler that wraps your base handler
baseHandler := slog.NewJSONHandler(os.Stdout, nil)
handler := quonfig.NewQuonfigHandler(sdk, baseHandler, "com.example.myapp")
logger := slog.New(handler)

// Log levels are controlled dynamically by Quonfig
logger.Debug("Debug message")
logger.Info("Info message")
logger.Error("Error message")
```

Alternatively, use `QuonfigLeveler` with `HandlerOptions`:

```go
leveler := quonfig.NewQuonfigLeveler(sdk, "com.example.myapp")
handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: leveler,
})
logger := slog.New(handler)
```

### Third-Party Logger Integrations

Quonfig provides optional integrations for popular third-party logging libraries. These are available as separate modules to keep the main SDK dependency-free:

#### Zap

```bash
go get github.com/QuonfigHQ/sdk-go/integrations/zap
```

```go
import (
    quonfig "github.com/QuonfigHQ/sdk-go"
    quonfigzap "github.com/QuonfigHQ/sdk-go/integrations/zap"
    "go.uber.org/zap"
)

sdk, _ := quonfig.NewSdk(quonfig.WithSdkKey("your-key"))

// Option 1: Using IncreaseLevel
dynamicLevel := quonfigzap.NewQuonfigZapLevel(sdk, "com.example.myapp")
logger, _ := zap.NewProduction(zap.IncreaseLevel(dynamicLevel))

// Option 2: Using custom core
encoder := zapcore.NewJSONEncoder(zap.NewProductionEncoderConfig())
core := quonfigzap.NewQuonfigZapCore(
    zapcore.NewCore(encoder, zapcore.AddSync(os.Stdout), zapcore.DebugLevel),
    sdk,
    "com.example.myapp",
)
logger := zap.New(core)
```

[View zap integration docs on GitHub](https://github.com/QuonfigHQ/sdk-go/tree/main/integrations/zap)

#### Zerolog

```bash
go get github.com/QuonfigHQ/sdk-go/integrations/zerolog
```

```go
import (
    quonfig "github.com/QuonfigHQ/sdk-go"
    quonfigzerolog "github.com/QuonfigHQ/sdk-go/integrations/zerolog"
    "github.com/rs/zerolog"
)

sdk, _ := quonfig.NewSdk(quonfig.WithSdkKey("your-key"))
hook := quonfigzerolog.NewQuonfigZerologHook(sdk, "com.example.myapp")
logger := zerolog.New(os.Stdout).Hook(hook).With().Timestamp().Logger()
```

[View zerolog integration docs on GitHub](https://github.com/QuonfigHQ/sdk-go/tree/main/integrations/zerolog)

#### Charmbracelet Log

```bash
go get github.com/QuonfigHQ/sdk-go/integrations/charmbracelet
```

```go
import (
    quonfig "github.com/QuonfigHQ/sdk-go"
    charmbracelet "github.com/QuonfigHQ/sdk-go/integrations/charmbracelet"
    "github.com/charmbracelet/log"
)

sdk, _ := quonfig.NewSdk(quonfig.WithSdkKey("your-key"))
baseLogger := log.New(os.Stdout)
logger := charmbracelet.NewQuonfigCharmLogger(sdk, baseLogger, "com.example.myapp")
```

[View charmbracelet integration docs on GitHub](https://github.com/QuonfigHQ/sdk-go/tree/main/integrations/charmbracelet)

### Configuration

Create a `LOG_LEVEL_V2` config in your Quonfig dashboard with key `log-levels`:

```yaml
# Default to INFO for all loggers
default: INFO

# Set specific packages to DEBUG
rules:
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "com.example.services"
    value: DEBUG

  # Only log errors in noisy third-party library
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "github.com/somelib"
    value: ERROR
```

You can customize the config key name using the `WithLoggerKey` option. This is useful if you have multiple applications sharing the same Quonfig project and want to isolate log level configuration per application:

```go
sdk, _ := quonfig.NewSdk(
    quonfig.WithSdkKey("your-key"),
    quonfig.WithLoggerKey("myapp.log.levels"),
)
```

The SDK automatically includes `lang: "go"` in the evaluation context, which you can use in your rules to create Go-specific log level configurations:

```yaml
# Different log levels for Go vs other languages
rules:
  - criteria:
      quonfig-sdk-logging.lang: go
      quonfig-sdk-logging.logger-path:
        starts-with: "com.example"
    value: DEBUG

  - criteria:
      quonfig-sdk-logging.lang: java
      quonfig-sdk-logging.logger-path:
        starts-with: "com.example"
    value: INFO
```

### Targeted Log Levels

You can use [rules and segmentation](/docs/explanations/features/rules-and-segmentation) to change your log levels based on the current user/request/device context. This allows you to increase log verbosity for specific users, environments, or conditions without affecting your entire application.

The log level evaluation has access to **all context** that is available during evaluation, not just the `quonfig-sdk-logging` context. This means you can create rules combining:

- **SDK logging context** (`quonfig-sdk-logging.*`) - Logger name and language
- **Global context** - Application name, environment, availability zone, etc.
- **Dynamic context** - User, team, device, request information from bound or just-in-time context

For example, you can create rules like:

```yaml
# Enable DEBUG logs only for specific application in staging
rules:
  - criteria:
      application.key: "myapp"
      application.environment: "staging"
      quonfig-sdk-logging.logger-path:
        starts-with: "com.example"
    value: DEBUG

  # Enable DEBUG logs for a specific user across all applications
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG

  # Lower verbosity in production
  - criteria:
      application.environment: "production"
    value: WARN
```

This allows you to increase log verbosity for specific users, specific applications, particular environments, or any combination of conditions without affecting your entire system.

### How It Works

All logger integrations check Quonfig configuration **on every log call** for real-time updates. When you change a log level in Quonfig, it takes effect immediately via SSE without any polling or manual refresh. Different components can have different log levels using different logger names.

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
| WithLoggerKey                  | Config key for LOG_LEVEL_V2 configuration                                                                                            | log-levels       |
