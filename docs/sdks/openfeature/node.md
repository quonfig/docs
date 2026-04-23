---
title: Node (OpenFeature)
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

[OpenFeature](https://openfeature.dev) is a CNCF standard for feature flag evaluation.
`@quonfig/openfeature-node` is a thin provider that wraps `@quonfig/node` and implements
the OpenFeature server-side `Provider` interface.

## Install

```bash
npm install @quonfig/openfeature-node @quonfig/node @openfeature/server-sdk
```

## Initialize

```typescript
import { QuonfigProvider } from "@quonfig/openfeature-node";
import { OpenFeature } from "@openfeature/server-sdk";

const provider = new QuonfigProvider({
  sdkKey: "qf_sk_production_...",
});

await OpenFeature.setProviderAndWait(provider);

const client = OpenFeature.getClient();
```

## Evaluate flags

```typescript
// Boolean flag
const enabled = await client.getBooleanValue("checkout-v2", false);

// String config
const welcomeMsg = await client.getStringValue("welcome-message", "Hello!");

// Number config
const timeout = await client.getNumberValue("request-timeout-ms", 5000);

// Object config (JSON or string_list)
const allowedPlans = await client.getObjectValue("allowed-plans", []);
```

## Evaluation context

Pass per-request context as the third argument:

```typescript
const isEnabled = await client.getBooleanValue(
  "pro-feature",
  false,
  {
    targetingKey: "user-123",   // maps to user.id by default
    "user.plan": "pro",
    "org.tier": "enterprise",
  }
);
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

```typescript
const provider = new QuonfigProvider({
  sdkKey: "qf_sk_...",
  targetingKeyMapping: "account.id",
});
```

## Lifecycle events

The provider emits standard OpenFeature lifecycle events:

```typescript
import { ProviderEvents } from "@openfeature/server-sdk";

OpenFeature.addHandler(ProviderEvents.Ready, () => {
  console.log("Quonfig provider ready");
});

OpenFeature.addHandler(ProviderEvents.ConfigurationChanged, ({ flagsChanged }) => {
  console.log("Config updated");
});
```

## Native SDK escape hatch

Access the underlying `@quonfig/node` client for features not available in OpenFeature:

```typescript
const native = provider.getClient();

// Log level integration — pass the full stored key
const shouldLog = native.shouldLog({
  configKey: "log-level.auth",
  desiredLevel: "DEBUG",
  contexts: { user: { id: "user-123" } },
});

// List all config keys
const keys = native.keys();
```

## Configuration options

All `@quonfig/node` options pass through to the provider constructor:

```typescript
const provider = new QuonfigProvider({
  sdkKey: "qf_sk_...",          // required unless datadir is set
  datadir: "./my-workspace",    // local mode — no server required
  environment: "production",
  targetingKeyMapping: "user.id",
  enableSSE: true,              // default true; set false for datadir mode
});
```

## What you lose vs. the native SDK

OpenFeature is designed for feature flags, not general configuration. Some Quonfig
features require the native `@quonfig/node` SDK directly:

1. **Log levels** -- `shouldLog()` and the Winston/Pino adapters are native-only.
2. **`string_list` configs** -- must be accessed via `getObjectValue()` and cast to `string[]`.
3. **`duration` configs** -- returned as a raw number (milliseconds) via `getNumberValue()`.
4. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
5. **`keys()` and `rawConfig()`** -- use `provider.getClient()` to access.
6. **Context keys use dot-notation** -- pass `"user.email"`, not `{ user: { email: "..." } }`.
7. **`targetingKey` maps to `user.id` by default** -- configure `targetingKeyMapping` if different.
