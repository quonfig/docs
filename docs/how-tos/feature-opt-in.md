---
title: Feature Opt-In
sidebar_label: Feature Opt-In
---

You've built a new feature and you're ready to ship it. How do you make sure it's ready for your users?

Test internally of course!

So first you get the VP of Sales to signup for a Quonfig account and then... Clearly that's not going to work. How can we **easily** let end users opt-in to a feature?

There are a few parts to the problem:

### 1. How do we know who to enable the feature for?

The way I like to do this is to have a magic URL parameter that is clear, copy-pasteable and obviously editable.

Let's support `example.com/?features[v2-beta]=true`. If we Slack the VP of Sales a link with this in it, it should automatically put them in the beta group. If they want to get back out, they can just change the `true` to `false`.

<details className="">
<summary>Code</summary>

This code will parse anything that looks like `?features[___]=___` and store it as a "feature request". We don't want a magic URL that can force any feature flag we like, that would be too dangerous. By treating these as a "request" we retain the ultimate ability to decide if we want to honor the request or not in the feature flag UI, which is where it should be.

It reads the URL with the browser's `URLSearchParams`, so it runs once at startup, outside any React component, and doesn't need a router.

```javascript
// matches features[v2-beta] and captures "v2-beta"
const FEATURE_PARAM = /^features\[(.+)\]$/;

function readFeatureRequests() {
  // get any existing "featureRequests" from local storage
  let featureReqs = {};
  try {
    featureReqs = JSON.parse(localStorage.getItem("featureRequests") ?? "{}");
  } catch (e) {
    // localStorage can throw an error if the user has disabled via privacy settings
    console.error(e);
  }

  // pass in url params eg ?features[v2-beta]=false
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.forEach((value, key) => {
    const match = key.match(FEATURE_PARAM);
    if (match) {
      featureReqs[match[1]] = value; // the string "true", "false", "variant-a", ...
    }
  });

  return featureReqs;
}
```

</details>

### 2. Persist this information

For today, let's imagine a React app and we'll use the browser's local storage. We'll store a JSON object with the feature names as keys. The values come from the URL, so they are strings such as `"true"` and `"false"`, not booleans.

<details className="">
<summary>Code</summary>

```javascript
function storeFeatureRequests(featureReqs) {
  if (Object.keys(featureReqs).length === 0) return;
  try {
    localStorage.setItem("featureRequests", JSON.stringify(featureReqs));
  } catch (e) {
    console.error(e);
  }
}
```

</details>

### 3. Send this Context to Quonfig for evaluation

Now we'll just send the feature requests along with the user's tracking id to Quonfig like we would any other [context](/docs/explanations/concepts/context). We'll use the `featureRequests` key to create a rule that will enable the feature for this user.

<details className="">
<summary>Code</summary>

```jsx
import { QuonfigProvider, useQuonfig } from "@quonfig/react";

// runs once, when the module loads
const featureReqs = readFeatureRequests();
storeFeatureRequests(featureReqs);

// at the top level of your app; `user` is however your app loads the signed-in user
export function App({ user }) {
  const context = {
    user: { key: user.trackingId },
    // highlight-next-line
    featureRequests: featureReqs, // we can now create a rule IF featureRequests.v2-beta is "true"
  };

  const onError = (reason) => {
    console.error(reason);
  };

  return (
    <QuonfigProvider
      sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
      contextAttributes={context}
      onError={onError}
    >
      <MyComponent />
    </QuonfigProvider>
  );
}

// in your component that renders the feature
const MyComponent = () => {
  // highlight-start
  const { isEnabled } = useQuonfig();

  if (isEnabled("v2-beta-flag")) {
    return <div>New Improved V2 UI</div>;
  }
  // highlight-end

  return <div>Old UI</div>;
};
```

</details>

### 4. Configure our flag to respect this preference

Now we can create a rule that will enable the feature for anyone whose `featureRequests.v2-beta` is the string `"true"`.

![UI matching our context key](/img/docs/how-tos/optin-ff.jpg)

By being explicit about it in the UI, we've ensured that this capability only exists for flags where we'd like this to be true.

The nice thing about this approach is that we shouldn't need to touch this code again. The next time we want to allow internal users to use a feature flag, we can just agree on the url param `?features[v3-redesign]=variant-a`, add the rule in the UI and we're good to go.

## Putting it all together

Here's all of the code together.

```jsx
import { QuonfigProvider, useQuonfig } from "@quonfig/react";

// highlight-start
// matches features[v2-beta] and captures "v2-beta"
const FEATURE_PARAM = /^features\[(.+)\]$/;

function readFeatureRequests() {
  // get any existing "featureRequests" from local storage
  let featureReqs = {};
  try {
    featureReqs = JSON.parse(localStorage.getItem("featureRequests") ?? "{}");
  } catch (e) {
    // localStorage can throw an error if the user has disabled via privacy settings
    console.error(e);
  }

  // pass in url params eg ?features[v2-beta]=false
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.forEach((value, key) => {
    const match = key.match(FEATURE_PARAM);
    if (match) {
      featureReqs[match[1]] = value; // the string "true", "false", "variant-a", ...
    }
  });

  return featureReqs;
}

function storeFeatureRequests(featureReqs) {
  if (Object.keys(featureReqs).length === 0) return;
  try {
    localStorage.setItem("featureRequests", JSON.stringify(featureReqs));
  } catch (e) {
    console.error(e);
  }
}

// runs once, when the module loads
const featureReqs = readFeatureRequests();
storeFeatureRequests(featureReqs);
// highlight-end

// at the top level of your app; `user` is however your app loads the signed-in user
export function App({ user }) {
  const context = {
    user: { key: user.trackingId },
    // highlight-next-line
    featureRequests: featureReqs, // we can now create a rule IF featureRequests.v2-beta is "true"
  };

  const onError = (reason) => {
    console.error(reason);
  };

  return (
    <QuonfigProvider
      sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
      contextAttributes={context}
      onError={onError}
    >
      <MyComponent />
    </QuonfigProvider>
  );
}

// in your component that renders the feature
const MyComponent = () => {
  // highlight-start
  const { isEnabled } = useQuonfig();

  if (isEnabled("v2-beta-flag")) {
    return <div>New Improved V2 UI</div>;
  }
  // highlight-end

  return <div>Old UI</div>;
};
```

## Note

This approach is a good solution for front end flags in JS or React. The same approach will also work for backend SDKs, swapping out local storage for a database or cache.

This approach will need to be modified if you are sharing flags across multiple applications or front end and backend. In that case, you'll need to find a way to give the same featureRequest context to all of your applications. This could be done as a column on the user table or as a cookie.
