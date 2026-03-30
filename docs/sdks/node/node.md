---
title: Node
---

:::tip TypeScript Support

**⭐ Recommended**: Use the [Quonfig CLI](/docs/tools/cli#typescript-code-generation) to generate
TypeScript definitions for type-safe access to your flags and configs:

```bash
npx @quonfig-com/cli generate --targets node-ts
```

:::

## Install the Latest Version

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install @quonfig-com/node
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add @quonfig-com/node
```

</TabItem>
</Tabs>

TypeScript types are included with the package.

## Initialize a Client

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

First, generate your types:

```bash
npx @quonfig-com/cli generate --targets node-ts
```

Then use the generated typed class:

```typescript
import { Quonfig } from "@quonfig-com/node";
import { QuonfigTypesafeNode } from "./generated/quonfig-server";

const baseQuonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: true,
  enablePolling: true,
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
import { Quonfig } from "@quonfig-com/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: true,
  enablePolling: true,
});

await quonfig.init();
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
import { Quonfig } from "@quonfig-com/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: true,
  enablePolling: true,
});

await quonfig.init();
```

</TabItem>
</Tabs>

## Next.js API Routes (Singleton Pattern)

For Next.js API routes and other serverless environments, use the singleton pattern to avoid re-initialization on every request:

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

```typescript
// app/api/flags/route.ts (or pages/api/flags.ts)
import { Quonfig, type Contexts } from "@quonfig-com/node";
import { QuonfigTypesafeNode } from "../../../generated/quonfig-server";
import { NextRequest, NextResponse } from "next/server";

let baseQuonfig: Quonfig | null = null;
let quonfig: QuonfigTypesafeNode | null = null;

