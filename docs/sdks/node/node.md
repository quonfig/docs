---
title: Node
---

:::tip TypeScript Support

**⭐ Recommended**: Use the [Quonfig CLI](/docs/tools/cli#typescript-code-generation) to generate
TypeScript definitions for type-safe access to your flags and configs:

```bash
# Step 1: pull a local copy of your workspace config files
npx @quonfig/cli pull --dir ./my-config

# Step 2: generate Node.js type definitions from local files
npx @quonfig/cli generate --dir ./my-config --targets node-ts
```

Set `QUONFIG_DIR=./my-config` to avoid repeating `--dir`.

:::

## Install the Latest Version

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install @quonfig/node
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add @quonfig/node
```

</TabItem>
</Tabs>

TypeScript types are included with the package.

## Initialize a Client

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

First, pull your workspace config and generate types:

```bash
npx @quonfig/cli pull --dir ./my-config
npx @quonfig/cli generate --dir ./my-config --targets node-ts
```

Then use the generated typed class:

```typescript
import { Quonfig } from "@quonfig/node";
import { QuonfigTypesafeNode } from "./generated/quonfig-server";

const baseQuonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: true,
  fallbackPollEnabled: true,
});

await baseQuonfig.init();

// Create the typed instance
const quonfig = new QuonfigTypesafeNode(baseQuonfig);

// Now you get full type safety and autocomplete!
const myStringConfig = quonfig.myStringConfig(); // string type inferred
const myFeatureFlag = quonfig.coolFeature(); // boolean type inferred
const configWithContext = quonfig.userSpecificSetting({
  user: { key: "user-123" },
}); // Type-safe context
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: true,
  fallbackPollEnabled: true,
});

await quonfig.init();
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: true,
  fallbackPollEnabled: true,
});

await quonfig.init();
```

</TabItem>
</Tabs>

## If Quonfig is unreachable at startup

`init()` fetches config from the primary and secondary delivery hosts and
retries through blips (jittered backoff from 0.5s, capped at 30s) for
`initTimeout` (10 s by default). It resolves as soon as the first config
loads. If no config has loaded by then, `onInitFailure` decides what happens:

| `onInitFailure`    | At the timeout |
| ------------------ | -------------- |
| `"fail"` (default) | `init()` rejects with `QuonfigInitError` (`.reason`: `"timeout"`, `"unavailable"` or `"unauthorized"`; `.cause`: the last delivery error). |
| `"wait"`           | `init()` keeps blocking and retrying with no upper bound, and resolves once config loads. |
| `"continue"`       | `init()` resolves, logs an ERROR, and the client starts on your code defaults. |

If every delivery host rejects the SDK key (401/403/404/410), `"fail"` rejects at once
instead of waiting out the timeout, and `"continue"` resolves at once; `"wait"`
logs an ERROR and keeps retrying. `initTimeout` of zero or less runs exactly one attempt, then applies `onInitFailure`; it does not mean "no deadline". An unknown `onInitFailure` value throws
when you construct the client.

The client object keeps retrying in the background in every mode, including
after you catch a `QuonfigInitError`, and heals on the first successful fetch.
Until then getters return the default you pass (or follow [`onNoDefault`](#typed-getters-and-defaults)), and
`get*Details` calls return `reason: "ERROR"` with `errorCode:
"PROVIDER_NOT_READY"`. If you catch the error and don't keep the client, call
`close()` on it so the retry stops.

```typescript
import { Quonfig, QuonfigInitError } from "@quonfig/node";

const quonfig = new Quonfig({ sdkKey, onInitFailure: "fail", initTimeout: 10_000 });
try {
  await quonfig.init();
} catch (err) {
  if (err instanceof QuonfigInitError) console.error(err.reason, err.message);
  throw err; // let the orchestrator restart the process
}

quonfig.isReady(); // true once config is loaded
await quonfig.waitForReady({ timeoutMs: 30_000 }); // rejects with QuonfigInitError on timeout
```

Under `"wait"` or `"continue"`, wire your readiness probe to `isReady()` so
the orchestrator holds traffic until config loads. For how to choose between
the three, see
[If Quonfig Is Unreachable at Startup](/docs/explanations/architecture/startup-failure).
In AWS Lambda, keep `initTimeout` well under your function timeout; see
[Lambdas](./lambdas.md).

## Local datadir mode (no account required)

The SDK can run entirely against a local directory of JSON config files —
no SDK key, no SSE connection, no telemetry POSTs. Use this when you want
Quonfig as a self-contained git-backed config store, when running tests,
or when developing offline.

```typescript
import { Quonfig } from "@quonfig/node";
import path from "node:path";

const quonfig = new Quonfig({
  // Point the SDK at a local Quonfig workspace directory.
  // (Same shape as what `qfg init` creates.)
  datadir: path.join(process.cwd(), "quonfig"),
  // Pick which environment overrides to apply.
  environment: process.env.QUONFIG_ENVIRONMENT ?? "development",
  // Nothing to stream from / poll without a server.
  enableSSE: false,
  fallbackPollEnabled: false,
});

