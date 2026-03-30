---
title: React Native
---

Note: right now, this is a thin wrapper around the [React Client](./react.md). If there are specific React Native features you would like to see, please let us know!

## Install the latest version

Use your favorite package manager to install `@quonfig/react-native` [npm](https://www.npmjs.com/package/@quonfig/react-native) | [github](https://github.com/QuonfigHQ/react-native)

You will also need to install `base-64` and `react-native-get-random-values` as dependencies.

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install @quonfig/react-native base-64 react-native-get-random-values
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add @quonfig/react-native base-64 react-native-get-random-values
```

</TabItem>
</Tabs>

TypeScript types are included with the package.

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
    <QuonfigProvider apiKey={"QUONFIG_FRONTEND_SDK_KEY"} onError={onError}>
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

const Logo = () => {
  const { isEnabled } = useQuonfig();

  if (isEnabled("new-logo")) {
    return <img src={newLogo} className="App-logo" alt="logo" />;
  }

  return <img src={logo} className="App-logo" alt="logo" />;
};
```

You can also use `get` to access flags with other data types.

```jsx
const { get } = useQuonfig();

const flagVlaue = get("my-string-flag");
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

## Dynamic Config

Config values are accessed the same way as feature flag values. You can use `isEnabled` as a convenience for boolean values, and `get` works for all data types.

By default configs are not sent to frontend SDKs. You must enable access for each individual config. You can do this by checking the "Send to frontend SDKs" checkbox when creating or editing a config.

## Dealing with Loading States

The Quonfig client needs to load your feature flags from the [Quonfig CDN](/docs/explanations/concepts/frontend-sdks) before they are available. This means there will be a brief period when the client is in a loading state. If you call the `useQuonfig` hook during loading, you will see the following behavior.

```jsx
const { get, isEnabled, loading } = useQuonfig();

console.log(loading); // true
console.log(get("my-string-flag)); // undefined for all flags
console.log(isEnabled("my-boolean-flag")); // false for all flags
```

Here are some suggestions for how to handle the loading state.

### At the top level of your application or page component

For a single page application, you likely already display a spinner or skeleton component while fetching data from your own backend. In this case, we recommend checking whether Quonfig is loaded in the logic for displaying this state. That way you can ensure that Quonfig is always loaded before the rest of your component tree renders, and you will not need to check for `loading` when evaluating individual flags.

```jsx
const MyPageComponent (myData, myDataIsLoading) => {
  // highlight-start
  const { loading: quonfigIsLoading } = useQuonfig();

  if (myDataIsLoading || quonfigIsLoading) {
    // highlight-end
    return <MySpinnerComponent />
  }

  return (
    // actual page content
  )
}
```

However, if you have SEO concerns, such as when using a tool like Docusaurus, you may want to consider one of the following options instead.

### In individual components

You can get a `loading` value back each time you call the `useQuonfig` hook and use it to render a spinner or other loading state only for the part of the page that is affected by your flag. This can be a good choice if you are swapping between two different UI treatments and don't want your users to see the page flicker from one to the other after the initial render.

```jsx
const MyComponent () => {
  const {get, loading} = useQuonfig();

  if (loading) {
    return <MySpinnerComponent />
  }

  switch (get("my-feature-flag")) {
    case "new-ui":
      return (<div>Render the new UI...</div>);
    case "old-ui":
    default:
      return (<div>Render the old UI...</div>);
  }
}
```

### Do nothing

If your feature flag is choosing between rendering something and rendering nothing, it may be acceptable to have that content pop-in once Quonfig finishes loading. This works because `isEnabled` will always return false until the Quonfig client is loaded.

```jsx
const MyComponent () => {
  // highlight-next-line
  const {isEnabled} = useQuonfig();

  return (
    <div>
      // highlight-start
      {isEnabled("my-feature-flag") && (
        <div>
          // Flag content...
        </div>
      )}
      // highlight-end
      <div>
        // Other content...
      </div>
    </div>
  );
}
```

## Tracking Experiment Exposures

If you're using Quonfig for A/B testing, you can supply code for tracking experiment exposures to your data warehouse or analytics tool of choice.

```jsx
<QuonfigProvider
  apiKey={"QUONFIG_FRONTEND_SDK_KEY"}
  contextAttributes={contextAttributes}
  onError={onError}
  // highlight-start
  afterEvaluationCallback={(key, value) => {
    // call your analytics tool here...in this example we are sending data to posthog
    window.posthog?.capture("Feature Flag Evaluation", {
      key,
      value,
    });
  }}
  // highlight-end
>
  <App />
</QuonfigProvider>
```

`afterEvaluationCallback` will be called each time you evaluate a feature flag using `get` or `isEnabled`.

## Telemetry

By default, Quonfig will collect summary counts of feature flag evaluations to help you understand how your flags are being used in the real world. You can opt out of this behavior by passing `collectEvaluationSummaries={false}` when initializing `QuonfigProvider`.

## Testing

Wrap the component under test in a `QuonfigTestProvider` and provide a config object to set up your test state.

e.g. if you wanted to test the following trivial component

```jsx
function MyComponent() {
  const { get, isEnabled, loading } = useQuonfig();
  const greeting = get("greeting") || "Greetings";

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 role="alert">{greeting}</h1>
      {isEnabled("secretFeature") && (
        <button type="submit" title="secret-feature">
          Secret feature
        </button>
      )}
    </div>
  );
}
```

You could do the following in [jest]/[rtl]

```jsx
import { QuonfigTestProvider } from "./index";

const renderInTestProvider = (config: { [key: string]: any }) => {
  render(
    <QuonfigTestProvider config={config}>
      <MyComponent />
    </QuonfigTestProvider>
  );
};

it("shows a custom greeting", async () => {
  renderInTestProvider({ greeting: "Hello" });

  const alert = screen.queryByRole("alert");
  expect(alert).toHaveTextContent("Hello");
});

it("shows the secret feature when it is enabled", async () => {
  renderInTestProvider({ secretFeature: true });

  const secretFeature = screen.queryByTitle("secret-feature");
  expect(secretFeature).toBeInTheDocument();
});
```

[jest]: https://jestjs.io/
[rtl]: https://testing-library.com/docs/react-testing-library/intro/
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
| `quonfig`           | N/A                     | the underlying [JavaScript](./javascript.md) quonfig instance                            |
| `keys`              | N/A                     | an array of all the flag and config names in the current configuration                   |

:::tip

While `loading` is true, `isEnabled` will return `false` and `get` will return `undefined`.

:::
