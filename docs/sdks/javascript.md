---
title: JavaScript
---

:::tip

If you're using React, consider using our [React Client] instead, which also provides full TypeScript support.

:::

## Install the latest version

Use your favorite package manager to install `@quonfig/javascript` [npm](https://www.npmjs.com/package/@quonfig/javascript) | [github](https://github.com/QuonfigHQ/sdk-javascript)

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install @quonfig/javascript
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add @quonfig/javascript
```

</TabItem>
<TabItem value="script" label="<script> tag">

We recommend using [jsDelivr][jsDelivr] for a minified/bundled version.

```
<script src="https://cdn.jsdelivr.net/npm/@quonfig/javascript@0.0.3/dist/quonfig.bundle.js"></script>
```

See the <a href="#context">context</a> section for more information on how to initialize with the `<script>` tag and a user context.

</TabItem>
</Tabs>

## Initialize the client

Initialize `quonfig` with your SDK key:

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
import { quonfig, Context } from "@quonfig/javascript";

const options = {
  sdkKey: "YOUR_SDK_KEY",
  context: new Context({
    user: {
      email: "test@example.com",
    },
    device: { mobile: true },
  }),
};

await quonfig.init(options);
```

`quonfig.init` will request the calculated feature flags for the provided context as a single HTTPS request. If you need to check for updates to feature flag values, you can [learn more about polling](#poll) below.

You aren't required to `await` the `init` -- it is a promise, so you can use `.then`, `.finally`, `.catch`, etc. instead if you prefer.

</TabItem>

<TabItem value="script" label="<script> tag">

```javascript
// `quonfig` is available globally on the window object
const options = {
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
};

quonfig.init(options).then(() => {
  console.log(options);
  console.log("test-flag is " + quonfig.isEnabled("test-flag"));
});
```

</TabItem>
</Tabs>

:::tip

While `quonfig` is loading, `isEnabled` will return `false`, `get` will return `undefined`, and `shouldLog` will use your `defaultLevel`.

:::

## Feature Flags

Now you can use `quonfig`'s feature flag evaluation, e.g.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
if (quonfig.isEnabled("cool-feature")) {
  // ... this code only evaluates if `cool-feature` is enabled for the current context
}
```

You can also use:

- `get` to access the value of non-boolean flags

  ```javascript
  const stringValue = quonfig.get("my-string-flag");
  ```

- `getDuration` for time-specific values
  ```javascript
  const timeout = quonfig.getDuration("api-timeout");
  if (timeout) {
    console.log(`Timeout: ${timeout.seconds}s (${timeout.ms}ms)`);
  }
  ```

</TabItem>
</Tabs>

## Context

`Context` accepts an object with keys that are context names and key value pairs with attributes describing the context. You can use this to write targeting rules, e.g. [segment] your users.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
// highlight-next-line
import { quonfig, Context } from "@quonfig/javascript";

const options = {
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  // highlight-start
  context: new Context({
    user: { key: "abcdef", email: "test@example.com" },
    device: { key: "hijklm", mobile: true },
  }),
  // highlight-end
};

await quonfig.init(options);
```

</TabItem>

<TabItem value="script" label="<script> tag">

```javascript
// `quonfig` is available globally on the window object
// `Context` is available globally as `window.quonfigNamespace.Context`
const options = {
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  // highlight-start
  context: new quonfigNamespace.Context({
    user: {
      email: "test@example.com",
    },
    device: { mobile: true },
  }),
  // highlight-end
};

quonfig.init(options).then(() => {
  console.log(options);
  console.log("test-flag is " + quonfig.isEnabled("test-flag"));

  console.log("ex1-copywrite " + quonfig.get("ex1-copywrite"));
  $(".copywrite").text(quonfig.get("ex1-copywrite"));
});
```

</TabItem>
</Tabs>

## `poll()`

After `quonfig.init()`, you can start polling. Polling uses the context you defined in `init` by default. You can update the context for future polling by setting it on the `quonfig` object.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
// some time after init
quonfig.poll({ frequencyInMs: 300000 });

// we're now polling with the context used from `init`

// later, perhaps after a visitor logs in and now you have the context of
// their current user
quonfig.updateContext({
  ...quonfig.context,
  user: { email: user.email, key: user.trackingId },
});

// updateContext will immediately load the newest from Quonfig based on the
// new context. Future polling will use the new context as well.
```

</TabItem>
</Tabs>

## Dynamic Config

Config values are accessed the same way as feature flag values. You can use `isEnabled` as a convenience for boolean values, and `get` works for all data types.

By default configs are not sent to client SDKs. You must enable access for each individual config. You can do this by checking the "Send to client SDKs" checkbox when creating or editing a config.

## Dynamic Log Levels

The Quonfig JavaScript SDK provides basic dynamic log level control for client-side applications. This allows you to control console logging verbosity from the Quonfig dashboard.

:::info Client-Side Limitations
The JavaScript SDK evaluates log levels once during initialization using the provided context. Unlike backend SDKs that support real-time per-request context, the JavaScript SDK:
- Evaluates log levels with a **single context** at initialization time
- Best suited for **application-wide log level control** rather than per-user targeting

For more advanced logging features, consider using backend SDKs.
:::

### Basic Usage

The SDK provides a built-in logger with standard log levels:

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
import { quonfig } from "@quonfig/javascript";

await quonfig.init({
  sdkKey: "YOUR_SDK_KEY",
  context: new Context({ user: { email: "test@example.com" } }),
});

// Use the built-in logger
quonfig.logger.trace("Trace message");
quonfig.logger.debug("Debug message");
quonfig.logger.info("Info message");
quonfig.logger.warn("Warning message");
quonfig.logger.error("Error message");
quonfig.logger.fatal("Fatal error");
```

The logger automatically checks the configured log level and only outputs to console when appropriate.

</TabItem>
</Tabs>

### Configuration

Create a `LOG_LEVEL_V2` config in your Quonfig dashboard with key `log-levels.default`:

```yaml
# Default log level for the application
default: INFO

# Optional: Use rules for context-based levels (evaluated once at init)
rules:
  - criteria:
      user.email:
        ends-with: "@mycompany.com"
    value: DEBUG
```

You can customize the config key name using the `loggerKey` option. This is particularly useful if you have multiple applications sharing the same Quonfig project:

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
await quonfig.init({
  sdkKey: "YOUR_SDK_KEY",
  context: new Context({ user: { email: "test@example.com" } }),
  loggerKey: "my-app.log-levels", // Custom config key
});
```

</TabItem>
</Tabs>

### Programmatic Log Level Checking

You can check log levels programmatically to conditionally execute expensive logging operations:

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
import { quonfig, LogLevel, shouldLogAtLevel } from "@quonfig/javascript";

// Get the configured log level
const currentLevel = quonfig.getLogLevel("my.logger");

// Check if a specific level should be logged
if (shouldLogAtLevel(currentLevel, LogLevel.DEBUG)) {
  // Only compute expensive debug info when DEBUG is enabled
  console.debug("Expensive computation:", computeExpensiveData());
}

// Get numeric severity for custom logic
const severity = getLogLevelSeverity(currentLevel);
```

</TabItem>
</Tabs>

Available log levels (in order of severity):
- `LogLevel.TRACE` (most verbose)
- `LogLevel.DEBUG`
- `LogLevel.INFO`
- `LogLevel.WARN`
- `LogLevel.ERROR`
- `LogLevel.FATAL` (least verbose)

### How It Works

The JavaScript SDK evaluates the log level configuration once during initialization:

1. When you call `quonfig.init()`, the SDK fetches all configs including log levels
2. Log levels are evaluated using the context provided to `init()`
3. The configured level remains static until you call `quonfig.updateContext()` or manually refresh
4. The built-in `quonfig.logger.*` methods automatically filter based on the configured level

:::tip
Since log levels are evaluated with the initial context, the `loggerKey` option is the most effective way to isolate log levels between different applications or deployments. Use separate config keys like `"app-v1.log-levels"` and `"app-v2.log-levels"` rather than relying on complex context-based rules.
:::

## Tracking Experiment Exposures

If you're using [Quonfig for A/B testing](/docs/how-tos/experiment.md), you can supply code for tracking experiment exposures to your data warehouse or analytics tool of choice.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
import { quonfig, Context } from "@quonfig/javascript";

const options = {
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  context: new Context({
    user: { key: "abcdef", email: "test@example.com" },
    device: { key: "hijklm", mobile: true },
  }),
  // highlight-start
  afterEvaluationCallback: (key, value) => {
    // call your analytics tool here...in this example we are sending data to posthog
    window.posthog?.capture("Feature Flag Evaluation", {
      key,
      value,
    });
  },
  // highlight-end
};

await quonfig.init(options);
```

</TabItem>
</Tabs>

`afterEvaluationCallback` will be called each time you evaluate a feature flag or config using `get` or `isEnabled`.

## Telemetry

By default, Quonfig will collect summary counts of config and feature flag evaluations to help you understand how your configs and flags are being used in the real world. You can opt out of this behavior by passing `collectEvaluationSummaries: false` in the options to `quonfig.init`.

Quonfig also stores the context that you pass in. The context keys are used to power autocomplete in the rule editor, and the individual values power the Contexts page for troubleshooting targeting rules and individual flag overrides. If you want to change what Quonfig stores, you can pass a different value for `collectContextMode`.

| `collectContextMode` value | Behavior                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `PERIODIC_EXAMPLE`         | Stores context values and context keys. This is the default.   |
| `SHAPE_ONLY`               | Stores context keys only.                                      |
| `NONE`                     | Stores nothing. Context will only be used for rule evaluation. |

## Testing

In your test suite, you should skip `quonfig.init` altogether and instead use `quonfig.hydrate` to set up your test state.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
it("shows the turbo button when the feature is enabled", () => {
  quonfig.hydrate({
    turbo: true,
    defaultMediaCount: 3,
  });

  const rendered = new MyComponent().render();

  expect(rendered).toMatch(/Enable Turbo/);
  expect(rendered).toMatch(/Media Count: 3/);
});
```

</TabItem>
</Tabs>

## Reference

### `quonfig` Properties

| property        | example                                | purpose                                                                                      |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `context`       | `quonfig.context`                      | get the current context (after `init()`).                                                    |
| `extract`       | `quonfig.extract()`                    | returns the current config as a plain object of key, config value pairs                      |
| `getDuration`   | `quonfig.getDuration("timeout-key")`   | returns a Duration object with `seconds` and `ms` properties for duration configs            |
| `get`           | `quonfig.get('retry-count')`           | returns the value of a flag or config evaluated in the current context                       |
| `getLogLevel`   | `quonfig.getLogLevel("my.logger")`     | returns the configured LogLevel enum value for the specified logger name                     |
| `hydrate`       | `quonfig.hydrate(configurationObject)` | sets the current config based on a plain object of key, config value pairs                   |
| `isEnabled`     | `quonfig.isEnabled("new-logo")`        | returns a boolean (default `false`) if a feature is enabled based on the current context     |
| `loaded`        | `if (quonfig.loaded) { ... }`          | a boolean indicating whether quonfig content has loaded                                      |
| `logger`        | `quonfig.logger.info("message")`       | built-in logger with methods: trace, debug, info, warn, error, fatal                         |
| `poll`          | `quonfig.poll({frequencyInMs})`        | starts polling every `frequencyInMs` ms.                                                     |
| `shouldLog`     | `if (quonfig.shouldLog(...)) {`        | returns a boolean indicating whether the proposed log level is valid for the current context |
| `stopPolling`   | `quonfig.stopPolling()`                | stops the polling process                                                                    |
| `stopTelemetry` | `quonfig.stopTelemetry()`              | stops telemetry collection and clears aggregators                                            |
| `updateContext` | `quonfig.updateContext(newContext)`    | update the context and refetch. Pass `false` as a second argument to skip refetching         |

### `init()` Options

| option                     | type     | default                | description                                                                                  |
| -------------------------- | -------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `sdkKey`                   | string   | required               | Your Quonfig SDK key                                                                         |
| `context`                  | Context  | `{}`                   | Initial context for evaluation                                                               |
| `loggerKey`                | string   | `"log-levels.default"` | Config key for LOG_LEVEL_V2 configuration (useful for isolating log levels per application) |
| `defaultLevel`             | LogLevel | `LogLevel.WARN`        | Default log level when no configuration is found                                             |
| `collectEvaluationSummaries` | boolean | `true`                | Send evaluation summary telemetry to Quonfig                                                 |
| `collectContextMode`       | string   | `"PERIODIC_EXAMPLE"`   | Context telemetry mode: `"PERIODIC_EXAMPLE"`, `"SHAPE_ONLY"`, or `"NONE"`                   |
| `afterEvaluationCallback`  | function | `undefined`            | Callback invoked after each flag/config evaluation                                           |

[React Client]: /docs/sdks/react
[jsDelivr]: https://www.jsdelivr.com/package/npm/@quonfig/javascript
[segment]: /docs/explanations/features/rules-and-segmentation