async function getQuonfigClient(): Promise<QuonfigTypesafeNode> {
  if (!baseQuonfig || !quonfig) {
    baseQuonfig = new Quonfig({
      sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
      enableSSE: true,
      enablePolling: true,
    });

    await baseQuonfig.init();
    quonfig = new QuonfigTypesafeNode(baseQuonfig);
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
import { Quonfig, type Contexts } from "@quonfig-com/node";
import { NextRequest, NextResponse } from "next/server";

let quonfig: Quonfig | null = null;

async function getQuonfigClient(): Promise<Quonfig> {
  if (!quonfig) {
    quonfig = new Quonfig({
      sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
      enableSSE: true,
      enablePolling: true,
    });

    await quonfig.init();
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
    const isFeatureEnabled = contextRf.isFeatureEnabled("newFeature");

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
import { Quonfig } from "@quonfig-com/node";

let quonfig = null;

async function getQuonfigClient() {
  if (!quonfig) {
    quonfig = new Quonfig({
      sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
      enableSSE: true,
      enablePolling: true,
    });

    await quonfig.init();
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
    const isFeatureEnabled = contextRf.isFeatureEnabled("newFeature");

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
if (quonfig.isFeatureEnabled("some.feature.name")) {
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

- `quonfig.isFeatureEnabled('some.feature.name')` returns true or false
- `quonfig.get('some.config.name')` returns a raw value

</TabItem>
</Tabs>

## Context

Quonfig supports [context](/docs/explanations/concepts/context) for intelligent rule-based
evaluation of `get` and `isFeatureEnabled` based on the current request/device/user/etc.

Given

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

```typescript
import type { Contexts } from "@quonfig-com/node";

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
import type { Contexts } from "@quonfig-com/node";

const context: Contexts = {
  user: { key: "some-unique-identifier", country: "US" }, // user context
  subscription: { key: "pro-sub", plan: "pro" }, // subscription context
};
```

You can pass this in to each call

- `quonfig.get('some.config.name', context, defaultValue)` // context-aware config
- `quonfig.isFeatureEnabled('some.feature.name', context, false)` // context-aware feature flag

Or you can set the context in a block (perhaps surrounding evaluation of a web request)

```typescript
quonfig.inContext(context, (rf) => {
  const optionalJustInTimeContext = { device: { mobile: true } }; // additional context

  console.log(
    rf.get("some.config.name", optionalJustInTimeContext, defaultValue),
  ); // merged context
  console.log(
    rf.isFeatureEnabled("some.feature.name", optionalJustInTimeContext, false),
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
- `quonfig.isFeatureEnabled('some.feature.name', context, false)`

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

## Dynamic Log Levels

The Quonfig SDK provides integration with popular Node.js logging frameworks, enabling you to dynamically manage log levels across your application in real-time without restarting.

### Features

- **Centrally manage log levels** - Control logging across your entire application from the Quonfig dashboard
- **Real-time updates** - Change log levels without restarting your application
- **Context-aware logging** - Different log levels for different loggers based on runtime context
- **Framework support** - Works with Pino and Winston

### Pino Integration

[Pino](https://getpino.io/) is a fast JSON logger for Node.js. Install it as a peer dependency:

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

Create a Pino logger with dynamic level support:

```typescript
import { Quonfig, createPinoLogger } from "@quonfig-com/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  enableSSE: true,
});

await quonfig.init();

// Create logger with dynamic log levels from Quonfig
const logger = createPinoLogger(quonfig, "myapp.services");

// Log levels are controlled dynamically by Quonfig
logger.debug("Debug message");
logger.info("Info message");
logger.error("Error message");
```

Alternatively, add dynamic level control to an existing Pino logger:

```typescript
import pino from "pino";
import { createPinoHook } from "@quonfig-com/node";

const logger = pino({
  mixin: createPinoHook(quonfig, "myapp.services"),
});
```

### Winston Integration

[Winston](https://github.com/winstonjs/winston) is a versatile logging library. Install it as a peer dependency:

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

Create a Winston logger with dynamic level support:

```typescript
import { Quonfig, createWinstonLogger } from "@quonfig-com/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  enableSSE: true,
});

await quonfig.init();

// Create logger with dynamic log levels from Quonfig
const logger = createWinstonLogger(quonfig, "myapp.services");

// Log levels are controlled dynamically by Quonfig
logger.debug("Debug message");
logger.info("Info message");
logger.error("Error message");
```

Alternatively, add dynamic level control to an existing Winston logger:

```typescript
import winston from "winston";
import { createWinstonFormat } from "@quonfig-com/node";

const logger = winston.createLogger({
  format: winston.format.combine(
    createWinstonFormat(quonfig, "myapp.services"),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});
```

### Configuration

Create a `LOG_LEVEL_V2` config in your Quonfig dashboard with key `log-levels.default`:

```yaml
# Default to INFO for all loggers
default: INFO

# Set specific packages to DEBUG
rules:
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "myapp.services"
    value: DEBUG

  # Only log errors in noisy third-party library
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "somelib"
    value: ERROR
```

You can customize the config key name using the `loggerKey` option. This is useful if you have multiple applications sharing the same Quonfig project and want to isolate log level configuration per application:

```typescript
const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  loggerKey: "myapp.log.levels",
});
```

The SDK automatically includes `lang: "node"` in the evaluation context, which you can use in your rules to create Node.js-specific log level configurations:

```yaml
# Different log levels for Node.js vs other languages
rules:
  - criteria:
      quonfig-sdk-logging.lang: node
      quonfig-sdk-logging.logger-path:
        starts-with: "myapp"
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
- **Dynamic context** - User, team, device, request information from context-scoped evaluations

For example, you can create rules like:

```yaml
# Enable DEBUG logs only for specific application in staging
rules:
  - criteria:
      application.key: "myapp"
      application.environment: "staging"
      quonfig-sdk-logging.logger-path:
        starts-with: "myapp"
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

### Direct Log Level API

You can also check log levels programmatically using the `getLogLevel` method:

```typescript
const logLevel = quonfig.getLogLevel("myapp.services.auth");
console.log(`Current log level: ${logLevel}`); // e.g., "INFO", "DEBUG", "WARN"

// Use it to conditionally log expensive operations
if (quonfig.getLogLevel("myapp.analytics") === "DEBUG") {
  // Only compute and log expensive analytics in debug mode
  logger.debug("Detailed analytics:", computeExpensiveAnalytics());
}
```

### How It Works

Once configured, the integration automatically filters **all** logging calls:

- Works with **all loggers** that use the integration
- Filters happen **before** log messages are formatted (performance benefit)
- Checks configuration on every log call for real-time updates
- No modification of your existing logging configuration needed

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
// Returns: "Hello Alice! Welcome to MyApp. You have 150 credits remaining."
const welcomeText = welcomeMessageObject.message({
    // Type-safe parameters
    userName: 'Alice', // string type
    appName: 'MyApp', // number type
    creditsCount: 150, // string type
  });
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

// Returns: "Hello Alice! Welcome to MyApp. You have 150 credits remaining."
const welcomeText = Mustache.render(welcomeMessageObject.message, {
  userName: "Alice", // string type
  appName: "MyApp", // number type
  creditsCount: 150, // string type
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

// Returns: "Hello Alice! Welcome to MyApp. You have 150 credits remaining."
const welcomeText = Mustache.render(welcomeMessageObject.message, {
  userName: "Alice",
  appName: "MyApp",
  creditsCount: 150,
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

## Config Change Listeners

Monitor configuration changes in real-time using config change listeners:

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

```typescript
// Add a listener for config changes
const unsubscribe = quonfig.addConfigChangeListener((changes) => {
  console.log("Configuration changed:", changes);

  // React to specific config changes
  changes.forEach((change) => {
    if (change.key === "database.connection.pool.size") {
      // Reconfigure database connection pool
      updateDatabasePool(change.newValue);
    }
  });
});

// Remove the listener when done
unsubscribe();
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript
import type { ConfigChangeCallback } from "@quonfig-com/node";

const changeHandler: ConfigChangeCallback = (changes) => {
  console.log("Configs changed:", changes);
};

const unsubscribe = quonfig.addConfigChangeListener(changeHandler);

// Clean up when done
unsubscribe();
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
const unsubscribe = quonfig.addConfigChangeListener((changes) => {
  console.log("Configs changed:", changes);
});

// Clean up when done
unsubscribe();
```

</TabItem>
</Tabs>

Config change listeners are useful for:

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
// Get raw config with full metadata
const rawConfig = quonfig.raw("api.retry.count");
if (rawConfig) {
  console.log("Config type:", rawConfig.configType);
  console.log("Value type:", rawConfig.valueType);
  console.log("Rules:", rawConfig.rows);
}
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript
const rawConfig = quonfig.raw("api.retry.count");
console.log(rawConfig); // Full config object with metadata
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```js
const rawConfig = quonfig.raw("api.retry.count");
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

### Default Context

Access the default context for the current environment:

```typescript
const defaultCtx = quonfig.defaultContext();
console.log("Default context:", defaultCtx);
```

### Runtime Configuration Override

Set configuration values at runtime (useful for testing or dynamic overrides):

```typescript
// Override a config value at runtime
quonfig.set("feature.beta", { bool: true });

// The override persists until the next config update or restart
const isEnabled = quonfig.isFeatureEnabled("feature.beta"); // true
```

## Connection Management

### Manual Updates

Force immediate configuration updates:

```typescript
// Force an update now
await quonfig.updateNow();

// Update only if configs are stale (older than 5 minutes)
quonfig.updateIfStalerThan(5 * 60 * 1000); // 5 minutes in ms
```

### Connection Control

```typescript
// Stop polling for updates (SSE continues if enabled)
quonfig.stopPolling();

// Properly close all connections and clean up resources
quonfig.close(); // Stops SSE, clears timeouts, disables telemetry
```

**Important**: Always call `quonfig.close()` when shutting down your application to ensure proper
cleanup of connections and prevent memory leaks.

## Telemetry

Quonfig automatically collects telemetry data to help you understand how your configurations are
being used. The telemetry system includes several components:

### Telemetry Components

```typescript
// Access telemetry components
console.log("Evaluation summaries:", quonfig.telemetry?.evaluationSummaries);
console.log("Context shapes:", quonfig.telemetry?.contextShapes);
console.log("Example contexts:", quonfig.telemetry?.exampleContexts);
console.log("Known loggers:", quonfig.telemetry?.knownLoggers);
```

### Configuration

Control telemetry collection via constructor options:

```typescript
const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,

  // Control evaluation summaries (default: true)
  collectEvaluationSummaries: true,

  // Control logger usage tracking (default: true)
  collectLoggerCounts: true,

  // Control context data collection (default: "periodicExample")
  contextUploadMode: "SHAPE_ONLY", // or "NONE" or "periodicExample"
});
```

**Context Upload Modes:**

- `"periodicExample"` - Sends both context structure and example values
- `"SHAPE_ONLY"` - Sends only context keys and types, no values
- `"NONE"` - Disables context collection entirely

## Reference

### Option Definitions

| Name                       | Description                                                                                                                            | Default           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| collectEvaluationSummaries | Send counts of config/flag evaluation results back to Quonfig to view in web app                                                | true              |
| collectLoggerCounts        | Send counts of logger usage back to Quonfig to power log-levels configuration screen                                            | true              |
| contextUploadMode          | Upload either context "shapes" (the names and data types your app uses in quonfig contexts) or periodically send full example contexts | "periodicExample" |
| defaultLevel               | Level to be used as the min-verbosity for a `loggerPath` if no value is configured in Quonfig                                   | "warn"            |
| enableSSE                  | Whether or not we should listen for live changes from Quonfig                                                                   | true              |
| enablePolling              | Whether or not we should poll for changes from Quonfig                                                                          | true              |
| loggerKey                  | The config key to use for dynamic log level configuration (defaults to `"log-levels.default"`)                                          | "log-levels.default" |