await quonfig.init();
```

With `datadir` set and **no** `sdkKey` provided, the SDK skips telemetry
entirely — there's no workspace to attribute it to and nowhere to POST it.
If you have an `sdkKey`, telemetry still runs in datadir mode so dogfood
deployments can self-report.

The SDK reads the directory once, at `init()`. To pick up edits without a
restart (an editor save, a `git pull`, a build step), opt in to file watching:

```typescript
const quonfig = new Quonfig({
  datadir: path.join(process.cwd(), "quonfig"),
  environment: "development",
  dataDirAutoReload: true, // off by default
  // dataDirAutoReloadDebounceMs: 200, // wait this long after the last change
});
```

Each successful reload fires `onConfigUpdate`. If the new files don't parse,
the SDK logs the error and keeps serving the previous config. If the directory
can't be watched (for example, a read-only filesystem), the SDK logs it and
carries on without watching.

See the [Next.js + TypeScript (Fully Local) tutorial](/docs/tutorials/nextjs-typescript-local)
for a complete walkthrough, or the
[Open Source / Fully Local how-to](/docs/how-tos/open-source-local)
for the mental model.

## Next.js API Routes (Singleton Pattern)

For Next.js API routes and other serverless environments, use the singleton pattern to avoid re-initialization on every request:

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

```typescript
// app/api/flags/route.ts (or pages/api/flags.ts)
import { Quonfig, type Contexts } from "@quonfig/node";
import { QuonfigTypesafeNode } from "../../../generated/quonfig-server";
import { NextRequest, NextResponse } from "next/server";

let baseQuonfig: Quonfig | null = null;
let quonfig: QuonfigTypesafeNode | null = null;

async function getQuonfigClient(): Promise<QuonfigTypesafeNode> {
  if (!baseQuonfig || !quonfig) {
    const client = new Quonfig({
      sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
      enableSSE: true,
      fallbackPollEnabled: true,
    });

    try {
      await client.init();
    } catch (err) {
      // init() failed (see "If Quonfig is unreachable at startup"). Close this
      // client so its background retry stops; the next request builds a new one.
      await client.close();
      throw err;
    }
    // Only cache after successful init.
    baseQuonfig = client;
    quonfig = new QuonfigTypesafeNode(client);
  }

  return quonfig;
}

export async function GET(request: NextRequest) {
  const rf = await getQuonfigClient();

  // Get user context from request headers, cookies, etc.
  const userId = request.headers.get("x-user-id");
  const context: Contexts = {
    user: { key: userId || "anonymous" },
  };

  // Use type-safe methods with context
  const welcomeMessage = rf.welcomeMessage(context);
  const isFeatureEnabled = rf.newFeature(context);

  return NextResponse.json({
    welcomeMessage,
    isFeatureEnabled,
  });
}
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript
// app/api/flags/route.ts (or pages/api/flags.ts)
import { Quonfig, type Contexts } from "@quonfig/node";
import { NextRequest, NextResponse } from "next/server";

let quonfig: Quonfig | null = null;

async function getQuonfigClient(): Promise<Quonfig> {
  if (!quonfig) {
    const client = new Quonfig({
      sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
      enableSSE: true,
      fallbackPollEnabled: true,
    });

    try {
      await client.init();
    } catch (err) {
      // init() failed (see "If Quonfig is unreachable at startup"). Close this
      // client so its background retry stops; the next request builds a new one.
      await client.close();
      throw err;
    }
    // Only cache after successful init.
    quonfig = client;
  }

  return quonfig;
}

export async function GET(request: NextRequest) {
  const rf = await getQuonfigClient();

  // Get user context from request
  const userId = request.headers.get("x-user-id");
  const context: Contexts = {
    user: { key: userId || "anonymous" },
  };

  return rf.withContext(context, (contextRf) => {
    const welcomeMessage = contextRf.get("welcomeMessage");
    const isFeatureEnabled = contextRf.isEnabled("newFeature");

    return NextResponse.json({
      welcomeMessage,
      isFeatureEnabled,
    });
  });
}
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
// app/api/flags/route.js (or pages/api/flags.js)
import { Quonfig } from "@quonfig/node";

let quonfig = null;

async function getQuonfigClient() {
  if (!quonfig) {
    const client = new Quonfig({
      sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
      enableSSE: true,
      fallbackPollEnabled: true,
    });

    try {
      await client.init();
    } catch (err) {
      // init() failed (see "If Quonfig is unreachable at startup"). Close this
      // client so its background retry stops; the next request builds a new one.
      await client.close();
      throw err;
    }
    // Only cache after successful init.
    quonfig = client;
  }

  return quonfig;
}

export async function GET(request) {
  const rf = await getQuonfigClient();

  // Get user context from request
  const userId = request.headers.get("x-user-id");
  const context = {
    user: { key: userId || "anonymous" },
  };

  return rf.withContext(context, (contextRf) => {
    const welcomeMessage = contextRf.get("welcomeMessage");
    const isFeatureEnabled = contextRf.isEnabled("newFeature");

    return Response.json({
      welcomeMessage,
      isFeatureEnabled,
    });
  });
}
```

</TabItem>
</Tabs>

:::tip Singleton Pattern Benefits
This pattern prevents re-initialization on every API request, which is crucial for serverless environments where functions are frequently recycled. The client is initialized once per container lifecycle and reused across requests.
:::

:::warning Environment Variables
Make sure to use `QUONFIG_BACKEND_SDK_KEY` (not `NEXT_PUBLIC_`) in API routes since they run server-side. Only client-side code needs the `NEXT_PUBLIC_` prefix.
:::

### API URLs

By default the SDK derives all of its hostnames from `QUONFIG_DOMAIN`
(default `quonfig.com`): it fetches config from `https://primary.quonfig.com`,
streams live updates from `https://stream.primary.quonfig.com`, and
**automatically fails over** to `https://secondary.quonfig.com` (on separate
infrastructure). Failover and hedging are on by default — see
[Reliability](/docs/explanations/architecture/resiliency) for the full model.

