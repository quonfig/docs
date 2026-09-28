---
title: JavaScript
---

:::tip

If you're using React, consider using our [React Client] instead, which also provides full TypeScript support.

:::

## Install the latest version

Use your favorite package manager to install `@quonfig/javascript` [npm](https://www.npmjs.com/package/@quonfig/javascript) | [github](https://github.com/quonfig/sdk-javascript)

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

Without a bundler, import the ES module build from [jsDelivr][jsDelivr] in a `<script type="module">`:

```html
<script type="module">
  import { quonfig } from "https://cdn.jsdelivr.net/npm/@quonfig/javascript@1/+esm";
</script>
```

See the <a href="#context">context</a> section for more information on how to initialize with the `<script>` tag and a user context.

</TabItem>
</Tabs>

## Initialize the client

Initialize `quonfig` with your SDK key:

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
import { quonfig } from "@quonfig/javascript";

const options = {
  sdkKey: "YOUR_SDK_KEY",
  context: {
    user: {
      email: "test@example.com",
    },
    device: { mobile: true },
  },
};

await quonfig.init(options);
```

`quonfig.init` will request the calculated feature flags for the provided context as a single HTTPS request. If you need to check for updates to feature flag values, you can [learn more about polling](#poll) below.

You aren't required to `await` the `init` -- it is a promise, so you can use `.then`, `.finally`, `.catch`, etc. instead if you prefer.

</TabItem>

<TabItem value="script" label="<script> tag">

```html
<script type="module">
  import { quonfig } from "https://cdn.jsdelivr.net/npm/@quonfig/javascript@1/+esm";

  const options = {
    sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
    // context is required -- init() rejects without one
    context: {
      user: { email: "test@example.com" },
    },
  };

  quonfig.init(options).then(() => {
    console.log("test-flag is " + quonfig.isEnabled("test-flag"));
  });
</script>
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

Context is a plain object whose keys are context names, each mapping to attributes describing that context. You can use this to write targeting rules, e.g. [segment] your users.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
// highlight-next-line
import { quonfig } from "@quonfig/javascript";

const options = {
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  // highlight-start
  context: {
    user: { key: "abcdef", email: "test@example.com" },
    device: { key: "hijklm", mobile: true },
  },
  // highlight-end
};

await quonfig.init(options);
```

</TabItem>

<TabItem value="script" label="<script> tag">

```html
<script type="module">
  import { quonfig } from "https://cdn.jsdelivr.net/npm/@quonfig/javascript@1/+esm";

  const options = {
    sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
    // highlight-start
    context: {
      user: {
        email: "test@example.com",
      },
      device: { mobile: true },
    },
    // highlight-end
  };

  quonfig.init(options).then(() => {
    console.log("test-flag is " + quonfig.isEnabled("test-flag"));

    document.querySelector(".copywrite").textContent = quonfig.get("ex1-copywrite");
  });
</script>
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
  ...quonfig.contexts,
  user: { email: user.email, key: user.trackingId },
});

// updateContext will immediately load the newest from Quonfig based on the
// new context. Future polling will use the new context as well.
```

</TabItem>
</Tabs>

## Bootstrapping

If your server already knows the evaluation results for the current context, you can seed them into the page so the SDK renders the correct values on first paint — no initial HTTP request, and no flash of default content.

Set `globalThis._quonfigBootstrap` before calling `quonfig.init()`, using the same context you pass to `init()`:

```html
<script>
  window._quonfigBootstrap = {
    // Must match the context passed to quonfig.init()
    context: { user: { key: "u_123" } },
    // Server-evaluated payload, in the same shape api-delivery returns
    evaluations: {
      "my-flag": {
        value: { type: "bool", value: true },
        configId: "cfg-my-flag",
        configType: "feature_flag",
        valueType: "bool",
      },
    },
  };
