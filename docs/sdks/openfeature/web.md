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

const provider = new QuonfigWebProvider({ sdkKey: "qf_sk_..." });

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

const provider = new QuonfigWebProvider({ sdkKey: "qf_sk_..." });

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
The provider's `onContextChanged()` propagates the new context to the native client:

```typescript
// After login
await OpenFeature.setContext({
  targetingKey: user.id,
  "user.email": user.email,
  "org.tier": org.plan,
});
```

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
  sdkKey: "qf_sk_...",
  targetingKeyMapping: "account.id",
});
```

## Configuration options

```typescript
const provider = new QuonfigWebProvider({
  sdkKey: "qf_sk_...",            // required
  targetingKeyMapping: "user.id", // default — which Quonfig context property OpenFeature `targetingKey` maps to
  apiUrl: "https://custom.api",   // optional — override the Quonfig API base URL. Defaults derive from `primary.quonfig.com` / `secondary.quonfig.com`.
  timeout: 5000,                  // optional — initialization request timeout in ms
});
```

To point a browser app at staging, set `apiUrl` to your staging API host (e.g. `https://primary.quonfig-staging.com`). The native `@quonfig/javascript` SDK exposes a `domain` option that flips api + telemetry URLs in lockstep — that knob is not currently surfaced through this provider, so override `apiUrl` here, and if you need to redirect telemetry too reach for the underlying client via `provider.getClient()`.

## What you lose vs. the native SDK

1. **Log levels** -- `shouldLog()` is native-only; access via `provider.getClient()`.
2. **`string_list` configs** -- use `getObjectValue()` and cast to `string[]`.
3. **`duration` configs** -- returned as ISO 8601 string via `getStringValue()`.
4. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
5. **`keys()` and `rawConfig()`** -- use `provider.getClient()` to access.
6. **Context keys use dot-notation** -- pass `"user.email"`, not a nested object.