Override the list by passing `apiUrls`. Pass **both** a primary and a secondary
URL to keep automatic failover; a single URL disables it (the SDK logs a
warning at init):

```typescript
const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  apiUrls: [
    "https://primary.quonfig.com",
    "https://secondary.quonfig.com",
  ],
});
```

## Feature Flags and Dynamic Config

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

With generated types, you get camelCase method names and full type safety:

```typescript
// Instead of string keys, use type-safe methods:
if (quonfig.newUserOnboarding()) {
  // boolean type inferred
  // Show new user flow
}

const maxRetries = quonfig.apiRetryCount(); // number type inferred
const welcomeMessage = quonfig.welcomeMessage(); // string type inferred

// Context is type-safe too
const userSpecificLimit = quonfig.userDailyLimit({
  user: { key: "user-123", plan: "pro" },
}); // Types enforced for context structure
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

After the init completes you can use:

```typescript
// Feature flags
if (quonfig.isEnabled("some.feature.name")) {
  // returns boolean
  // Feature is enabled
}

// Dynamic config: typed getters take (key, contexts?, default?)
const configValue: string = quonfig.getString("some.config.name", undefined, "fallback");
const retryCount: number = quonfig.getInt("api.retry.count", undefined, 3);
const sampleRate: number = quonfig.getNumber("trace.sample-rate", undefined, 0.1);
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

After the init completes you can use:

- `quonfig.isEnabled('some.feature.name')` returns true or false, and never throws
- `quonfig.getString('some.config.name', undefined, 'fallback')` returns the string value, or
  `'fallback'` when there is none. The other typed getters work the same way (see below).
- `quonfig.get('some.config.name', undefined, defaultValue)` returns the value as stored, of any type

</TabItem>
</Tabs>

On default settings, a read with **no default** throws when there is no value, including for a
missing key. Pass a default, or see `onNoDefault` below.

### Typed getters and defaults

Every typed getter takes `(key, contexts?, default?)`. Pass `undefined` for `contexts` to use only
the global (or bound) context.

| Getter | Reads |
| --- | --- |
| `getString` | string and log_level configs |
| `getBool` | bool configs |
| `getInt` | int configs, and doubles that are whole numbers |
| `getNumber` | int and double configs |
| `getStringList` | string_list configs |
| `getDuration` | duration configs, in milliseconds |
| `getJSON` | json configs (a fresh copy on every call) |
| `get` | any config, as its stored type |
| `isEnabled(key, contexts?)` | bool flags; `false` for anything else, and never throws |

Values are never coerced: a stored string `"false"` is not a bool and `"3"` is not a number. When a
getter has no value (a missing key, no matching rule, another type, a malformed value, an unset
ENV_VAR or a decryption failure), it returns your default. Without a default, the `onNoDefault`
option decides:

- `"error"` (the default) throws: `QuonfigTypeMismatchError` for a wrong type, otherwise the
  underlying error (for a missing key, `No value found for key "..."`).
- `"warn"` logs a warning and returns `undefined`.
- `"ignore"` returns `undefined`.

```typescript
const quonfig = new Quonfig({ sdkKey, onNoDefault: "warn" });
```

The details getters, `getBoolDetails`, `getStringDetails`, `getNumberDetails`,
`getStringListDetails` and `getJSONDetails`, never throw. They return `{ value, reason, variant,
flagMetadata }`, plus `errorCode` (`FLAG_NOT_FOUND`, `TYPE_MISMATCH`, `PARSE_ERROR`,
`PROVIDER_NOT_READY` or `GENERAL`) when `reason` is `"ERROR"`. `evaluateDetails(key, contexts?)`
returns any config's value in its stored form (a duration as its ISO 8601 text, such as `"PT90S"`)
with a `valueType` field.

