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

Log levels in Quonfig are stored as a `log_level` config (e.g. `log-level.my-app`). The browser SDK exposes a single primitive — `shouldLog` — that consults that config and returns a boolean. You decide how to wire it into the logging calls you actually use.

:::info Client-Side Limitations
The browser SDK evaluates log levels against the **context snapshot captured at init**. Real-time per-request context (like backend SDKs get) isn't a thing here — if you change context, call `quonfig.updateContext(newContext)` to re-evaluate. Best suited for **application-wide log level control** or rules that key on relatively stable context (user, app version, environment).
:::

### Concept

- One `log_level` config per app, keyed like `log-level.my-app`. Value is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`.
- Tell the SDK which config to consult with the `loggerKey` init option.
- Each `shouldLog({loggerPath, ...})` call pushes `loggerPath` into the evaluation context as `quonfig-sdk-logging.key` (verbatim — no normalization) so a single config can drive per-logger rules.
- Logger names flowing through `quonfig-sdk-logging.key` are captured by example-context telemetry, so the dashboard can auto-suggest rule targets.

### Basic usage

```javascript
import { quonfig, Context } from "@quonfig/javascript";

await quonfig.init({
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  context: new Context({ user: { email: "test@example.com" } }),
  loggerKey: "log-level.my-app",
});

if (quonfig.shouldLog({ loggerPath: "checkout.cart", desiredLevel: "DEBUG" })) {
  console.debug("cart debug line", computeExpensiveData());
}
```

The primitive shape — `shouldLog({configKey, desiredLevel})` — is also available if you want to evaluate a config directly without the `loggerKey`/`loggerPath` convenience.

### Rule example

Create a `log_level` config with key `log-level.my-app` and target individual loggers via `quonfig-sdk-logging.key`:

```yaml
# Default to INFO
default: INFO

rules:
  # DEBUG for the checkout subsystem
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "checkout."
    value: DEBUG

  # Turn DEBUG on for internal users
  - criteria:
      user.email:
        ends-with: "@mycompany.com"
    value: DEBUG
```

Because the evaluator sees the full init-time context — not just `quonfig-sdk-logging.*` — you can combine logger rules with global context (app version, deploy ring, user email) for targeted debugging.

### Updating context

Because evaluation is pinned to the context snapshot captured at init, flip verbosity for a specific user by calling `updateContext` — this refetches and re-evaluates:

```javascript
await quonfig.updateContext(
  new Context({ user: { email: "developer@example.com" } })
);
// subsequent shouldLog calls see the new context
```

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
| `hydrate`       | `quonfig.hydrate(configurationObject)` | sets the current config based on a plain object of key, config value pairs                   |
| `isEnabled`     | `quonfig.isEnabled("new-logo")`        | returns a boolean (default `false`) if a feature is enabled based on the current context     |
| `loaded`        | `if (quonfig.loaded) { ... }`          | a boolean indicating whether quonfig content has loaded                                      |
| `loggerKey`     | `quonfig.loggerKey`                    | the init-time `loggerKey` used by the `shouldLog({loggerPath, ...})` overload                |
| `poll`          | `quonfig.poll({frequencyInMs})`        | starts polling every `frequencyInMs` ms.                                                     |
| `shouldLog`     | `quonfig.shouldLog({loggerPath, desiredLevel})` | returns whether a message at `desiredLevel` should emit; accepts either `{loggerPath}` (uses init-time `loggerKey`) or `{configKey}` |
| `stopPolling`   | `quonfig.stopPolling()`                | stops the polling process                                                                    |
| `stopTelemetry` | `quonfig.stopTelemetry()`              | stops telemetry collection and clears aggregators                                            |
| `updateContext` | `quonfig.updateContext(newContext)`    | update the context and refetch. Pass `false` as a second argument to skip refetching         |

### `init()` Options

| option                     | type     | default                | description                                                                                  |
| -------------------------- | -------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `sdkKey`                   | string   | required               | Your Quonfig SDK key                                                                         |
| `apiUrls`                  | string[] | `["https://primary.quonfig.com"]` | Ordered list of API base URLs to try                                              |
| `context`                  | Context  | `{}`                   | Initial context for evaluation                                                               |
| `loggerKey`                | string   | `undefined`            | The `log_level` config key consulted by `shouldLog({loggerPath})`. Required for the `loggerPath` form. |
| `defaultLevel`             | string   | `"warn"`               | Default level used if no matching config is found                                            |
| `collectEvaluationSummaries` | boolean | `true`                | Send evaluation summary telemetry to Quonfig                                                 |
| `collectContextMode`       | string   | `"PERIODIC_EXAMPLE"`   | Context telemetry mode: `"PERIODIC_EXAMPLE"`, `"SHAPE_ONLY"`, or `"NONE"`                   |
| `afterEvaluationCallback`  | function | `undefined`            | Callback invoked after each flag/config evaluation                                           |

[React Client]: /docs/sdks/react
[jsDelivr]: https://www.jsdelivr.com/package/npm/@quonfig/javascript
[segment]: /docs/explanations/features/rules-and-segmentation