</script>
```

`init()` consumes this snapshot **once**, for the first paint, when its context matches. After that it is ignored: [polling](#poll) and `updateContext()` fetch live values, so a server-side flag change is reflected and the SDK never reverts to the bootstrapped snapshot. If the live context does not match the snapshot, the SDK skips it and fetches normally.

The payload is typed as `QuonfigBootstrap` (exported from `@quonfig/javascript`). `@quonfig/react` reads the same `window._quonfigBootstrap` automatically — no extra props.

## Dynamic Config

Config values are accessed the same way as feature flag values. You can use `isEnabled` as a convenience for boolean values, and `get` works for all data types.

By default configs are not sent to client SDKs. You must enable access for each individual config. You can do this by checking the "Send to client SDKs" checkbox when creating or editing a config.

## Dynamic Log Levels

Log levels in Quonfig are stored as a `log_level` config (e.g. `log-level.my-app`). The browser SDK exposes a single primitive — `shouldLog` — that consults that config and returns a boolean. You decide how to wire it into the logging calls you actually use.

:::info Client-Side Limitations
The browser SDK evaluates log levels against the **context snapshot captured at init**. Real-time per-request context (like backend SDKs get) isn't a thing here — if you change context, call `quonfig.updateContext(newContext)` to re-evaluate. Best suited for **application-wide log level control** or rules that key on relatively stable context (user, app version, environment).
:::

### Concept

- A `log_level` config, keyed like `log-level.my-app`. Value is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`.
- Tell the SDK which config to consult with the `loggerKey` init option. `shouldLog({loggerPath, ...})` always reads that one config; `loggerPath` does not change which config is read.
- The browser SDK does not evaluate rules itself. The server evaluates every config for the context you pass to `init()` / `updateContext()`, and `shouldLog` compares `desiredLevel` against that one pre-evaluated value. So every `loggerPath` gets the same answer from a given config.
- `shouldLog` also records `loggerPath` in the SDK's context as `quonfig-sdk-logging.key` (verbatim, no normalization). This makes logger names visible to example-context telemetry, so the dashboard can suggest them as rule targets. It does **not** change the current evaluation.

### Basic usage

```javascript
import { quonfig } from "@quonfig/javascript";

await quonfig.init({
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  context: { user: { email: "test@example.com" } },
  loggerKey: "log-level.my-app",
});

if (quonfig.shouldLog({ loggerPath: "checkout.cart", desiredLevel: "DEBUG" })) {
  console.debug("cart debug line", computeExpensiveData());
}
```