The rules are the same in every Quonfig SDK; see
[Typed Getters, Defaults, and Error Codes](/docs/explanations/concepts/typed-getters). If you are
upgrading from `@quonfig/node` 1.x, which coerced values and returned the default less often, read
the [UPGRADE to 2.0 notes](https://github.com/quonfig/sdk-node/blob/main/CHANGELOG.md#upgrade-to-20).

:::note Deprecated aliases

`isFeatureEnabled` is a deprecated alias of `isEnabled`, and `inContext(...)` is a deprecated alias
of `withContext(...)`. Both behave identically to the new names and will be removed in a future
major release. New code should use `isEnabled` and `withContext`, which match `@quonfig/javascript`
and `@quonfig/react`.

:::

### Secrets

A [secret](/docs/explanations/features/secret-management) is read like any string config: `quonfig.get("payments.stripe.key")` (or `getString`) returns the **decrypted** string. The SDK decrypts it in your process using the encryption key, so the env var that `quonfig.secrets.encryption.key` is provided by (for example `QUONFIG_SECRET_KEY_DEFAULT`) must be set in the app's environment. If it isn't, a read that passes a default returns the default and logs one WARN per key; a read with no default throws (under the default `onNoDefault: "error"`). Secrets are always strings, so a JSON secret needs a parse:

```typescript
const stripeKey = quonfig.getString("payments.stripe.key");
const serviceAccount = JSON.parse(quonfig.getString("gcp.service-account"));
```

## Context

Quonfig supports [context](/docs/explanations/concepts/context) for intelligent rule-based
evaluation of `get` and `isEnabled` based on the current request/device/user/etc.

Given

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

```typescript
import type { Contexts } from "@quonfig/node";

const context: Contexts = {
  user: { key: "some-unique-identifier", country: "US" },
  subscription: { key: "pro-sub", plan: "pro" },
};
```

With the generated typed class, context is passed directly to each method:

```typescript
// Each generated method accepts context as an optional parameter
const configValue = quonfig.someConfigName(context);
const isEnabled = quonfig.someFeatureName(context);

// Or use inline context
const userSpecificValue = quonfig.welcomeMessage({
  user: { key: "user-123", language: "en" },
  device: { mobile: true },
}); // All type-safe!
```

The generated typed class wraps the base client, and every generated method takes
context directly — so construct it once over `baseQuonfig` and pass context per call:

```typescript
const typedQuonfig = new QuonfigTypesafeNode(baseQuonfig);

console.log(typedQuonfig.someConfigName(context));
console.log(typedQuonfig.someFeatureName(context));
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript
import type { Contexts } from "@quonfig/node";

const context: Contexts = {
  user: { key: "some-unique-identifier", country: "US" }, // user context
  subscription: { key: "pro-sub", plan: "pro" }, // subscription context
};
```

You can pass this in to each call

- `quonfig.get('some.config.name', context, defaultValue)` // context-aware config
- `quonfig.isEnabled('some.feature.name', context)` // context-aware feature flag

Or you can set the context in a block (perhaps surrounding evaluation of a web request)

```typescript
quonfig.withContext(context, (rf) => {
  const optionalJustInTimeContext = { device: { mobile: true } }; // additional context

  console.log(
    rf.get("some.config.name", optionalJustInTimeContext, defaultValue),
  ); // merged context
  console.log(
    rf.isEnabled("some.feature.name", optionalJustInTimeContext),
  ); // boolean result
});
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
const context = {
  user: { key: "some-unique-identifier", country: "US" },
  subscription: { key: "pro-sub", plan: "pro" },
};
```

You can pass this in to each call

- `quonfig.get('some.config.name', context, defaultValue)`
- `quonfig.isEnabled('some.feature.name', context)`

Or you can set the context in a block (perhaps surrounding evaluation of a web request)

```js
quonfig.withContext(context, (rf) => {
  const optionalJustInTimeContext = { ... }

  console.log(rf.get("some.config.name", optionalJustInTimeContext, defaultValue))
  console.log(rf.isEnabled("some.config.name", optionalJustInTimeContext))
})
```

</TabItem>
</Tabs>

### Per-request context in Express (AsyncLocalStorage)

In a web server you usually know who the user is in middleware, but the flag check happens
several function calls deeper. Rather than passing `req` or a context object through every
function in between, set the context once per request with Node's built-in
[`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) and read
it from anywhere in that request.

`withContext(context)` without a callback returns a client bound to that context. Store it for
the life of the request:

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript">

```typescript
// flags.ts
import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestHandler } from "express";
import { Quonfig, type BoundQuonfig } from "@quonfig/node";

export const quonfig = new Quonfig({ sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY! });

const requestFlags = new AsyncLocalStorage<BoundQuonfig>();

// Register after your auth and body-parsing middleware.
export const quonfigContext: RequestHandler = (req, _res, next) => {
  const bound = quonfig.withContext({
    user: { key: req.user?.id, email: req.user?.email },
    organization: { key: req.user?.orgId },
  });
  requestFlags.run(bound, next);
};

// Anywhere, at any depth: the client bound to the current request's user.
// Outside a request (startup, cron jobs) it falls back to the unbound client.
export const flags = () => requestFlags.getStore() ?? quonfig;
```

```typescript
// app.ts
await quonfig.init();
app.use(authMiddleware);
app.use(quonfigContext);

// services/pricing.ts: no user argument needed
import { flags } from "../flags";

export async function calculateDiscount(cart: Cart) {
  if (flags().isEnabled("new-discount")) {
    // ...
  }
}
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
// flags.js
import { AsyncLocalStorage } from "node:async_hooks";
import { Quonfig } from "@quonfig/node";

export const quonfig = new Quonfig({ sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY });

const requestFlags = new AsyncLocalStorage();

// Register after your auth and body-parsing middleware.
export const quonfigContext = (req, _res, next) => {
  const bound = quonfig.withContext({
    user: { key: req.user?.id, email: req.user?.email },
    organization: { key: req.user?.orgId },
  });
  requestFlags.run(bound, next);
};

// Anywhere, at any depth: the client bound to the current request's user.
// Outside a request (startup, cron jobs) it falls back to the unbound client.
export const flags = () => requestFlags.getStore() ?? quonfig;
```

```js
// app.js
await quonfig.init();
app.use(authMiddleware);
app.use(quonfigContext);

// services/pricing.js: no user argument needed
import { flags } from "../flags.js";

export async function calculateDiscount(cart) {
  if (flags().isEnabled("new-discount")) {
    // ...
  }
}
```

</TabItem>
</Tabs>

The bound client follows the request across `await`s, timers and promise chains, so concurrent
requests never see each other's context. Evaluation is local and in memory, so calling
`flags()` as often as you like costs nothing. You can still pass just-in-time context to a single
call, such as `flags().isEnabled("new-discount", { cart: { total: 120 } })`; it merges with the
request's context.

The same pattern works in Fastify, Koa, or any Node framework: call `requestFlags.run(bound, ...)`
around the rest of the request. Register it after auth and body parsing. A few older
callback-based libraries (some session stores and database pools) can lose the async context if
they run inside it.

## Developer overrides (`qfg override`)

The [`qfg override`](/docs/tools/cli#override) CLI flips a flag for *your* developer machine without affecting anyone else. It does this by writing a top-priority rule on the flag keyed on the property `quonfig-user.email`. The SDK injects that property automatically whenever the `qfg login` token file is present, so the rule is dead code in production by construction (a server that never ran `qfg login` has no `quonfig-user.email` on its eval context, and the rule cannot fire).

Injection is **on by default** — when `~/.quonfig/tokens.json` (written by `qfg login`) exists, the SDK reads it on init and merges `{ "quonfig-user": { email: <userEmail> } }` into your `globalContext`. Customer-supplied `quonfig-user` keys win on collision. If the file is missing or unparseable the SDK is a no-op — init still succeeds.

To opt out (e.g. on a shared box where `qfg login` has run):

```typescript
const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  enableQuonfigUserContext: false, // opt out
});
```

Or set `QUONFIG_DEV_CONTEXT=false` in the environment. Precedence: the explicit option wins, then `QUONFIG_DEV_CONTEXT`, then the default (`true`).

Telemetry note: `quonfig-user.email` flows through telemetry like any other context attribute. It only appears in dev-machine telemetry because production never injects it.

## Dynamic Log Levels

Log levels in Quonfig are stored as a `log_level` config (e.g. `log-level.my-app`). Rules inside that config decide what verbosity a given logger gets — down to individual classes or modules — and changes propagate live via SSE with no restart.

### Concept

- One `log_level` config per app, keyed like `log-level.my-app`. The value is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`.
- Tell the SDK which config to consult by passing `loggerKey` at init time.
- Every `shouldLog` / logger-adapter call pushes the logger's native name (`"MyApp.Services.Auth"`, `"com.app.Auth"`, whatever you use) into the evaluation context as `quonfig-sdk-logging.key` — verbatim, no normalization.
- Rules match against `quonfig-sdk-logging.key` (or any other context property — user, environment, etc.) so one config can drive per-logger, per-user, or per-environment overrides.
- Logger names flowing through `quonfig-sdk-logging.key` are auto-captured by Quonfig's example-context telemetry, so candidate logger names show up in the dashboard for rule-building.

