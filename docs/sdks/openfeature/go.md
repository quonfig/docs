---
title: Go (OpenFeature)
---

`github.com/quonfig/openfeature-go/v2` is an OpenFeature provider for Go server
applications. It wraps `github.com/quonfig/sdk-go/v2` and implements the
`github.com/open-feature/go-sdk` `FeatureProvider` interface.

## Install

```bash
go get github.com/quonfig/openfeature-go/v2
go get github.com/open-feature/go-sdk
```

## Initialize

```go
import (
    "context"
    "log"

    openfeaturego "github.com/quonfig/openfeature-go/v2"
    "github.com/open-feature/go-sdk/openfeature"
)

func main() {
    provider := openfeaturego.NewQuonfigProvider(openfeaturego.Options{
        SDKKey: "qf_sk_production_...",
    })

    if err := openfeature.SetProviderAndWait(provider); err != nil {
        log.Fatal(err)
    }

    client := openfeature.NewDefaultClient()
    ctx := context.Background()

    enabled, _ := client.BooleanValue(ctx, "checkout-v2", false, openfeature.EvaluationContext{})
    log.Println("checkout-v2:", enabled)
}
```

:::note If Quonfig is unreachable at startup
`Init` (run by `SetProviderAndWait`) waits for the first config, up to the
client's init timeout (default 10s). By default it then returns a
`*quonfig.InitError`, the provider goes to `ERROR`, and the `log.Fatal` above
fires. To wait or to start on code defaults instead, pass sdk-go options
through `AdditionalOptions`:

```go
import (
    "time"

    quonfig "github.com/quonfig/sdk-go/v2"
    openfeaturego "github.com/quonfig/openfeature-go/v2"
)

provider := openfeaturego.NewQuonfigProvider(openfeaturego.Options{
    SDKKey: "qf_sk_production_...",
    AdditionalOptions: []quonfig.Option{
        quonfig.WithOnInitFailure(quonfig.InitFailureContinue), // default: InitFailureFail
        quonfig.WithInitTimeout(5 * time.Second),
    },
})
```

| `onInitFailure` | `Init` | Provider status | When config arrives |
|---|---|---|---|
| `InitFailureFail` (default) | Returns `*quonfig.InitError` | `ERROR` | No client exists, so nothing retries. Register the provider again or restart. |
| `InitFailureWait` | Blocks until the first config | `NOT_READY`; evaluations return the default with `PROVIDER_NOT_READY` | `Init` returns; `READY` |
| `InitFailureContinue` | Returns `nil`, then emits `PROVIDER_ERROR` | `ERROR`; evaluations return the default with `PROVIDER_NOT_READY` | The client keeps retrying; the provider emits `PROVIDER_READY` |

See [If Quonfig Is Unreachable at Startup](/docs/explanations/architecture/startup-failure).
:::

## Evaluate flags

```go
// Inside main, using client and ctx from above.

// Boolean flag
enabled, err := client.BooleanValue(ctx, "checkout-v2", false, openfeature.EvaluationContext{})

// String config
label, err := client.StringValue(ctx, "cta-label", "Get started", openfeature.EvaluationContext{})

// Integer config
seats, err := client.IntValue(ctx, "max-seats", 5, openfeature.EvaluationContext{})

// Float config
limit, err := client.FloatValue(ctx, "upload-limit-gb", 1.0, openfeature.EvaluationContext{})

// Object config (JSON or string_list)
details, err := client.ObjectValue(ctx, "plan-config", map[string]any{}, openfeature.EvaluationContext{})
```

### Type mapping

| Quonfig type | OpenFeature method | Notes |
|-------------|--------------------|-------|
| `bool` | `BooleanValue` | Direct |
| `string` | `StringValue` | Direct |
| `int` | `IntValue` | Returns `int64` |
| `double` | `FloatValue` | Returns `float64` |
| `string_list` | `ObjectValue` | Returns `[]any` |
| `json` | `ObjectValue` | Returns parsed JSON |
| `duration` | `StringValue` | Returns the ISO 8601 string (e.g. `"PT90S"`); use the native client for `time.Duration` |
| `log_level` | N/A | Native SDK only |

Reading a config with the method for another type returns your default with a
`TYPE_MISMATCH` error; values are never coerced (a string `"false"` is not a
bool). The only conversions are `int` to `FloatValue`, and a whole `double`
within ±(2^53-1) to `IntValue` (`3.9` is a type mismatch, never truncated). A
value of the right type that does not parse (a stored int `"twelve"`, a
duration such as `"30s"`, or an ENV_VAR that cannot be converted) returns your
default with `PARSE_ERROR`. The rules come from the native SDK; see
[Typed Getters, Defaults, and Error Codes](/docs/explanations/concepts/typed-getters).

## Evaluation context

Pass per-request context as an `EvaluationContext`:

```go
evalCtx := openfeature.NewEvaluationContext(
    "user-123",                     // targetingKey -> user.id by default
    map[string]any{
        "user.email": "alice@co.com",
        "org.tier":   "enterprise",
    },
)

enabled, err := client.BooleanValue(ctx, "pro-feature", false, evalCtx)
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

```go
provider := openfeaturego.NewQuonfigProvider(openfeaturego.Options{
    SDKKey:              "qf_sk_...",
    TargetingKeyMapping: "org.id",
})
```

## Local / offline mode

Load config from a local directory without a running server:

```go
provider := openfeaturego.NewQuonfigProvider(openfeaturego.Options{
    DataDir:     "/path/to/workspace",
    Environment: "production",
})
```

## Native SDK escape hatch

```go
native := provider.GetClient()

// Log level integration — pass the full stored key, no auto-prefix
shouldLog := native.ShouldLog("log-level.auth", "DEBUG", nil)
```

## What you lose vs. the native SDK

1. **Log levels** -- `ShouldLog()` is native-only; access via `provider.GetClient()`.
2. **`string_list` configs** -- returned as `[]any` via `ObjectValue()`.
3. **`duration` configs** -- returned as ISO 8601 string via `StringValue()`.
4. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
5. **Listing keys** -- use `provider.GetClient().Keys()`.
6. **Context keys use dot-notation** -- pass `"user.email"`, not a nested struct.
