---
title: Go (OpenFeature)
---

`github.com/quonfig/openfeature-go` is an OpenFeature provider for Go server
applications. It wraps `github.com/quonfig/sdk-go` and implements the
`github.com/open-feature/go-sdk` `FeatureProvider` interface.

## Install

```bash
go get github.com/quonfig/openfeature-go
go get github.com/open-feature/go-sdk
```

## Initialize

```go
import (
    openfeaturego "github.com/quonfig/openfeature-go"
    "github.com/open-feature/go-sdk/openfeature"
    "log"
)

func main() {
    provider := openfeaturego.NewQuonfigProvider(openfeaturego.Options{
        SDKKey: "qf_sk_production_...",
    })

    if err := openfeature.SetProviderAndWait(provider); err != nil {
        log.Fatal(err)
    }

    client := openfeature.NewDefaultClient()
}
```

## Evaluate flags

```go
ctx := context.Background()

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

// Log level integration
shouldLog := native.ShouldLog(quonfig.LogLevelCheck{
    LoggerName:   "auth",
    DesiredLevel: "DEBUG",
})
```

## What you lose vs. the native SDK

1. **Log levels** -- `ShouldLog()` is native-only; access via `provider.GetClient()`.
2. **`string_list` configs** -- returned as `[]any` via `ObjectValue()`.
3. **`duration` configs** -- returned as ISO 8601 string via `StringValue()`.
4. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
5. **Listing keys** -- use `provider.GetClient().Keys()`.
6. **Context keys use dot-notation** -- pass `"user.email"`, not a nested struct.