### Basic usage

Initialize the client with `loggerKey`, then call `shouldLog` with a `loggerPath`:

```typescript
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  loggerKey: "log-level.my-app",
});

await quonfig.init();

if (quonfig.shouldLog({ loggerPath: "MyApp.Services.Auth", desiredLevel: "DEBUG" })) {
  console.log("auth debug line");
}
```

If you'd rather bypass the convenience form and point at a config directly, use the primitive shape:

```typescript
quonfig.shouldLog({
  configKey: "log-level.my-app",
  desiredLevel: "DEBUG",
  contexts: { user: { id: "user-123" } },
});
```

### Rule example

Create a `log_level` config with key `log-level.my-app` and target individual loggers via `quonfig-sdk-logging.key`:

```yaml
# Default to INFO for every logger in this app
default: INFO

rules:
  # Bump the auth subsystem to DEBUG
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "MyApp.Services.Auth"
    value: DEBUG

  # Silence a chatty third-party logger
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "SomeLib"
    value: ERROR

  # Turn DEBUG on for one developer, everywhere
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG
```

Because the evaluator sees your full context — not just `quonfig-sdk-logging.*` — you can combine logger rules with global or per-request context (`application.environment`, `user.email`, `team.id`, etc.) to crank verbosity up for a single user, a staging deploy, or one bad request, without affecting anyone else.

### Winston adapter

Install Winston as a peer dependency:

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install winston
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add winston
```

</TabItem>
</Tabs>

`createWinstonFormat` is a Winston format that consults `quonfig.shouldLog` and drops records that don't pass. Import it from the `@quonfig/node/winston` subpath:

```typescript
import { Quonfig } from "@quonfig/node";
import { createWinstonFormat } from "@quonfig/node/winston";
import winston from "winston";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  loggerKey: "log-level.my-app",
});
await quonfig.init();

