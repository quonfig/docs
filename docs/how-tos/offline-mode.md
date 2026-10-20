---
title: Offline Mode
sidebar_label: Offline Mode
---

Once a Quonfig SDK has loaded your configuration, your servers keep evaluating feature flags and config from memory, even if, despite our [intense efforts][be], our servers are down. (A process that is *starting up* while it can't reach us is a different case, with its own setting; see [If Quonfig Is Unreachable at Startup][startup].) As a developer, you should also be able to run your app and test your code even if you don't have a reliable internet connection. This is why Quonfig has an offline mode.

## Using Quonfig offline

Quonfig has Backend and Frontend SDKs, each supporting offline mode using [Datafiles][df]. Datafiles are JSON files containing the feature flags and configs you would normally get from the Quonfig servers.

You can [download the datafile][download] for your project with the Quonfig CLI.

You can check this datafile into your source control system, and use it to run your app in offline mode. Be sure to update this datafile periodically to get the latest rulesets from the Quonfig servers.

### Backend SDKs

Backend SDKs can run offline from a local copy of your workspace. Pull the workspace with the Quonfig CLI, then point the SDK at that directory with its `datadir` option (`WithDataDir` in Go; see your SDK's page for the exact spelling) and pick the environment to evaluate. The local copy is a complete representation of the configuration you'd normally get from quonfig.com, so your app evaluates flags and configs using your complete ruleset (as of when you pulled it), without connecting to the Quonfig servers. Datadir mode loads synchronously from disk, so the startup-failure setting does not apply to it.

If you're using Ruby on Rails, for example, the Ruby SDK reads the directory and environment from environment variables:

```bash
QUONFIG_DIR=./path-to-your-workspace QUONFIG_ENVIRONMENT=development rails server
```

### Frontend SDKs

To run a frontend SDK offline, point it at a datafile served locally with the Quonfig CLI. You'll need a datafile.

#### Using the Quonfig CLI to Serve a datafile

Using [`quonfig serve`][serve] with a datafile will start a local server that serves the datafile to your frontend. This is useful if you want to run your frontend in isolation. You'll need to update your frontend code to point to wherever your `quonfig serve` is running.

<Tabs groupId="lang">
<TabItem value="js" label="JavaScript">

```javascript
import { quonfig } from "@quonfig/javascript";

const endpoints = [
  // If using the quonfig serve command locally
  "http://localhost:3099",
  // If using `quonfig serve` on your server
  // (perhaps in a Docker image), use the server's URI here
  // "https://quonfig.your-backend-server/",
];

const options = {
  sdkKey: "QUONFIG_FRONTEND_SDK_KEY",
  endpoints: endpoints,
};

await quonfig.init(options);
```

</TabItem>

<TabItem value="react" label="React">

```jsx
import { QuonfigProvider } from "@quonfig/react";

const endpoints = [
  // If using the quonfig serve command locally
  "http://localhost:3099",
  // If using `quonfig serve` on your server
  // (perhaps in a Docker image), use the server's URI here
  // "https://quonfig.your-backend-server/",
];

const WrappedApp = () => {
  const onError = (reason) => {
    console.error(reason);
  };

  return (
    <QuonfigProvider
      endpoints={endpoints}
      sdkKey={"QUONFIG_FRONTEND_SDK_KEY"}
      onError={onError}
    >
      <MyApp />
    </QuonfigProvider>
  );
};
```

</TabItem>

</Tabs>

[be]: ../explanations/architecture/resiliency
[startup]: ../explanations/architecture/startup-failure
[download]: ../tools/cli#pull
[serve]: ../tools/cli#serve
[df]: ../explanations/concepts/datafiles
