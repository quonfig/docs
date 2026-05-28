---
title: Ruby (OpenFeature)
---

[OpenFeature](https://openfeature.dev) is a CNCF standard for feature flag evaluation.
`quonfig-openfeature` is a thin provider that wraps the `quonfig` native Ruby SDK and
implements the `OpenFeature::SDK::Provider` contract.

## Install

```bash
gem install quonfig-openfeature openfeature-sdk quonfig
```

Or with Bundler:

```ruby
gem 'quonfig-openfeature'
gem 'openfeature-sdk'
gem 'quonfig'
```

## Initialize

```ruby
require 'quonfig/openfeature'
require 'open_feature/sdk'

provider = Quonfig::OpenFeature::Provider.new(
  sdk_key: 'qf_sk_production_...'
)

OpenFeature::SDK.set_provider_and_wait(provider)

client = OpenFeature::SDK.build_client
```

## Evaluate flags

```ruby
# Boolean flag
enabled = client.fetch_boolean_value(flag_key: 'checkout-v2', default_value: false)

# String config
welcome = client.fetch_string_value(flag_key: 'welcome-message', default_value: 'Hello!')

# Number config (Integer or Float)
timeout = client.fetch_number_value(flag_key: 'request-timeout-ms', default_value: 5000)

# Object config (JSON or string_list)
allowed_plans = client.fetch_object_value(flag_key: 'allowed-plans', default_value: [])
```

## Evaluation context

Pass per-request context via `EvaluationContext`:

```ruby
ctx = OpenFeature::SDK::EvaluationContext.new(
  targeting_key: 'user-123',   # maps to user.id by default
  'user.plan'   => 'pro',
  'org.tier'    => 'enterprise'
)

is_pro = client.fetch_boolean_value(
  flag_key: 'pro-feature',
  default_value: false,
  evaluation_context: ctx
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

```ruby
provider = Quonfig::OpenFeature::Provider.new(
  sdk_key: 'qf_sk_...',
  targeting_key_mapping: 'account.id'
)
```

## Local / offline mode

Evaluate against a Quonfig workspace on disk -- no network or SDK key required.
This is the same layout the integration test suite uses.

```ruby
provider = Quonfig::OpenFeature::Provider.new(
  datadir:     '/path/to/workspace',
  environment: 'Production',
  enable_sse:  false
)
```

## Native SDK escape hatch

Access the underlying `Quonfig::Client` for features not available in OpenFeature:

```ruby
native = provider.client

# Log level integration
native.should_log?(
  logger_path:   'auth',
  desired_level: :debug,
  contexts:      { 'user' => { 'id' => 'user-123' } }
)

# List all config keys
keys = native.keys

# Per-request bound client
native.with_context('user' => { 'plan' => 'pro' }) do |bound|
  bound.get_bool('pro-feature')
end
```

## What you lose vs. the native SDK

OpenFeature is designed for feature flags, not general configuration. Some Quonfig
features require the native `quonfig` SDK directly:

1. **Log levels** -- `should_log?` and the `semantic_logger_filter` are native-only.
2. **`string_list` configs** -- accessed via `fetch_object_value` and used as an `Array<String>`.
3. **`duration` configs** -- exposed only via the native `get_duration` (returns milliseconds).
4. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
5. **`keys` / raw config inspection** -- native-only via `provider.client`.
6. **Context keys use dot-notation** -- pass `"user.email"`, not nested hashes.
7. **`targeting_key` maps to `user.id` by default** -- configure `targeting_key_mapping` if different.
