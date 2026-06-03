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

    await client.init();
    // Only cache after successful init — if init() throws,
    // the next request will retry instead of returning a broken client.
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

    await client.init();
    // Only cache after successful init — if init() throws,
    // the next request will retry instead of returning a broken client.
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

  return rf.inContext(context, (contextRf) => {
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

    await client.init();
    // Only cache after successful init — if init() throws,
    // the next request will retry instead of returning a broken client.
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

  return rf.inContext(context, (contextRf) => {
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

By default the SDK connects to `https://primary.quonfig.com` for config fetches
and automatically connects to `https://stream.primary.quonfig.com` for live SSE
updates. The stream URL is derived from each API URL by prepending `stream.` to
the hostname, so you don't configure it separately. A fallback
`secondary.quonfig.com` will be added to the default list once the fallback app
exists. Override the list by passing `apiUrls`:

```typescript
const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  apiUrls: ["https://primary.quonfig.com"],
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

// Dynamic config
const configValue: string | undefined = quonfig.get("some.config.name"); // type inferred from usage
const numberConfig: number | undefined = quonfig.get("api.retry.count"); // number type
const booleanFlag: boolean | undefined = quonfig.get("feature.enabled"); // boolean type
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

After the init completes you can use:

- `quonfig.isEnabled('some.feature.name')` returns true or false
- `quonfig.get('some.config.name')` returns a raw value

</TabItem>
</Tabs>

:::note Migrating from earlier releases

`isFeatureEnabled` is still available as a deprecated alias of `isEnabled` — both behave identically.
New code should prefer `isEnabled`, which matches `@quonfig/javascript` and `@quonfig/react`.

:::

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

You can also use the base quonfig instance for `inContext` blocks:

```typescript
baseQuonfig.inContext(context, (rf) => {
  // Use the typed instance inside the context
  const typedRf = new QuonfigTypesafeNode(rf);

  console.log(typedRf.someConfigName());
  console.log(typedRf.someFeatureName());
});
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
- `quonfig.isEnabled('some.feature.name', context, false)` // context-aware feature flag

Or you can set the context in a block (perhaps surrounding evaluation of a web request)

```typescript
quonfig.inContext(context, (rf) => {
  const optionalJustInTimeContext = { device: { mobile: true } }; // additional context

  console.log(
    rf.get("some.config.name", optionalJustInTimeContext, defaultValue),
  ); // merged context
  console.log(
    rf.isEnabled("some.feature.name", optionalJustInTimeContext, false),
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
- `quonfig.isEnabled('some.feature.name', context, false)`

Or you can set the context in a block (perhaps surrounding evaluation of a web request)

```js
quonfig.inContext(context, (rf) => {
  const optionalJustInTimeContext = { ... }

  console.log(rf.get("some.config.name", optionalJustInTimeContext, defaultValue))
  console.log(rf.isEnabled("some.config.name", optionalJustInTimeContext, false))
})
```

</TabItem>
</Tabs>

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
  isPremium: true,
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
// Get raw config with full metadata (no evaluation)
const rawConfig = quonfig.rawConfig("api.retry.count");
if (rawConfig) {
  console.log("Config type:", rawConfig.type);
  console.log("Value type:", rawConfig.valueType);
  console.log("Rules:", rawConfig.default);
}

// Get the raw value that matches a given context, without unwrapping it
const rawMatch = quonfig.getRawMatch("api.retry.count", {
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
await quonfig.close(); // Drains telemetry, stops SSE, clears timeouts
```

**Important**: Always call `quonfig.close()` when shutting down your application to ensure proper
cleanup of connections and prevent memory leaks.

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

## Reference

### Option Definitions

| Name                       | Description                                                                                                                            | Default           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| apiUrls                    | Ordered list of API base URLs. SSE URL is derived by prepending `stream.` to the hostname                                       | `["https://primary.quonfig.com"]` |
| collectEvaluationSummaries | Send counts of config/flag evaluation results back to Quonfig to view in web app                                                | true              |
| contextUploadMode          | Upload either context "shapes" (the names and data types your app uses in quonfig contexts) or periodically send full example contexts. One of `"none"`, `"shapes_only"`, `"periodic_example"` | "periodic_example" |
| defaultLevel               | Level to be used as the min-verbosity for a `loggerPath` if no value is configured in Quonfig                                   | "warn"            |
| enableSSE                  | Whether or not we should listen for live changes from Quonfig                                                                   | true              |
| fallbackPollEnabled        | Poll for changes only when the SSE stream is unavailable (replaces the deprecated `enablePolling`, which polled in parallel with SSE) | true              |
| fallbackPollIntervalMs     | How often to poll, in ms, when the fallback poller is active                                                                    | 60000             |
| loggerKey                  | The `log_level` config key consulted by `shouldLog({loggerPath})`. No default — set it to enable the `loggerPath` convenience.          | `undefined`       |
| enableQuonfigUserContext   | Inject `quonfig-user.email` from `~/.quonfig/tokens.json` (written by `qfg login`) into `globalContext`. Pairs with `qfg override`. Default on, gated on the token file's presence (inert in prod). Set `false` or `QUONFIG_DEV_CONTEXT=false` to opt out. | `null` (on)       |