const logger = winston.createLogger({
  format: winston.format.combine(
    createWinstonFormat(quonfig, "MyApp.Services.Auth"),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

logger.info("live-controlled"); // emits iff shouldLog says so
```

The second argument (`loggerPath`) is forwarded to `quonfig.shouldLog` verbatim, so rules can key on whatever identifier shape your app actually uses.

If you want a ready-to-go logger with the Quonfig gate already attached, use `createWinstonLogger`:

```typescript
import { createWinstonLogger } from "@quonfig/node/winston";

const logger = createWinstonLogger(quonfig, "MyApp.Services.Auth");
logger.debug("debug line");
```

### Pino adapter

Install Pino as a peer dependency:

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install pino
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add pino
```

</TabItem>
</Tabs>

`createPinoHooks` returns a Pino `hooks` object that gates every emission through Quonfig. Import it from the `@quonfig/node/pino` subpath:

```typescript
import { Quonfig } from "@quonfig/node";
import { createPinoHooks } from "@quonfig/node/pino";
import pino from "pino";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  loggerKey: "log-level.my-app",
});
await quonfig.init();

const logger = pino({
  level: "trace", // let Pino emit everything; Quonfig decides what survives
  hooks: createPinoHooks(quonfig, "MyApp.Services.Auth"),
});

logger.debug("debug line");
```

As with Winston, the convenience constructor `createPinoLogger(quonfig, loggerPath)` wires the hooks for you.

### Reference

| Name                                                 | Example                                                                                   | Description                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loggerKey` (constructor option)                     | `new Quonfig({ loggerKey: "log-level.my-app", ... })`                                     | The `log_level` config consulted by the `shouldLog({loggerPath})` convenience. Required for the `loggerPath` form.                               |
| `shouldLog({loggerPath, desiredLevel, contexts?})`   | `quonfig.shouldLog({ loggerPath: "MyApp.Auth", desiredLevel: "DEBUG" })`                  | Convenience shape. Uses `loggerKey` + injects `contexts["quonfig-sdk-logging"] = { key: loggerPath }` so rules can target individual loggers.    |
| `shouldLog({configKey, desiredLevel, contexts?})`    | `quonfig.shouldLog({ configKey: "log-level.my-app", desiredLevel: "DEBUG" })`             | Primitive shape. Evaluates the named config directly — no auto-injection. Use when you're building a custom adapter.                             |
| `createWinstonFormat(quonfig, loggerPath, options?)` | `winston.format.combine(createWinstonFormat(quonfig, "MyApp.Auth"), winston.format.json())` | Winston format that consults `shouldLog`. Import from `@quonfig/node/winston`.                                                                 |
| `createWinstonLogger(quonfig, loggerPath, options?)` | `createWinstonLogger(quonfig, "MyApp.Auth")`                                              | Ready-to-use Winston logger with the Quonfig format pre-attached. Import from `@quonfig/node/winston`.                                         |
| `createPinoHooks(quonfig, loggerPath, options?)`     | `pino({ hooks: createPinoHooks(quonfig, "MyApp.Auth") })`                                 | Pino hooks that gate every emission through `shouldLog`. Import from `@quonfig/node/pino`.                                                     |
| `createPinoLogger(quonfig, loggerPath, options?)`    | `createPinoLogger(quonfig, "MyApp.Auth")`                                                 | Ready-to-use Pino logger with Quonfig hooks pre-attached. Import from `@quonfig/node/pino`.                                                    |

## Mustache Templating

Quonfig supports Mustache templating for dynamic string configurations, allowing you to create
personalized messages, URLs, and other dynamic content.

### Prerequisites

Install Mustache as a peer dependency:

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install mustache
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add mustache
```

</TabItem>
</Tabs>

### Example Configuration

In your Quonfig dashboard, create a string configuration with Mustache variables:

- **Configuration Key**: `welcome.message`
- **Configuration Type**: `json`
- **Value**:
  ```json
  {
    "message": "Hello {{userName}}! Welcome to {{appName}}. You have {{creditsCount}} credit(s) remaining.",
    "cta": "Buy More Credits"
  }
  ```
- **Zod Schema** (optional, for validation):
  ```typescript
  z.object({
    message: z.string(),
    cta: z.string(),
  });
  ```

### Usage Examples

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

The CLI generates type-safe template functions:

```typescript
import {QuonfigTypesafeNode} from './generated/quonfig-server';

// Get the configured object
const welcomeMessageObject = quonfig.welcomeMessage();

// Template functions are generated automatically
// Returns: "Hello Alice! Welcome to MyApp. You have 150 credit(s) remaining."
const welcomeText = welcomeMessageObject.message({
  // Type-safe parameters — every Mustache variable is typed as `string`
  userName: 'Alice', // string type
  appName: 'MyApp', // string type
  creditsCount: '150', // string type (Mustache variables are always strings)
});

// Returns: Buy More Credits
const welcomeCta = welcomeMessageObject.cta;
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

For non-generated usage, you'll need to handle templating manually:

```typescript
import Mustache from "mustache";

// Get the configured object
const welcomeMessageObject = quonfig.get("welcome.message");

// Returns: "Hello Alice! Welcome to MyApp. You have 150 credit(s) remaining."
const welcomeText = Mustache.render(welcomeMessageObject.message, {
  userName: "Alice", // string type
  appName: "MyApp", // string type
  creditsCount: "150", // string type
});

// Returns: Buy More Credits
const welcomeCta = welcomeMessageObject.cta;
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

For raw javascript usage, handle templating manually:

```js
const Mustache = require("mustache");

// Get the configured object
const welcomeMessageObject = quonfig.get("welcome.message");

// Returns: "Hello Alice! Welcome to MyApp. You have 150 credit(s) remaining."
const welcomeText = Mustache.render(welcomeMessageObject.message, {
  userName: "Alice",
  appName: "MyApp",
  creditsCount: "150",
});

// Returns: Buy More Credits
const welcomeCta = welcomeMessageObject.cta;
```

</TabItem>
</Tabs>

### Context-Aware Templating

Combine templating with Quonfig context for personalized experiences:

```typescript
const userContext = {
  user: { key: "user-123", plan: "premium" },
  device: { mobile: false },
};

// Template adapts based on context
const personalizedContentObject = quonfig.dynamicContent(userContext);

const personalizedMessage = personalizedContentObject.message({
  name: "Alice",
  planName: "Premium", // template variables are always strings
  deviceType: "desktop",
});

const someOtherField = personalizedContentObject.someOtherProperty;
```

### Escaping and limitations

- **HTML escaping**: `{{variable}}` HTML-escapes its output (Mustache's default), so values containing `&`, `<`, `>`, or `"` are encoded — e.g. `https://example.com/?a=1&b=2` renders as `https://example.com/?a=1&amp;b=2`. When you need the raw, unescaped string (common for URLs), use the triple-mustache `{{{variable}}}` in your configuration value.
- **Variables are always strings**: every `{{variable}}` is typed as `string` in the generated parameters, regardless of any Zod schema on the surrounding object. Pass `'150'`, not `150`.
- **Arrays and unions are not templated**: Mustache resolution applies only to string fields on plain objects. A templated string nested inside a JSON array or union is left as a plain string — no template function is generated for it.

## Reacting to Config Changes

To run code when configuration updates arrive (via SSE or a fallback poll), pass an
`onConfigUpdate` callback in the constructor options. You can also observe the SSE
connection state with `onSSEConnectionStateChange`.

```typescript
const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,

  // Called after each successful config refresh
  onConfigUpdate: () => {
    console.log("Configuration updated; re-reading values");
    updateDatabasePool(quonfig.getNumber("database.connection.pool.size"));
  },

  // Called when the live (SSE) connection state changes
  onSSEConnectionStateChange: (state) => {
    console.log("SSE connection state:", state);
  },
});

await quonfig.init();
```

Reacting to config changes is useful for:

- Updating application state when configs change
- Triggering cache invalidation
- Logging configuration changes for debugging
- Implementing reactive configuration management

## Advanced Methods

### Raw Config Access

Access raw configuration metadata and structure:

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

```typescript
// rawConfig and getRawMatch live on the base client, not the generated
// QuonfigTypesafeNode class. Call them on baseQuonfig (or quonfig.quonfig).
// Get raw config with full metadata (no evaluation)
const rawConfig = baseQuonfig.rawConfig("api.retry.count");
if (rawConfig) {
  console.log("Config type:", rawConfig.type);
  console.log("Value type:", rawConfig.valueType);
  console.log("Rules:", rawConfig.default);
}

// Get the raw value that matches a given context, without unwrapping it
const rawMatch = baseQuonfig.getRawMatch("api.retry.count", {
  user: { key: "user-123" },
});
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript
const rawConfig = quonfig.rawConfig("api.retry.count");
console.log(rawConfig); // Full config object with metadata
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
const rawConfig = quonfig.rawConfig("api.retry.count");
console.log(rawConfig); // Full config object with metadata
```

</TabItem>
</Tabs>

### Available Keys

Get all available configuration keys:

```typescript
const allKeys = quonfig.keys();
console.log(allKeys); // ["config.one", "config.two", "feature.flag", ...]
```

### Health Accessors

Inspect the SDK's connection state and last successful refresh:

```typescript
console.log("Connection state:", quonfig.connectionState());
console.log("Last refresh:", quonfig.lastSuccessfulRefresh());
```

## Connection Management

Configuration stays current automatically: the SDK listens for live changes over SSE
and falls back to polling when the stream is unavailable. There is no manual "update now"
call — use `onConfigUpdate` (see [Reacting to Config Changes](#reacting-to-config-changes))
to run code when new config arrives.

### Shutdown

```typescript
// Properly close all connections and clean up resources
await quonfig.close(); // Sends the last telemetry window (5s max), stops SSE, clears timeouts
```

**Important**: Always call `quonfig.close()` when shutting down your application to ensure proper
cleanup of connections and prevent memory leaks.

### Invalid or revoked SDK key

If Quonfig rejects the SDK key while the client is running, `@quonfig/node`
stops streaming, probes every 150-300 seconds until the key works again, and
logs one ERROR naming the HTTP status and host (never the key). The full rule
is on the [Reliability](../../explanations/architecture/resiliency.md#invalid-or-revoked-sdk-key) page.

While the key is rejected, `quonfig.connectionState()` returns `"disconnected"`,
never `"falling_back"`. Evaluation keeps serving the last installed
configuration, and the client recovers by itself on the first accepted probe.

## Telemetry

Quonfig automatically collects telemetry data to help you understand how your configurations are
being used. Telemetry is sent in the background; there is no public accessor for it on the
client. Control collection via constructor options:

```typescript
const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,

  // Control evaluation summaries (default: true)
  collectEvaluationSummaries: true,

  // Control context data collection (default: "periodic_example")
  contextUploadMode: "shapes_only", // or "none" or "periodic_example"
});
```

**Context Upload Modes:**

- `"periodic_example"` - Sends both context structure and example values
- `"shapes_only"` - Sends only context keys and types, no values
- `"none"` - Disables context collection entirely

### Delivery options

How the SDK delivers telemetry, and what it does when the endpoint is slow or down, is the same in
every SDK and is explained once on the [Telemetry](../../explanations/architecture/telemetry.md)
page. The Node option names and defaults:

| Option                            | Default          |
| --------------------------------- | ---------------- |
| `telemetryFlushIntervalMs`        | `60000` (60s)    |
| `telemetryTimeoutMs`              | `15000` (15s)    |
| `telemetryMaxRetainedBatches`     | `5`              |
| `telemetryMaxRetainedBytes`       | `2097152` (2MB)  |
| `telemetryMaxRetainedAgeMs`       | `300000` (5 min) |
| `telemetryMaxEvaluationSummaries` | `10000`          |
| `telemetryMaxContextShapeFields`  | `10000`          |
| `telemetryMaxExampleContexts`     | `10000`          |

Invalid values (non-finite or `<= 0`) fall back to the default. Node's `fetch` has no separate
connect timeout, so `telemetryTimeoutMs` also covers connect and TLS.

Telemetry lines go to the `logger` you pass. The default console logger does not print debug
lines, so pass a `logger` to see failed POSTs.

## Reference

### Option Definitions

All options are passed to `new Quonfig({...})`. Every option is optional, but the client needs
either an SDK key (`sdkKey` or `QUONFIG_BACKEND_SDK_KEY`) or a local `datadir`/`datafile`;
otherwise the constructor throws.

**Connection**

| Name | Description | Default |
| ---- | ----------- | ------- |
| sdkKey | Backend SDK key (`qf_sk_...`). Falls back to the `QUONFIG_BACKEND_SDK_KEY` env var when omitted. | `QUONFIG_BACKEND_SDK_KEY` |
| domain | Derives the API, SSE and telemetry hostnames in one go (`primary.`, `secondary.`, `stream.` and `telemetry.` on this domain). Falls back to the `QUONFIG_DOMAIN` env var. See [API URLs](#api-urls). | `"quonfig.com"` |
| apiUrls | Ordered list of API base URLs (primary + secondary; failover on by default). Wins over `domain`. The SSE URL is derived by prepending `stream.` to each hostname. A single URL disables failover. | `["https://primary.quonfig.com", "https://secondary.quonfig.com"]` |
| telemetryUrl | Base URL for the telemetry service. Wins over `domain`. | `https://telemetry.quonfig.com` |
| enableSSE | Listen for live changes from Quonfig over SSE | `true` |
| sseReadDeadlineMs | Drop and reconnect the SSE stream if no data (including heartbeats) arrives within this many ms | `90000` |
| fallbackPollEnabled | Poll for changes only when the SSE stream is unavailable (replaces the deprecated `enablePolling`, which polled in parallel with SSE) | `true` |
| fallbackPollIntervalMs | How often to poll, in ms, when the fallback poller is active (replaces the deprecated `pollInterval`) | `60000` |
| configFetchTimeoutMs | Per-URL deadline, in ms, for one config fetch, so a hung host fails over to the next one | `3000` |
| configFetchHedgeDelayMs | How long, in ms, to wait for the primary before also asking the secondary in parallel | `2000` |
| configFetchHedgeAbortMs | Hard deadline, in ms, for each hedged fetch. Keep it below `initTimeout`; the SDK warns at construction if it isn't. | `6000` |
| initTimeout | How long `init()` retries the initial config fetch, in ms, before `onInitFailure` applies | `10000` |
| onInitFailure | What `init()` does if no config loads within `initTimeout`: `"fail"`, `"wait"` or `"continue"` (see [startup](#if-quonfig-is-unreachable-at-startup)) | `"fail"` |

**Local data**

| Name | Description | Default |
| ---- | ----------- | ------- |
| datadir | Path to a local Quonfig workspace directory. The SDK loads config from it instead of the delivery service (see [Local datadir mode](#local-datadir-mode-no-account-required)). | `undefined` |
| datafile | A config envelope to load instead of a directory: a path to a JSON file, or the parsed object. `datadir` wins if both are set. | `undefined` |
| environment | Which environment's rules to apply in `datadir` mode. Falls back to the `QUONFIG_ENVIRONMENT` env var. Ignored, with a warning, when you use an SDK key without a `datadir`/`datafile`; the key picks the environment. | `QUONFIG_ENVIRONMENT` |
| dataDirAutoReload | Watch `datadir` and re-read it when files change. A failed parse keeps serving the previous config. | `false` |
| dataDirAutoReloadDebounceMs | How long, in ms, to wait after the last file change before re-reading | `200` |

**Evaluation**

| Name | Description | Default |
| ---- | ----------- | ------- |
| globalContext | Context merged into every evaluation. A context of the same name passed to a getter or `withContext` replaces it. | `{}` |
| onNoDefault | What a getter called with no default does when there is no value: `"error"` throws, `"warn"` logs and returns `undefined`, `"ignore"` returns `undefined` (see [typed getters](#typed-getters-and-defaults)) | `"error"` |
| enableQuonfigUserContext | Inject `quonfig-user.email` from `~/.quonfig/tokens.json` (written by `qfg login`) into `globalContext`. Pairs with `qfg override`. Default on, gated on the token file's presence (inert in prod). Set `false` or `QUONFIG_DEV_CONTEXT=false` to opt out. | `null` (on) |

**Callbacks and logging**

| Name | Description | Default |
| ---- | ----------- | ------- |
| onConfigUpdate | Called after each config update (initial load, SSE push, poll or datadir reload). See [Reacting to Config Changes](#reacting-to-config-changes). | `undefined` |
| onSSEConnectionStateChange | Called with `"connecting"`, `"connected"`, `"error"` or `"disconnected"` as the SSE connection changes. No effect when `enableSSE` is `false`. | `undefined` |
| logger | Receives the SDK's own warnings and errors. Accepts a Pino, Winston or Bunyan logger, or `console`. | `console` |
| loggerKey | The `log_level` config key consulted by `shouldLog({loggerPath})`. Set it to enable the `loggerPath` convenience (see [Dynamic Log Levels](#dynamic-log-levels)). | `undefined` |

**Telemetry**

| Name | Description | Default |
| ---- | ----------- | ------- |
| collectEvaluationSummaries | Send counts of config/flag evaluation results back to Quonfig to view in the web app | `true` |
| contextUploadMode | Upload either context "shapes" (the names and data types your app uses in Quonfig contexts) or periodically send full example contexts. One of `"none"`, `"shapes_only"`, `"periodic_example"` | `"periodic_example"` |
| telemetry\* | Flush interval, timeout and retention limits. See [Delivery options](#delivery-options). | |
