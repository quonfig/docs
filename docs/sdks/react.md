---
title: React
---

:::note
If you're using React Native, check out the [React Native SDK](/docs/sdks/react-native).
:::

:::warning Next.js Environment Variables
When using Next.js, client-side environment variables must be prefixed with `NEXT_PUBLIC_`. Use `NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY` instead of `QUONFIG_FRONTEND_SDK_KEY` in your `.env` file:

```bash
# .env.local
NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY=your-key-here
```

:::

:::tip TypeScript Support

**⭐ Recommended**: Use the [Quonfig CLI](/docs/tools/cli#typescript-code-generation) to generate TypeScript definitions for type-safe access to your flags and configs:

```bash
npx @quonfig/cli generate --targets react-ts
```

:::

## Install the latest version

Use your favorite package manager to install `@quonfig/react` [npm](https://www.npmjs.com/package/@quonfig/react) | [github](https://github.com/QuonfigHQ/sdk-react)

<Tabs groupId="lang">
<TabItem value="npm" label="npm">

```bash
npm install @quonfig/react
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add @quonfig/react
```

</TabItem>
</Tabs>

TypeScript types are included with the package.

## Initialize the Client

This client includes a `<QuonfigProvider>` and `useQuonfig` hook.

First, wrap your component tree in the `QuonfigProvider`, e.g.

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

First, generate your types:

```bash
npx @quonfig/cli generate --targets react-ts
```

Then set up your provider (same as TypeScript):

```tsx
import { QuonfigProvider } from "@quonfig/react";
import type { ReactNode } from "react";

// The generated types will automatically enhance the provider
const WrappedApp = (): ReactNode => {
  const onError = (reason: Error) => {
    console.error(reason);
  };

  return (
    <QuonfigProvider sdkKey={"QUONFIG_FRONTEND_SDK_KEY"} onError={onError}>
      <MyApp />
    </QuonfigProvider>
  );
};
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```tsx
import { QuonfigProvider } from "@quonfig/react";
import type { ReactNode } from "react";

const WrappedApp = (): ReactNode => {
  const onError = (reason: Error) => {
    // error handler for initialization failures
    console.error(reason);
  };

  return (
    <QuonfigProvider sdkKey={"QUONFIG_FRONTEND_SDK_KEY"} onError={onError}>
      <MyApp /> {/* All child components can now use useQuonfig hook */}
    </QuonfigProvider>
  );
};
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```jsx
import { QuonfigProvider } from "@quonfig/react";

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

</TabItem>
</Tabs>

:::tip
If you wish for the user's browser to poll for updates to flags, you can pass a `pollInterval` (in milliseconds) to the `QuonfigProvider`.
:::

## Feature Flags

Now use the `useQuonfig` hook to fetch flags. `isEnabled` is a convenience method for boolean flags.

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

With generated types, you import the custom typed hook:

```tsx
// Import the generated typed hook (not the regular useQuonfig)
import { useQuonfig } from "./generated/quonfig-client";
import type { ReactElement } from "react";

const Logo = (): ReactElement => {
  const quonfig = useQuonfig();

  // Type-safe camelCase property access with autocomplete
  if (quonfig.newLogo) {
    // boolean type inferred
    return <img src={newLogo} className="App-logo" alt="logo" />;
  }

  return <img src={logo} className="App-logo" alt="logo" />;
};
```

You get type-safe access to all your flags and configs:

```tsx
const MyComponent = (): ReactElement => {
  const quonfig = useQuonfig();

  // All properties are type-safe with IntelliSense
  const retryCount = quonfig.apiRetryCount; // number type
  const welcomeMessage = quonfig.welcomeMessage; // string type
  const featureEnabled = quonfig.coolNewFeature; // boolean type

  // Function configs get parameters for templating
  const personalizedGreeting = quonfig.personalizedWelcome({
    name: "John",
  }); // Type-safe parameters!

  return (
    <div>
      <h1>{personalizedGreeting}</h1>
      {featureEnabled && <NewFeatureComponent />}
      <p>Retry attempts: {retryCount}</p>
    </div>
  );
};
```

:::warning Use Destructuring with Caution
React-specific type safe methods are generated as [class `getter` accessor methods](https://www.typescriptlang.org/docs/handbook/2/classes.html#getters--setters). As a result, if you destructure them directly from the `useQuonfig` hook, they are immediately evaluated inline.
:::

:::danger DON'T

```typescript
function MyComponent({someBoolean}: {someBoolean: boolean}) {
  // Immediately evaluated regardless of usage
  const { welcomeMessage } = useQuonfig();

  return (
    <div>
      {someBoolean ? (
        <p>Welcome!</p>
      ) : (
        <h1>{welcomeMessage}</h1>
      )}
    </div>
  );
};
```

:::

:::success DO

```typescript
function MyComponent() {
  const quonfig = useQuonfig();

  return (
    <div>
      {someBoolean ? (
        <p>Welcome!</p>
      ) : (
        // Only evaluated if used
        <h1>{quonfig.welcomeMessage}</h1>
      )}
    </div>
  );
};
```

:::

</TabItem>
<TabItem value="typescript" label="TypeScript">

```tsx
import { useQuonfig } from "@quonfig/react";
import type { ReactElement } from "react";

const Logo = (): ReactElement => {
  const { isEnabled } = useQuonfig(); // get quonfig context from provider

  if (isEnabled("new-logo")) {
    // check if feature flag is enabled
    return <img src={newLogo} className="App-logo" alt="logo" />;
  }

  return <img src={logo} className="App-logo" alt="logo" />; // fallback UI
};
```

You can also use `get` to access flags with other data types.

```tsx
const { get } = useQuonfig(); // destructure get function

const stringFlag: string | undefined = get("my-string-flag"); // string config
const numberConfig: number | undefined = get("retry-count"); // number config
const duration = getDuration("api-timeout"); // duration object
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```jsx
import { useQuonfig } from "@quonfig/react";

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

const flagValue = get("my-string-flag");
```

</TabItem>
</Tabs>

## Using Context

`contextAttributes` lets you provide [context](/docs/explanations/concepts/context) that you can use to [segment] your users. Usually you will want to define context once when you setup `QuonfigProvider`.

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

With generated types, the provider setup is the same, but you get enhanced type safety throughout:

```tsx
import { QuonfigProvider } from "@quonfig/react";
import type { Contexts } from "@quonfig/react";
import type { ReactNode } from "react";

const WrappedApp = (): ReactNode => {
  // highlight-start
  const contextAttributes: Contexts = {
    user: { key: "abcdef", email: "jeffrey@example.com" },
    subscription: { key: "adv-sub", plan: "advanced" },
  };
  // highlight-end

  const onError = (reason: Error) => {
    console.error(reason);
  };

  return (
    <QuonfigProvider
      sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
      // highlight-next-line
      contextAttributes={contextAttributes}
      onError={onError}
    >
      <App />
    </QuonfigProvider>
  );
};
```

The context then flows through to your components automatically:

```tsx
// In your components, the typed hook has access to the context
const UserDashboard = (): ReactElement => {
  const quonfig = useQuonfig(); // From generated hook

  // Context is automatically available - flags are evaluated with your user context
  const showPremiumFeatures = quonfig.premiumFeatures; // boolean
  const userSpecificMessage = quonfig.welcomeMessage; // string

  return (
    <div>
      <h1>{userSpecificMessage}</h1>
      {showPremiumFeatures && <PremiumDashboard />}
    </div>
  );
};
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```tsx
import { QuonfigProvider } from "@quonfig/react";
import type { Contexts } from "@quonfig/react";
import type { ReactNode } from "react";

const WrappedApp = (): ReactNode => {
  // highlight-start
  const contextAttributes: Contexts = {
    user: { key: "abcdef", email: "jeffrey@example.com" }, // user targeting context
    subscription: { key: "adv-sub", plan: "advanced" }, // subscription context
  };
  // highlight-end

  const onError = (reason: Error) => {
    // error handler for failures
    console.error(reason);
  };

  return (
    <QuonfigProvider
      sdkKey={"QUONFIG_FRONTEND_SDK_KEY"} // client SDK key
      // highlight-next-line
      contextAttributes={contextAttributes} // targeting context for all flags
      onError={onError}
    >
      <App /> {/* All child components inherit this context */}
    </QuonfigProvider>
  );
};
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```jsx
import { QuonfigProvider } from "@quonfig/react";

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
      sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
      // highlight-next-line
      contextAttributes={contextAttributes}
      onError={onError}
    >
      <App />
    </QuonfigProvider>
  );
};
```

</TabItem>
</Tabs>

## Dynamic Config

Config values are accessed the same way as feature flag values using the same camelCase method definitions when using TypeScript. In addition:

- you can use `quonfig.get("your.key.here")` for all data types.
- you can use `quonfig.isEnabled("boolean.key.here")` as a convenience for boolean values
- you can use `quonfig.getDuration("timeframe.key.here")` for time-frame values

By default configs are not sent to frontend SDKs. You must enable access for each individual config. You can do this by checking the "Send to frontend SDKs" checkbox when creating or editing a config.

## Mustache Templating

Quonfig supports Mustache templating for dynamic string configurations, allowing you to create personalized messages, URLs, and other dynamic content in your React components.

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
- **Send to Client SDKs**: ✅ Enabled

### Usage Examples

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

The CLI generates type-safe template functions for React:

```tsx
// Import the generated typed hook
import { useQuonfig } from "./generated/quonfig-client";
import type { ReactElement } from "react";

const WelcomeMessage = (): ReactElement => {
  const quonfig = useQuonfig();

  // Get the configured object
  const welcomeMessageObject = quonfig.welcomeMessage;

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

  return (
    <div className="welcome-banner">
      <h2>{welcomeText}</h2>
      <button>{welcomeCta}</button>
    </div>
  );
};
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

For non-generated usage, handle templating manually:

```tsx
import { useQuonfig } from "@quonfig/react";
import Mustache from "mustache";
import type { ReactElement } from "react";

const WelcomeMessage = (): ReactElement => {
  const { get } = useQuonfig(); // get quonfig hook

  // Get the configured object
  const welcomeMessageObject = quonfig.get("welcome.message");

  // Returns: "Hello Alice! Welcome to MyApp. You have 150 credits remaining."
  const welcomeText = template
    ? Mustache.render(welcomeMessageObject.message, {
        userName: "Alice",
        appName: "MyApp",
        creditsCount: 150,
      })
    : "Welcome!";

  // Returns: Buy More Credits
  const welcomeCta = welcomeMessageObject.cta || "Buy More";

  return (
    <div className="welcome-banner">
      <h2>{welcomeText}</h2>
      <button>{welcomeCta}</button>
    </div>
  );
};
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

For raw javascript usage, handle templating manually:

```jsx
import { useQuonfig } from "@quonfig/react";
import Mustache from "mustache";

const WelcomeMessage = () => {
  const { get } = useQuonfig();

  // Get the configured object
  const welcomeMessageObject = quonfig.get("welcome.message");

  // Returns: "Hello Alice! Welcome to MyApp. You have 150 credits remaining."
  const welcomeText = template
    ? Mustache.render(welcomeMessageObject.message, {
        userName: "Alice",
        appName: "MyApp",
        creditsCount: 150,
      })
    : "Welcome!";

  // Returns: Buy More Credits
  const welcomeCta = welcomeMessageObject.cta || "Buy More";

  return (
    <div className="welcome-banner">
      <h2>{welcomeText}</h2>
      <button>{welcomeCta}</button>
    </div>
  );
};
```

</TabItem>
</Tabs>

## Dealing with Loading States

The Quonfig client needs to load your feature flags from the [Quonfig CDN](/docs/explanations/concepts/frontend-sdks) before they are available. This means there will be a brief period when the client is in a loading state. If you call the `useQuonfig` hook during loading, you will see the following behavior.

```jsx
const { get, isEnabled, getDuration, loading } = useQuonfig();

console.log(loading); // true
console.log(get("my-string-flag)); // undefined for all flags
console.log(getDuration("my-timeframe-flag")); // undefined for all flags
console.log(isEnabled("my-boolean-flag")); // false for all flags
```

Here are some suggestions for how to handle the loading state.

### At the top level of your application or page component

For a single page application, you likely already display a spinner or skeleton component while fetching data from your own backend. In this case, we recommend checking whether Quonfig is loaded in the logic for displaying this state. That way you can ensure that Quonfig is always loaded before the rest of your component tree renders, and you will not need to check for `loading` when evaluating individual flags.

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```tsx
import type { ReactElement } from "react";

interface MyPageComponentProps {
  myData: any;
  myDataIsLoading: boolean;
}

const MyPageComponent = ({ myData, myDataIsLoading }: MyPageComponentProps): ReactElement => {
  // highlight-start
  const { loading: quonfigIsLoading } = useQuonfig(); // check if flags are loading

  if (myDataIsLoading || quonfigIsLoading) { // wait for both data and flags
    // highlight-end
    return <MySpinnerComponent />; // show loading state
  }

  return (
    // actual page content - both data and flags are ready
  );
};
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```jsx
const MyPageComponent = ({ myData, myDataIsLoading }) => {
  // highlight-start
  const { loading: quonfigIsLoading } = useQuonfig();

  if (myDataIsLoading || quonfigIsLoading) {
    // highlight-end
    return <MySpinnerComponent />;
  }

  return (
    // actual page content
  );
};
```

</TabItem>
</Tabs>

However, if you have SEO concerns, such as when using a tool like Docusaurus, you may want to consider one of the following options instead.

### In individual components

You can get a `loading` value back each time you call the `useQuonfig` hook and use it to render a spinner or other loading state only for the part of the page that is affected by your flag. This can be a good choice if you are swapping between two different UI treatments and don't want your users to see the page flicker from one to the other after the initial render.

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```tsx
import type { ReactElement } from "react";

const MyComponent = (): ReactElement => {
  const { get, loading } = useQuonfig(); // get flag value and loading state

  if (loading) {
    // flags not ready yet
    return <MySpinnerComponent />; // prevent flickering
  }

  switch (
    get("my-feature-flag") // safe to read flags now
  ) {
    case "new-ui":
      return <div>Render the new UI...</div>; // new experience
    case "old-ui":
    default:
      return <div>Render the old UI...</div>; // fallback experience
  }
};
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```jsx
const MyComponent = () => {
  const { get, loading } = useQuonfig();

  if (loading) {
    return <MySpinnerComponent />;
  }

  switch (get("my-feature-flag")) {
    case "new-ui":
      return <div>Render the new UI...</div>;
    case "old-ui":
    default:
      return <div>Render the old UI...</div>;
  }
};
```

</TabItem>
</Tabs>

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

If you're using [Quonfig for A/B testing](/docs/how-tos/experiment.md), you can supply code for tracking experiment exposures to your data warehouse or analytics tool of choice.

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```tsx
<QuonfigProvider
  sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
  contextAttributes={contextAttributes}
  onError={onError}
  // highlight-start
  afterEvaluationCallback={(key: string, value: unknown) => {
    // call your analytics tool here...in this example we are sending data to posthog
    (window as any).posthog?.capture("Feature Flag Evaluation", {
      key,
      value,
    });
  }}
  // highlight-end
>
  <App />
</QuonfigProvider>
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```jsx
<QuonfigProvider
  sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
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

</TabItem>
</Tabs>

`afterEvaluationCallback` will be called each time you evaluate a feature flag using `get` or `isEnabled`.

## Telemetry

By default, Quonfig will collect summary counts of config and feature flag evaluations to help you understand how your configs and flags are being used in the real world. You can opt out of this behavior by passing `collectEvaluationSummaries={false}` when initializing `QuonfigProvider`.

Quonfig also stores the context that you pass in. The context keys are used to power autocomplete in the rule editor, and the individual values power the Contexts page for troubleshooting targeting rules and individual flag overrides. If you want to change what Quonfig stores, you can pass a different value for `collectContextMode`.

| `collectContextMode` value | Behavior                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `PERIODIC_EXAMPLE`         | Stores context values and context keys. This is the default.   |
| `SHAPE_ONLY`               | Stores context keys only.                                      |
| `NONE`                     | Stores nothing. Context will only be used for rule evaluation. |

## Testing

Wrap the component under test in a `QuonfigTestProvider` and provide a config object to set up your test state.

e.g. if you wanted to test the following trivial component

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

Component using generated types:

```tsx
// Import the generated typed hook
import { useQuonfig } from "./generated/quonfig-client";
import type { ReactElement } from "react";

function MyComponent(): ReactElement {
  const quonfig = useQuonfig();

  // Type-safe property access
  const greeting = quonfig.greeting || "Greetings";

  if (quonfig.loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 role="alert">{greeting}</h1>
      {quonfig.secretFeature && (
        <button type="submit" title="secret-feature">
          Secret feature
        </button>
      )}
    </div>
  );
}
```

You could do the following in [jest]/[rtl]

```tsx
import { render, screen } from "@testing-library/react";
import { QuonfigTestProvider } from "@quonfig/react";

// Use the raw config object (camelCase gets converted internally)
const renderInTestProvider = (config: Record<string, any>) => {
  render(
    <QuonfigTestProvider config={config}>
      <MyComponent />
    </QuonfigTestProvider>,
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

</TabItem>
<TabItem value="typescript" label="TypeScript">

```tsx
import type { ReactElement } from "react";

function MyComponent(): ReactElement {
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

```tsx
import { render, screen } from "@testing-library/react";
import { QuonfigTestProvider } from "@quonfig/react";

const renderInTestProvider = (config: Record<string, any>) => {
  render(
    <QuonfigTestProvider config={config}>
      <MyComponent />
    </QuonfigTestProvider>,
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

</TabItem>
<TabItem value="javascript" label="JavaScript">

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
import { render, screen } from "@testing-library/react";
import { QuonfigTestProvider } from "@quonfig/react";

const renderInTestProvider = (config) => {
  render(
    <QuonfigTestProvider config={config}>
      <MyComponent />
    </QuonfigTestProvider>,
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

</TabItem>
</Tabs>

[jest]: https://jestjs.io/
[rtl]: https://testing-library.com/docs/react-testing-library/intro/
[segment]: /docs/explanations/features/rules-and-segmentation

## Server-Side Rendering (SSR) to Client-Side Rendering (CSR) Rehydration

For SSR frameworks like Next.js, Remix, or custom React SSR setups, you can eliminate client-side loading states and improve performance by pre-fetching flag data on the server and rehydrating it on the client.

This approach uses the underlying `@quonfig/javascript` client's `extract` and `hydrate` methods, which are accessible through the React hook.

:::info
A fully working example is available as an [Example Launch Next.js](https://github.com/QuonfigHQ/example-launch-nextjs) application.
:::

### Overview

The SSR + rehydration pattern works by:

1. **Server-side**: Fetch flag data using a frontend SDK key
2. **Server-side**: Extract the data for client rehydration
3. **Client-side**: Hydrate the React client with pre-fetched data
4. **Result**: No loading states, immediate flag availability

### Server-Side Implementation

First, fetch and extract flag data on your server:

<Tabs groupId="framework">
<TabItem value="nextjs" label="Next.js App Router">

```tsx
// app/page.tsx or your server component
import { quonfig } from "@quonfig/javascript";
import { AppWithPreloadedQuonfig } from "../components/AppWithPreloadedQuonfig";

export default async function Page() {
  // Get user context from request, session, etc.
  const contextAttributes: Contexts = {
    user: { key: "user-123", email: "user@example.com" },
    // Add any server-side context you have available
  };

  // Wait for flags to load
  await quonfig.init({
    sdkKey: process.env.NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY!,
    context: new Context(contextAttributes),
  });

  // Extract data for client hydration
  const initialFlags = quonfig.extract();

  return (
    <div>
      <AppWithPreloadedQuonfig
        initialFlags={initialFlags}
        contextAttributes={contextAttributes}
      />
    </div>
  );
}
```

</TabItem>
<TabItem value="nextjs-pages" label="Next.js Pages Router">

```tsx
// pages/index.tsx
import { quonfig, Contexts } from "@quonfig/javascript";
import type { GetServerSideProps } from "next";
import { AppWithPreloadedQuonfig } from "../components/AppWithPreloadedQuonfig";

interface Props {
  initialFlags: Record<string, unknown>;
  contextAttributes: any;
}

export default function HomePage({ initialFlags, contextAttributes }: Props) {
  return (
    <div>
      <AppWithPreloadedQuonfig
        initialFlags={initialFlags}
        contextAttributes={contextAttributes}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Get user context from request, session, etc.
  const contextAttributes: Contexts = {
    user: { key: "user-123", email: "user@example.com" },
    // Add any server-side context you have available
  };

  await quonfig.init({
    sdkKey: process.env.NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY!,
    context: new Context(contextAttributes),
  });

  const initialFlags = serverQuonfig.extract();

  return {
    props: {
      initialFlags,
      contextAttributes,
    },
  };
};
```

</TabItem>
<TabItem value="remix" label="Remix">

```tsx
// app/routes/_index.tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { quonfig } from "@quonfig/javascript";
import { AppWithPreloadedQuonfig } from "../components/AppWithPreloadedQuonfig";

interface LoaderData {
  initialFlags: any;
  userContext: any;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Get user context from request, session, etc.
  const contextAttributes: Contexts = {
    user: { key: "user-123", email: "user@example.com" },
    // Add any server-side context you have available
  };

  await quonfig.init({
    sdkKey: process.env.QUONFIG_FRONTEND_SDK_KEY!,
    context: new Context(contextAttributes),
  });

  const initialFlags = serverQuonfig.extract();

  return json<LoaderData>({
    initialFlags,
    contextAttributes,
  });
}

export default function Index() {
  const { initialFlags, contextAttributes } = useLoaderData<LoaderData>();

  return (
    <div>
      <AppWithPreloadedQuonfig
        initialFlags={initialFlags}
        contextAttributes={contextAttributes}
      />
    </div>
  );
}
```

</TabItem>
</Tabs>

### Client-Side Rehydration

Create a client component that hydrates the React provider with server data:

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

```tsx
// components/AppWithPreloadedQuonfig.tsx
"use client"; // Next.js App Router client component

import { QuonfigProvider, Contexts } from "@quonfig/react";
import { useQuonfig } from "./generated/quonfig-client";
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

interface AppWithPreloadedQuonfigProps {
  children: ReactNode;
  initialFlags: Record<string, unknown>;
  contextAttributes: Contexts;
}

const AppWithPreloadedQuonfig = ({
  children,
  initialFlags,
  contextAttributes,
}: AppWithPreloadedQuonfigProps): ReactElement => {
  return (
    <QuonfigProvider
      sdkKey={process.env.NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY!}
      contextAttributes={contextAttributes}
      initialFlags={initialFlags}
    >
      {/* Flags are immediately available, no loading state needed */}
      <MainApp />
    </QuonfigProvider>
  );
};

// Your main app component
const MainApp = (): ReactElement => {
  const quonfig = useQuonfig(); // From generated client

  // Flags are immediately available due to hydration
  const showNewFeature = quonfig.newFeature; // No loading check needed!
  const welcomeMessage = quonfig.welcomeMessage || "Welcome!";

  return (
    <div>
      <h1>{welcomeMessage}</h1>
      {showNewFeature && <NewFeatureComponent />}
      <MainContent />
    </div>
  );
};
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```tsx
// components/AppWithPreloadedQuonfig.tsx
"use client";

import { QuonfigProvider, useQuonfig, Contexts } from "@quonfig/react";
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

interface AppWithPreloadedQuonfigProps {
  children: ReactNode;
  initialFlags: Record<string, unknown>;
  contextAttributes: Contexts;
}

const AppWithPreloadedQuonfig = ({
  children,
  initialFlags,
  contextAttributes,
}: AppWithPreloadedQuonfigProps): ReactElement => {
  return (
    <QuonfigProvider
      sdkKey={process.env.NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY!}
      contextAttributes={contextAttributes}
      initialFlags={initialFlags}
    >
      {/* Flags are immediately available, no loading state needed */}
      <MainApp />
    </QuonfigProvider>
  );
};

// Your main app component
const MainApp = (): ReactElement => {
  const { get, isEnabled } = useQuonfig();

  // Flags are immediately available due to hydration
  const showNewFeature = isEnabled("new-feature");
  const welcomeMessage = get("welcome-message") || "Welcome!";

  return (
    <div>
      <h1>{welcomeMessage}</h1>
      {showNewFeature && <NewFeatureComponent />}
      <MainContent />
    </div>
  );
};
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```jsx
// components/AppWithPreloadedQuonfig.jsx
"use client";

import { QuonfigProvider, useQuonfig } from "@quonfig/react";

const AppWithPreloadedQuonfig = ({
  children,
  initialFlags,
  contextAttributes,
}) => {
  return (
    <QuonfigProvider
      sdkKey={process.env.NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY}
      contextAttributes={contextAttributes}
      initialFlags={initialFlags}
    >
      <MainApp />
    </QuonfigProvider>
  );
};

// Your main app component
const MainApp = () => {
  const { get, isEnabled } = useQuonfig();

  // Flags are immediately available due to hydration
  const showNewFeature = isEnabled("new-feature");
  const welcomeMessage = get("welcome-message") || "Welcome!";

  return (
    <div>
      <h1>{welcomeMessage}</h1>
      {showNewFeature && <NewFeatureComponent />}
      <MainContent />
    </div>
  );
};
```

</TabItem>
</Tabs>

### Alternative: Using the `quonfig` Instance Directly

You can also access the underlying JavaScript client directly from the hook:

```tsx
import { useQuonfig } from "@quonfig/react";
import { useEffect } from "react";

const MyComponent = ({ initialFlags }) => {
  const { quonfig } = useQuonfig(); // Access underlying JavaScript client

  useEffect(() => {
    if (quonfig && initialFlags) {
      // Hydrate the client with server data
      quonfig.hydrate(initialFlags);
    }
  }, [quonfig, initialFlags]);

  // Rest of your component...
};
```

### Benefits of SSR + Rehydration

- **⚡ No loading states**: Flags are immediately available on first render
- **🎯 Better SEO**: Server-rendered content reflects the actual flag states
- **🚀 Improved performance**: Eliminates client-side API requests for initial flag data
- **💫 Better UX**: No flickering between loading and final states
- **🎨 Consistent rendering**: Server and client render the same content

### Important Considerations

:::warning Context Consistency

Ensure that the **same context attributes** are used on both server and client side components. Mismatched context can lead to different flag evaluations and hydration mismatches.

```tsx
// ❌ Bad: Different context on server vs client
// Server: { user: { key: "123" } }
// Client: { user: { key: "456" } }

// ✅ Good: Same context on both sides
const userContext = { user: { key: "123", email: "user@example.com" } };
```

:::

:::info SDK Key Requirements

You should only use a **QUONFIG_FRONTEND_SDK_KEY** during this process, for both fetching flags on the server in a react context + the React provider (only receives client-enabled flags).

As a result, only configs with "Send to frontend SDKs" enabled with be available on the client.
:::

### Error Handling

Handle cases where server-side flag loading fails:

```tsx
// Server-side error handling
export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Get user context from request, session, etc.
    const contextAttributes: Contexts = {
      user: { key: "user-123", email: "user@example.com" },
      // Add any server-side context you have available
    };

    await quonfig.init({
      sdkKey: process.env.QUONFIG_FRONTEND_SDK_KEY!,
      context: new Context(contextAttributes),
    });

    const initialFlags = quonfig.extract();

    return { props: { initialFlags, contextAttributes } };
  } catch (error) {
    console.error("Failed to load flags on server:", error);

    // Fallback: let client handle loading normally
    return { props: { initialFlags: null, contextAttributes } };
  }
};

// Client-side fallback
const AppWithPreloadedQuonfig = ({ initialFlags, contextAttributes }) => {
  return (
    <QuonfigProvider
      sdkKey={process.env.NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY!}
      contextAttributes={contextAttributes}
      initialFlags={initialFlags}
    >
      <MainApp />
    </QuonfigProvider>
  );
};
```

## Framework-Specific Guides

#### Environment Variables

Many frameworks have specific requirements for client-side environment variables:

### Environment Variable Reference

| Framework        | Client-side Variable                   | Server-side Variable      |
| ---------------- | -------------------------------------- | ------------------------- |
| Next.js          | `NEXT_PUBLIC_QUONFIG_FRONTEND_SDK_KEY` | `QUONFIG_BACKEND_SDK_KEY` |
| Remix            | `QUONFIG_FRONTEND_SDK_KEY`             | `QUONFIG_BACKEND_SDK_KEY` |
| Vite             | `VITE_QUONFIG_FRONTEND_SDK_KEY`        | `QUONFIG_BACKEND_SDK_KEY` |
| Create React App | `REACT_APP_QUONFIG_FRONTEND_SDK_KEY`   | `QUONFIG_BACKEND_SDK_KEY` |

## Advanced Patterns

### Custom Typed Hooks with `createQuonfigHook`

For advanced users who want to further extend quonfig hook functionality, you can use the `createQuonfigHook` factory function:

```tsx
import { createQuonfigHook } from "@quonfig/react";
import { QuonfigTypesafeReact } from "./generated/quonfig-client";

class MyTypesafeQuonfigClass extends QuonfigTypesafeReact {
  get mySpecialCustomProperty() {
    // implementation here
  }
}

// Create a custom hook with your typesafe class
const useMyCustomQuonfig = createQuonfigHook(MyTypesafeQuonfigClass);

// Use in components
const MyComponent = () => {
  const quonfig = useMyCustomQuonfig(); // Fully typed with your generated types

  // Access properties with full type safety
  const isEnabled = quonfig.myFeatureFlag; // boolean
  const mySpecialProperty = quonfig.mySpecialCustomProperty; // string | number | etc.

  return (
    <div>
      {isEnabled && <FeatureComponent />}
      <SpecialPropertyDisplay value={mySpecialProperty} />
    </div>
  );
};
```

**Use cases:**

- Creating domain-specific hooks (e.g., `useFeatureFlags`, `useAppConfig`)
- Encapsulating complex configuration logic
- Building custom abstractions over Quonfig functionality

:::info Custom Hook Requirements

Please reference the current [`createQuonfigHook`](https://github.com/QuonfigHQ/sdk-react/blob/main/src/QuonfigProvider.tsx#L105-L128) implementation for additional details.

You must implement `get` method + expose the javascript `quonfig` property directly in custom implementations.
:::

### Advanced Context Patterns

For complex applications, you can create sophisticated context attribute patterns:

```tsx
// Dynamic context based on user state
const AppWrapper = ({ user, subscription, device }) => {
  const contextAttributes = useMemo(
    () => ({
      user: {
        key: user.id,
        email: user.email,
        plan: subscription.plan,
        signupDate: user.signupDate,
        // Add computed attributes
        daysSinceSignup: Math.floor(
          (Date.now() - new Date(user.signupDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      },
      subscription: {
        key: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        trialDays: subscription.trialDaysRemaining,
      },
      device: {
        key: device.id,
        type: device.type,
        mobile: device.mobile,
        browserVersion: device.browserVersion,
      },
    }),
    [user, subscription, device],
  );

  return (
    <QuonfigProvider
      sdkKey={process.env.QUONFIG_FRONTEND_SDK_KEY!}
      contextAttributes={contextAttributes}
      onError={handleQuonfigError}
    >
      <App />
    </QuonfigProvider>
  );
};
```

## Reference

### `useQuonfig` properties

```jsx
const { isEnabled, get, loading, contextAttributes } = useQuonfig();
```

Here's an explanation of each property

| property            | example                   | purpose                                                                                  |
| ------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| `contextAttributes` | (see above)               | this is the context attributes object you passed when setting up the provider            |
| `getDuration`       | `getDuration("new-logo")` | returns a duration type if a flag or config is a duration type                           |
| `get`               | `get('retry-count')`      | returns the value of a flag or config                                                    |
| `isEnabled`         | `isEnabled("new-logo")`   | returns a boolean (default `false`) if a feature is enabled based on the current context |
| `keys`              | N/A                       | an array of all the flag and config names in the current configuration                   |
| `loading`           | `if (loading) { ... }`    | a boolean indicating whether quonfig content is being loaded                             |
| `quonfig`           | N/A                       | the underlying [JavaScript](./javascript.md) quonfig instance                            |

:::tip

While `loading` is true, `isEnabled` will return `false` and `getDuration`/`get` will return `undefined`.

:::

### `QuonfigProvider` props

| prop                         | required | type              | purpose                                                                       |
| ---------------------------- | -------- | ----------------- | ----------------------------------------------------------------------------- |
| `sdkKey`                     | yes      | `string`          | your Quonfig frontend SDK key                                                 |
| `contextAttributes`          | no       | `Contexts`        | targeting context passed to all flag evaluations                              |
| `initialFlags`               | no       | `Record<string, unknown>` | pre-seeded flag values for SSR hydration; disables network request  |
| `pollInterval`               | no       | `number`          | poll for updates every N milliseconds                                         |
| `apiUrls`                    | no       | `string[]`        | ordered list of API base URLs to try (defaults to Quonfig CDNs)              |
| `apiUrl`                     | no       | `string`          | single API base URL (use `apiUrls` to specify multiple for failover)          |
| `timeout`                    | no       | `number`          | initialization timeout in milliseconds (default 10000)                        |
| `onError`                    | no       | `(error) => void` | callback invoked on initialization failure                                    |
| `collectEvaluationSummaries` | no       | `boolean`         | opt out of evaluation summary telemetry (default `true`)                      |
| `collectLoggerNames`         | no       | `boolean`         | collect logger name telemetry (default `false`)                               |
| `afterEvaluationCallback`    | no       | `(key, value, contexts) => void` | callback invoked after each flag evaluation               |
