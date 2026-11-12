---
title: React Native
---

Note: right now, this is a thin wrapper around the [React Client](./react.md). If there are specific React Native features you would like to see, please let us know!

## Install the latest version

Use your favorite package manager to install `@quonfig/react-native` [npm](https://www.npmjs.com/package/@quonfig/react-native) | [github](https://github.com/quonfig/sdk-react-native)

`@quonfig/react-native` is a thin polyfill wrapper around [`@quonfig/react`](./react.md), which is declared as a peer dependency, and `@quonfig/react` in turn declares `@quonfig/javascript` as a peer. npm 7+ installs peers for you, but Yarn does not, so list them explicitly. You will also need to install `base-64` and `react-native-get-random-values`. Install all five together:

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install @quonfig/react-native @quonfig/react@^2 @quonfig/javascript@^2 base-64 react-native-get-random-values@^1
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add @quonfig/react-native @quonfig/react@^2 @quonfig/javascript@^2 base-64 react-native-get-random-values@^1
```

</TabItem>
</Tabs>

Keep the version ranges on three of the packages:

- `@quonfig/react-native` 2.x peers on `@quonfig/react` 2.x, which needs `@quonfig/javascript` 2.x, so pin both to `^2`. If your app is still on `@quonfig/react` 1.x, stay on `@quonfig/react-native@^1`. Upgrading? Read "UPGRADE to 2.0" in the [sdk-react-native CHANGELOG](https://github.com/quonfig/sdk-react-native/blob/main/CHANGELOG.md).
- `react-native-get-random-values` 2.x needs React Native 0.81+ with the New Architecture. On older React Native versions, stay on `@^1`.

TypeScript types are included with the package.

## Import order

`@quonfig/react-native` installs the `crypto.getRandomValues` and `btoa`/`atob` polyfills when it is imported. Those polyfills must be in place before `@quonfig/javascript` loads, because that package creates its client (and calls `crypto.getRandomValues()`) as soon as it is imported. So:

1. Import `@quonfig/react-native` once at your app entry (`index.js`), before anything else:

   ```jsx
   // index.js
   import "@quonfig/react-native";
   import { AppRegistry } from "react-native";
   import App from "./App";

   AppRegistry.registerComponent("MyApp", () => App);
   ```

2. Import hooks and components from `@quonfig/react-native`, never from `@quonfig/react`. This also applies when you follow examples from the [React Client](./react.md) docs.

If `@quonfig/react` or `@quonfig/javascript` is evaluated first, the app can crash at startup with `crypto.getRandomValues() not supported`.

## Initialize the Client

This client includes a `<QuonfigProvider>` and `useQuonfig` hook.

First, wrap your component tree in the `QuonfigProvider`, e.g.

```jsx
import { QuonfigProvider } from "@quonfig/react-native";

const WrappedApp = () => {
  const onError = (reason) => {
    console.error(reason);
  };

  return (
    <QuonfigProvider sdkKey={"QUONFIG_FRONTEND_SDK_KEY"} onError={onError}>
      <MyApp />
    </QuonfigProvider>
  );
};
```

:::tip
If you wish for the user's device to poll for updates to flags, you can pass a `pollInterval` (in milliseconds) to the `QuonfigProvider`.
:::

## Feature Flags

Now use the `useQuonfig` hook to fetch flags. `isEnabled` is a convenience method for boolean flags.

```jsx
import { useQuonfig } from "@quonfig/react-native";
import { Image } from "react-native";

const Logo = () => {
  const { isEnabled } = useQuonfig();

  if (isEnabled("new-logo")) {
    return <Image source={newLogo} style={{ width: 100, height: 100 }} accessibilityLabel="logo" />;
  }

  return <Image source={logo} style={{ width: 100, height: 100 }} accessibilityLabel="logo" />;
};
```

You can also use `get` to access flags with other data types.

```jsx
const { get } = useQuonfig();

const flagValue = get("my-string-flag");
```

## Using Context

`contextAttributes` lets you provide [context](/docs/explanations/concepts/context) that you can use to [segment] your users. Usually you will want to define context once when you setup `QuonfigProvider`.

```jsx
import { QuonfigProvider } from "@quonfig/react-native";

const WrappedApp = () => {
  // highlight-start
  const contextAttributes = {
    user: { key: "abcdef", email: "jeffrey@example.com" },
    subscription: { key: "adv-sub", plan: "advanced" },
  };
  // highlight-end

  const onError = (reason) => {
    console.error(reason);
  };

  return (
    <QuonfigProvider
      sdkKey={"YOUR_FRONTEND_SDK_KEY"}
      // highlight-next-line
      contextAttributes={contextAttributes}
      onError={onError}
    >
      <App />
    </QuonfigProvider>
  );
};
```

`get()` and `isEnabled()` don't take a per-call context. To evaluate against a different context, see [Evaluating with a different context](/docs/sdks/react#evaluating-with-a-different-context) in the React docs; it applies to React Native unchanged.

## Dynamic Config

Config values are accessed the same way as feature flag values. You can use `isEnabled` as a convenience for boolean values, and `get` works for all data types.

By default configs are not sent to frontend SDKs. You must enable access for each individual config. You can do this by checking the "Send to frontend SDKs" checkbox when creating or editing a config.

## If Quonfig is unreachable at startup

React Native uses the React provider's startup behavior: the
`onInitFailure` (`"fail"` by default, `"wait"` or `"continue"`) and
`initTimeout` (5000 ms by default) props, and the `isReady`, `error` and
`source` fields on `useQuonfig()`. See the
[React page](./react.md#if-quonfig-is-unreachable-at-startup) for the details.

One difference matters: **React Native has no last-known-good cache.**
Hermes has no `localStorage`, so there is no cached copy from an earlier
launch. A cold launch with every delivery leg unreachable goes straight to
`onInitFailure`: under `"fail"`, `onError` fires, `isReady` is `false`,
`error` is set, and the app renders code defaults (`source: "defaults"`) until
the background retry reaches Quonfig. If your defaults are safe to show,
consider `"continue"`; see
[Browsers and mobile apps](/docs/explanations/architecture/startup-failure#browsers-and-mobile-apps).

## Dealing with Loading States

Until the first fetch from Quonfig's [delivery service](/docs/explanations/concepts/frontend-sdks) completes, `useQuonfig()` returns `loading: true`, `get()` returns `undefined` and `isEnabled()` returns `false`. The options for handling that (gate the whole screen, show a spinner in one component, or let content pop in) are the same as on the web; see [Dealing with Loading States](./react.md#dealing-with-loading-states) on the React page. In React Native, render `View`/`Text` instead of DOM elements.

## Tracking Experiment Exposures

Pass an `afterEvaluationCallback` to `QuonfigProvider` to send experiment exposures to your analytics tool; it runs each time you evaluate a flag with `get` or `isEnabled`. See [Tracking Experiment Exposures](./react.md#tracking-experiment-exposures) on the React page. In React Native there is no browser `window.posthog`, so with PostHog you construct a client instance (or use the `usePostHog()` hook):

```jsx
import PostHog from "posthog-react-native";

const posthog = new PostHog("YOUR_POSTHOG_API_KEY", {
  host: "https://us.i.posthog.com",
});

<QuonfigProvider
  sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
  contextAttributes={contextAttributes}
  onError={onError}
  // highlight-start
  afterEvaluationCallback={(key, value) => {
    posthog.capture("Feature Flag Evaluation", { key, value });
  }}
  // highlight-end
>
  <App />
</QuonfigProvider>
```

## Telemetry

By default, Quonfig will collect summary counts of feature flag evaluations to help you understand how your flags are being used in the real world. You can opt out of this behavior by passing `collectEvaluationSummaries={false}` when initializing `QuonfigProvider`.

Telemetry delivery (flush interval, timeout, retry and caps) comes from the underlying `@quonfig/javascript` client; see [JavaScript delivery options](./javascript.md#delivery-options) for the option names and the [Telemetry](../explanations/architecture/telemetry.md) page for how it behaves when the endpoint is slow or down. React Native uses the same defaults, with one exception: the browser's final flush on `pagehide` needs `window.addEventListener`, which React Native generally doesn't have. On React Native, the only final flush is the `close()` call that runs when `QuonfigProvider` unmounts. Evaluations recorded after the last periodic flush are lost if the app is killed before the provider unmounts.

## Invalid or revoked SDK key

`@quonfig/react-native` polls through `@quonfig/javascript`, so it follows the
browser SDK's rule: a rejected
SDK key logs one `console.error` and slows polling to once every 150-300
seconds until a poll is accepted. See
[JavaScript: invalid or revoked SDK key](./javascript.md#invalid-or-revoked-sdk-key)
and the full rule on the [Reliability](../explanations/architecture/resiliency.md#invalid-or-revoked-sdk-key) page.

## Testing

Wrap the component under test in a `QuonfigTestProvider` and pass a config object to set up your test state. The general approach is the same as on the [React page](./react.md#testing), with two React Native differences:

- Import `QuonfigTestProvider` from `@quonfig/react-native/testing`, which also installs the React Native polyfills. Hooks still come from `@quonfig/react-native`. (On `@quonfig/react-native` 1.x, `QuonfigTestProvider` is exported from the main entry instead.)
- Render with [React Native Testing Library][rntl] instead of React Testing Library.

```tsx
import { render, screen } from "@testing-library/react-native";
import { QuonfigTestProvider } from "@quonfig/react-native/testing";

const renderInTestProvider = (config: { [key: string]: any }) => {
  render(
    <QuonfigTestProvider config={config}>
      <MyComponent />
    </QuonfigTestProvider>
  );
};

it("shows a custom greeting", () => {
  renderInTestProvider({ greeting: "Hello" });

  expect(screen.getByRole("alert")).toHaveTextContent("Hello");
});

it("shows the secret feature when it is enabled", () => {
  renderInTestProvider({ secretFeature: true });

  expect(screen.getByText("Secret feature")).toBeOnTheScreen();
});
```

Here `MyComponent` reads `greeting` with `get` and renders a `Text` with `accessibilityRole="alert"`, and shows a "Secret feature" `Text` when `isEnabled("secretFeature")` is true.

[rntl]: https://callstack.github.io/react-native-testing-library/
[segment]: /docs/explanations/features/rules-and-segmentation

## Reference

### `useQuonfig` properties

```jsx
const { isEnabled, get, loading, contextAttributes } = useQuonfig();
```

Here's an explanation of each property

| property            | example                 | purpose                                                                                  |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `isEnabled`         | `isEnabled("new-logo")` | returns a boolean (default `false`) if a feature is enabled based on the current context |
| `get`               | `get('retry-count')`    | returns the value of a flag or config                                                    |
| `contextAttributes` | (see above)             | this is the context attributes object you passed when setting up the provider            |
| `loading`           | `if (loading) { ... }`  | a boolean indicating whether quonfig content is being loaded                             |
| `getDuration`       | `getDuration("api-timeout", fallback)` | returns the duration if the flag or config is a duration type; otherwise the default you pass (or `undefined`) |
| `isReady`           | `if (!isReady) { ... }` | whether the client holds live config (see [startup](#if-quonfig-is-unreachable-at-startup)) |
| `error`             | `error?.reason`         | the init error, if `init` failed; cleared when the client heals                          |
| `source`            | `source === "defaults"` | where current values come from: `"network"`, `"cache"` or `"defaults"` (no `"cache"` on React Native, see above) |
| `quonfig`           | N/A                     | the underlying [JavaScript](./javascript.md) quonfig instance                            |
| `keys`              | N/A                     | an array of all the flag and config names in the current configuration                   |

For a single key, `useFlag(key)` subscribes to just that flag; see [`useFlag`](./react.md#useflag--per-key-selector-hook) on the React page. Provider props are listed under [`QuonfigProvider` props](./react.md#quonfigprovider-props).

:::tip

While `loading` is true, `isEnabled` will return `false` and `get` will return `undefined`.

:::