The primitive shape — `shouldLog({configKey, desiredLevel, defaultLevel})` — is also available if you want to evaluate a config directly without the `loggerKey`/`loggerPath` convenience. `defaultLevel` is required in this form (it's the fallback verbosity when the config has no value); the `loggerPath` convenience makes it optional.

### Rule example

Rules on a browser `log_level` config should target the context you pass to `init()`, such as user email, app version or deploy ring. For example, a `log-level.my-app` config with default `INFO` and a rule that returns `DEBUG` when `user.email` ends with `@mycompany.com` turns on debug logging for internal users only.

Do not write browser rules on `quonfig-sdk-logging.key`. The logger path is not part of the context when the value is evaluated. The SDK keeps the last `loggerPath` it saw in its context, so a later poll or `updateContext()` sends whichever logger happened to call `shouldLog` last, and the result is unpredictable. Per-logger rules on `quonfig-sdk-logging.key` work in the server SDKs, which evaluate locally for each call.

### Per-logger levels

For different levels per logger in the browser, create a separate `log_level` config for each logger and use the `configKey` form. If a key has no value, `shouldLog` tries its parent key: `log-level.my-app.checkout.cart` falls back to `log-level.my-app.checkout`, then to `log-level.my-app`, then to `defaultLevel`.

```javascript
// log-level.my-app          = INFO
// log-level.my-app.checkout = DEBUG
quonfig.shouldLog({
  configKey: "log-level.my-app.checkout.cart",
  desiredLevel: "DEBUG",
  defaultLevel: "WARN",
}); // true: falls back to log-level.my-app.checkout

quonfig.shouldLog({
  configKey: "log-level.my-app.search",
  desiredLevel: "DEBUG",
  defaultLevel: "WARN",
}); // false: falls back to log-level.my-app (INFO)
```

### Updating context

Because evaluation is pinned to the context snapshot captured at init, flip verbosity for a specific user by calling `updateContext` — this refetches and re-evaluates:

```javascript
await quonfig.updateContext({ user: { email: "developer@example.com" } });
// subsequent shouldLog calls see the new context
```

## Tracking Experiment Exposures

If you're using [Quonfig for A/B testing](/docs/how-tos/experiment.md), you can supply code for tracking experiment exposures to your data warehouse or analytics tool of choice.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

```javascript
import { quonfig } from "@quonfig/javascript";

const options = {
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  context: {
    user: { key: "abcdef", email: "test@example.com" },
    device: { key: "hijklm", mobile: true },
  },
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

### Delivery options

How the SDK delivers telemetry, and what it does when the endpoint is slow or down, is the same in
every SDK and is explained once on the [Telemetry](../explanations/architecture/telemetry.md) page.
The browser option names and defaults, passed to `quonfig.init()` (`@quonfig/javascript` 1.3.0+):

| Option                            | Default           |
| --------------------------------- | ----------------- |
| `telemetryFlushIntervalMs`        | `30000` (30s)     |
| `telemetryTimeoutMs`              | `10000` (10s)     |
| `telemetryMaxRetainedBatches`     | `5`               |
| `telemetryMaxRetainedBytes`       | `524288` (512KB)  |
| `telemetryMaxRetainedAgeMs`       | `300000` (5 min)  |
| `telemetryMaxEvaluationSummaries` | `10000`           |

Invalid values (non-finite or `<= 0`) fall back to the default. The eval-fetch `timeout` option
does not apply to telemetry. Failed batches are kept in memory for the life of the page, and
`Retry-After` is honored only when the page can read the header.

**When the page goes away.** On `pagehide` the SDK sends the current window once with
`fetch(..., { keepalive: true })` and a 2s deadline, without blocking unload. Kept batches from an
earlier failure are not resent.

Telemetry drops log one `console.warn` and recovery one `console.info`. Debug lines print (via
`console.debug`) only when the `log-level.quonfig-javascript.quonfig.telemetry` config (or a parent
key such as `log-level.quonfig-javascript`) evaluates to `DEBUG` or `TRACE`.

Changes in 1.3.0: the final flush moved from `beforeunload` to a `pagehide` keepalive POST;
telemetry has its own 10s timeout instead of sharing the eval-fetch `timeout`; the per-window cap
dropped from 100,000 to 10,000 evaluation-summary keys; a telemetry network error is no longer an
unhandled promise rejection.

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

| property        | example                                         | purpose                                                                                                                                                                                  |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contexts`      | `quonfig.contexts`                              | get the current context (after `init()`).                                                                                                                                                |
| `extract`       | `quonfig.extract()`                             | returns the current config as a plain object of key, config value pairs                                                                                                                  |
| `getDuration`   | `quonfig.getDuration("timeout-key")`            | returns a Duration object with `seconds` and `ms` properties for duration configs                                                                                                        |
| `get`           | `quonfig.get('retry-count')`                    | returns the value of a flag or config evaluated in the current context                                                                                                                   |
| `hydrate`       | `quonfig.hydrate(configurationObject)`          | sets the current config based on a plain object of key, config value pairs                                                                                                               |
| `isEnabled`     | `quonfig.isEnabled("new-logo")`                 | returns a boolean (default `false`) if a feature is enabled based on the current context                                                                                                 |
| `loaded`        | `if (quonfig.loaded) { ... }`                   | a boolean indicating whether quonfig content has loaded                                                                                                                                  |
| `loggerKey`     | `quonfig.loggerKey`                             | the init-time `loggerKey` used by the `shouldLog({loggerPath, ...})` overload                                                                                                            |
| `poll`          | `quonfig.poll({frequencyInMs})`                 | starts polling every `frequencyInMs` ms.                                                                                                                                                 |
| `shouldLog`     | `quonfig.shouldLog({loggerPath, desiredLevel})` | returns whether a message at `desiredLevel` should emit; accepts either `{loggerPath}` (uses init-time `loggerKey`) or `{configKey}`                                                     |
| `stopPolling`   | `quonfig.stopPolling()`                         | stops the polling process                                                                                                                                                                |
| `flush`         | `await quonfig.flush()`                         | sends the current telemetry window now without tearing the SDK down. Useful before a context swap in a long-lived SPA. After a failed POST it waits out the 30s floor and `Retry-After`. Returns a Promise that never rejects. |
| `close`         | `await quonfig.close()`                         | stops polling and the telemetry timer, removes the `pagehide` listener, then sends the current telemetry window once with a 2s deadline and `keepalive`. Returns a Promise that never rejects. Prefer this over `stopTelemetry()` for normal teardown so the last window isn't dropped. |
| `stopTelemetry` | `quonfig.stopTelemetry()`                       | stops telemetry aggregator timers without sending. Prefer `close()` or `flush()` — they send the current window first.                                                                   |
| `updateContext` | `quonfig.updateContext(newContext)`             | update the context and refetch. Pass `true` as the second argument (`skipLoad`) to update the context **without** refetching; the default (`false`) refetches immediately.               |

### `init()` Options

| option                       | type     | default               | description                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | -------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdkKey`                     | string   | required              | Your Quonfig SDK key                                                                                                                                                                                                                                                                                                       |
| `context`                    | Contexts | required              | Initial context for evaluation. A plain object keyed by context name (e.g. `{ user: { key, email }, device: { mobile } }`).                                                                                                                                                                                                |
| `domain`                     | string   | `"quonfig.com"`       | Single knob that flips api + telemetry URLs in lockstep. e.g. `domain: "quonfig-staging.com"` resolves api to `https://primary.quonfig-staging.com` (+ secondary) and telemetry to `https://telemetry.quonfig-staging.com`. Highest-precedence default; overridden only by explicit `apiUrls` / `apiUrl` / `telemetryUrl`. |
| `apiUrls`                    | string[] | derived from `domain` | Ordered list of API base URLs to try (failover order). Escape hatch for deploys that don't follow the `primary.${domain}` / `secondary.${domain}` convention. When set, wins over `domain`.                                                                                                                                |
| `apiUrl`                     | string   | `undefined`           | Convenience alias for callers with a single API base URL. Normalized to `apiUrls = [apiUrl]`. `apiUrls` wins if both are set.                                                                                                                                                                                              |
| `telemetryUrl`               | string   | derived from `domain` | Base URL for the telemetry service. Escape hatch for deploys that split telemetry off the primary domain. When set, wins over `domain`.                                                                                                                                                                                    |
| `timeout`                    | number   | `3000`                | Per-leg hard fetch deadline in ms. Keep it **above** `hedgeDelay` — a `timeout <= hedgeDelay` aborts the primary before the parallel hedge can fire (`init()` warns when this happens).                                                                                                                                       |
| `hedgeDelay`                 | number   | `2000`                | How long the hedged loader waits for the primary API URL before **also** firing the secondary in parallel (ms). Raise toward the primary's measured p99 to contact the secondary less often.                                                                                                                                 |
| `loggerKey`                  | string   | `undefined`           | The `log_level` config key consulted by `shouldLog({loggerPath})`. Required for the `loggerPath` form.                                                                                                                                                                                                                     |
| `collectEvaluationSummaries` | boolean  | `true`                | Send evaluation summary telemetry to Quonfig                                                                                                                                                                                                                                                                               |
| `collectContextMode`         | string   | `"PERIODIC_EXAMPLE"`  | Context telemetry mode: `"PERIODIC_EXAMPLE"`, `"SHAPE_ONLY"`, or `"NONE"`                                                                                                                                                                                                                                                  |
| `afterEvaluationCallback`    | function | `undefined`           | Callback invoked after each flag/config evaluation                                                                                                                                                                                                                                                                         |

[React Client]: /docs/sdks/react
[jsDelivr]: https://www.jsdelivr.com/package/npm/@quonfig/javascript
[segment]: /docs/explanations/features/rules-and-segmentation
