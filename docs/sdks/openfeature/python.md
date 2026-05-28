---
title: Python (OpenFeature)
---

[OpenFeature](https://openfeature.dev) is a CNCF standard for feature flag evaluation.
`quonfig-openfeature` is a thin provider that wraps the `quonfig` native SDK and
implements the OpenFeature Python server-side `AbstractProvider` interface.

## Install

```bash
pip install quonfig-openfeature quonfig openfeature-sdk
```

## Initialize

```python
from openfeature import api
from quonfig_openfeature import QuonfigProvider

provider = QuonfigProvider(
    sdk_key="qf_sk_production_...",
)

api.set_provider(provider)
client = api.get_client()
```

## Evaluate flags

```python
# Boolean flag
enabled = client.get_boolean_value("checkout-v2", False)

# String config
welcome = client.get_string_value("welcome-message", "Hello!")

# Integer config
timeout_ms = client.get_integer_value("request-timeout-ms", 5000)

# Float config
upload_limit = client.get_float_value("upload-limit-gb", 1.0)

# Object config (JSON or string_list)
allowed_plans = client.get_object_value("allowed-plans", [])
```

## Evaluation context

Pass per-request context as the third argument:

```python
from openfeature.evaluation_context import EvaluationContext

is_pro = client.get_boolean_value(
    "pro-feature",
    False,
    EvaluationContext(
        targeting_key="user-123",          # maps to user.id by default
        attributes={
            "user.plan": "pro",
            "org.tier": "enterprise",
        },
    ),
)
```

OpenFeature context is flat; Quonfig context is namespace-nested. The provider maps
between them using dot-notation:

| OpenFeature key | Quonfig namespace | Quonfig property |
|----------------|-------------------|-----------------|
| `targeting_key` | `user` | `id` (configurable) |
| `"user.email"` | `user` | `email` |
| `"org.tier"` | `org` | `tier` |
| `"country"` (no dot) | `""` (default) | `country` |
| `"user.ip.address"` | `user` | `ip.address` (split on first dot) |

### Custom targeting_key mapping

```python
provider = QuonfigProvider(
    sdk_key="qf_sk_...",
    targeting_key_mapping="account.id",
)
```

## Native SDK escape hatch

Access the underlying `quonfig` client for features not available in OpenFeature:

```python
native = provider.get_client()

# Log level integration — pass the full stored key
should_log = native.should_log(
    config_key="log-level.auth",
    desired_level="DEBUG",
    contexts={"user": {"id": "user-123"}},
)

# List all config keys
keys = native.keys()
```

## What you lose vs. the native SDK

OpenFeature is designed for feature flags, not general configuration. Some Quonfig
features require the native `quonfig` SDK directly:

1. **Log levels** -- `should_log()` is native-only; access via `provider.get_client()`.
2. **`string_list` configs** -- must be accessed via `get_object_value()` and used as a `list[str]`.
3. **`duration` configs** -- returned as raw float seconds via `get_float_value()` (or use `get_duration()` natively).
4. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
5. **`keys()` and raw config access** -- native-only via `provider.get_client()`.
6. **Context keys use dot-notation** -- pass `"user.email"`, not nested dicts.
7. **`targeting_key` maps to `user.id` by default** -- configure `targeting_key_mapping` if different.
