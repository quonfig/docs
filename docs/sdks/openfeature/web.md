---
title: Web / React (OpenFeature)
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

`@quonfig/openfeature-web` is an OpenFeature provider for browser and React apps.
It wraps `@quonfig/javascript` and implements the `@openfeature/web-sdk` `Provider`
interface. The `@openfeature/react-sdk` re-exports the web SDK and adds React hooks —
any web provider works with React hooks automatically, so no separate React package
is needed.

:::caution Use a frontend SDK key
This provider runs in the browser, so give it a **frontend SDK key** (`qf_pk_…`),
never a backend key (`qf_sk_…`). A backend key can read your raw rules. See
[Keys & Credentials](/docs/explanations/concepts/keys-and-credentials). In Next.js,
expose it as `NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY`.
:::

The provider requires `@quonfig/javascript` 2.0 or later.

## Install

<Tabs groupId="react">
<TabItem value="react" label="React">

```bash
npm install @quonfig/openfeature-web @quonfig/javascript @openfeature/react-sdk
```

</TabItem>
<TabItem value="vanilla" label="Vanilla JS">

```bash
npm install @quonfig/openfeature-web @quonfig/javascript @openfeature/web-sdk
```

</TabItem>
</Tabs>

## Initialize

<Tabs groupId="react">
<TabItem value="react" label="React">

```typescript
import { OpenFeature, OpenFeatureProvider } from "@openfeature/react-sdk";
import { QuonfigWebProvider } from "@quonfig/openfeature-web";

const provider = new QuonfigWebProvider({
  sdkKey: process.env.NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY!, // qf_pk_...
});

// Set context before init so the first evaluation has user data
await OpenFeature.setContext({
  targetingKey: "user-123",
  "user.email": "alice@example.com",
  "org.tier": "enterprise",
});

await OpenFeature.setProviderAndWait(provider);
```

Wrap your app with `OpenFeatureProvider`:

```tsx
function App() {
  return (
    <OpenFeatureProvider>
      <MyComponent />
    </OpenFeatureProvider>
  );
}
```

</TabItem>
<TabItem value="vanilla" label="Vanilla JS">

```typescript
import { OpenFeature } from "@openfeature/web-sdk";
import { QuonfigWebProvider } from "@quonfig/openfeature-web";

const provider = new QuonfigWebProvider({ sdkKey: "qf_pk_..." });

await OpenFeature.setContext({
  targetingKey: "user-123",
  "user.plan": "pro",
});

await OpenFeature.setProviderAndWait(provider);

const client = OpenFeature.getClient();
const isEnabled = client.getBooleanValue("my-flag", false);
```

</TabItem>
</Tabs>

## Evaluate flags

<Tabs groupId="react">
<TabItem value="react" label="React hooks">

```tsx
import {
  useBooleanFlagValue,
  useStringFlagValue,
  useNumberFlagValue,
  useObjectFlagValue,
} from "@openfeature/react-sdk";

function PricingPage() {
  const showNewPricing = useBooleanFlagValue("new-pricing", false);
  const planLabel = useStringFlagValue("plan-label", "Starter");
  const maxSeats = useNumberFlagValue("max-seats", 5);

  return <div>{showNewPricing ? <NewPricing /> : <OldPricing />}</div>;
}
```

</TabItem>
<TabItem value="vanilla" label="Vanilla JS">

```typescript
const client = OpenFeature.getClient();

const enabled = client.getBooleanValue("checkout-v2", false);
const label = client.getStringValue("cta-label", "Get started");
const limit = client.getNumberValue("upload-limit-mb", 100);
const plans = client.getObjectValue("available-plans", []);
```

</TabItem>
</Tabs>

## Updating context (user login / logout)

When context changes (e.g., after login), call `OpenFeature.setContext()`.
OpenFeature calls the provider's `onContextChange` hook, which passes the new
context to the native client and fetches its values:

```typescript
// After login
await OpenFeature.setContext({
  targetingKey: user.id,
  "user.email": user.email,
  "org.tier": org.plan,
});
```

Until that fetch lands, reads return the cached copy for the new context (reason
`STALE`) if this browser has one, and your defaults otherwise. They never return
the previous user's values, even when the fetch fails.

React components using `useFlag` hooks automatically re-render with the new context.

## Evaluation context mapping

OpenFeature context is flat; Quonfig context is namespace-nested. The provider
maps between them using dot-notation:

| OpenFeature key | Quonfig namespace | Quonfig property |
|----------------|-------------------|-----------------|
| `targetingKey` | `user` | `id` (configurable) |
| `"user.email"` | `user` | `email` |
| `"org.tier"` | `org` | `tier` |
| `"country"` (no dot) | `""` (default) | `country` |

### Custom targetingKey mapping

```typescript
const provider = new QuonfigWebProvider({
  sdkKey: "qf_pk_...",
  targetingKeyMapping: "account.id",
});
```

## Configuration options

```typescript
const provider = new QuonfigWebProvider({
  sdkKey: "qf_pk_...",            // required — a frontend SDK key
  targetingKeyMapping: "user.id", // default — which Quonfig context property OpenFeature `targetingKey` maps to
  apiUrl: "https://custom.api",   // optional — replaces the default primary/secondary pair with this one host (no failover)
  timeout: 5000,                  // optional — per-leg fetch timeout in ms, passed to @quonfig/javascript (default 3000); not an overall init deadline
  onInitFailure: "fail",          // optional — "fail" (default) | "wait" | "continue"
  initTimeout: 5000,              // optional — overall init deadline in ms before onInitFailure applies (default 5000)
});
```

By default the SDK talks to a primary and a secondary host
(`primary.quonfig.com` / `secondary.quonfig.com`) and fails over between them.
Setting `apiUrl` replaces that pair with a single host, so you lose the
automatic failover (the SDK logs a warning at init).

To point a browser app at staging, set `apiUrl` to your staging API host (e.g. `https://primary.quonfig-staging.com`). That is a single host, so there is no failover to a secondary. The native `@quonfig/javascript` SDK exposes a `domain` option that flips api + telemetry URLs in lockstep — that knob is not currently surfaced through this provider, so override `apiUrl` here, and if you need to redirect telemetry too reach for the underlying client via `provider.getClient()`.

:::note If Quonfig is unreachable at startup
When no config loads by `initTimeout`, `onInitFailure` decides what
`initialize()` does. A cached last-known-good copy in localStorage counts as
config in every mode, and the client keeps retrying in the background.

| `onInitFailure` | `initialize()` | Provider status | When delivery comes back |
|---|---|---|---|
| `"fail"` (default) | Rejects (`QuonfigInitError`) | ERROR | `PROVIDER_READY` |
| `"wait"` | Stays pending until config arrives | NOT_READY | `initialize()` resolves |
| `"continue"` + cached copy | Resolves | STALE | `PROVIDER_READY` |
| `"continue"`, no cache | Resolves, then emits `PROVIDER_ERROR` | ERROR (non-fatal) | `PROVIDER_READY` |

Evaluations served from the cached copy report reason `STALE`. With no config
at all they return your default with error code `PROVIDER_NOT_READY`. See
[If Quonfig Is Unreachable at Startup](/docs/explanations/architecture/startup-failure).
:::

## Typed reads

Each OpenFeature getter reads only the config types that match it. Any other
read returns your default with reason `ERROR` and error code `TYPE_MISMATCH`:

| Getter | Reads |
|---|---|
| `getBooleanValue` | `bool` |
| `getStringValue` | `string`; `duration` as its stored ISO 8601 string (`"PT90S"` stays `"PT90S"`) |
| `getNumberValue` | `int` and `double` |
| `getObjectValue` | `json` (whatever JSON value it holds); `string_list` as an array |

Strings are never coerced: a stored `"true"` is not a boolean and a stored `"3"`
is not a number. A `json` config is read only with `getObjectValue`, even when
its value is `true` or `3`.

A stored value that can't be parsed as its declared type (an `int` holding
`"twelve"`, a `duration` holding `"30s"`) returns your default with reason
`ERROR` and error code `PARSE_ERROR` when you read it with the getter for that
type. The rules come from the native SDK; see
[Typed Getters, Defaults, and Error Codes](/docs/explanations/concepts/typed-getters).

## What you lose vs. the native SDK

1. **Log levels** -- `shouldLog()` is native-only; access via `provider.getClient()`.
2. **`string_list` configs** -- use `getObjectValue()` and cast to `string[]`.
3. **`duration` configs** -- returned as ISO 8601 string via `getStringValue()`. To read one natively, use `provider.getClient().getDuration(key, defaultValue)`.
4. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
5. **Bulk config access** (`extract()`, the `configs` getter, `get()`) -- native SDK only; reach it via `provider.getClient()`.
6. **Context keys use dot-notation** -- pass `"user.email"`, not a nested object.
