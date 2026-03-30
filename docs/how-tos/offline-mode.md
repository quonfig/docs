---
title: Offline Mode
sidebar_label: Offline Mode
---

Quonfig is intended to be bomb-proof. This means that your servers should happily continue to evaluate feature flags and config, even if, despite our [intense efforts][be], our servers are down. As a developer, you should also be able to run your app and test your code even if you don't have a reliable internet connection. This is why Quonfig has an offline mode.

## Using Quonfig offline

Quonfig has Backend and Frontend SDKs, each supporting offline mode using [Datafiles][df]. Datafiles are JSON files containing the feature flags and configs you would normally get from the Quonfig servers.

You can [download the datafile][download] for your project with the Quonfig CLI.

You can check this datafile into your source control system, and use it to run your app in offline mode. Be sure to update this datafile periodically to get the latest rulesets from the Quonfig servers.

### Backend SDKs

Backend SDKs can use [Datafiles][df] to run in offline mode. By specifying `QUONFIG_DATAFILE=./path-to-your-datafile.json` in your environment, you can run your app without needing to connect to the Quonfig servers. Since the datafile is a complete representation of the payload you'd normally get from quonfig.com, your servers will continue to evaluate flags and configs using your complete ruleset (at the time the datafile was generated).

If you're using Ruby on Rails, for example, you can run your server using a datafile like this:

```bash
QUONFIG_DATAFILE=./path-to-your-datafile.json rails server
```

### Frontend SDKs

Frontend SDKs have two options for offline mode. In both cases, you'll need a datafile.

#### Using Backend SDK JS stub/bootstrapping

If you're already using one of the Backend SDKs that supports [Frontend bootstrapping][0ms], you can use the same datafile for your frontend. Sending your evaluations from your backend to your frontend will save your users an HTTP request and allow you to run offline without any changes to your frontend code.

#### Using the Quonfig CLI to Serve a datafile

Using [`quonfig serve`][serve] with a datafile will start a local server that serves the datafile to your frontend. This is useful if you're not using a Backend SDK that supports bootstrapping, or if you want to run your frontend in isolation. You'll need to update your frontend code to point to wherever your `quonfig serve` is running.

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
[download]: ../tools/cli#download
[serve]: ../tools/cli#serve
[df]: ../explanations/concepts/datafiles
[0ms]: ../explanations/concepts/zero-ms-frontend-feature-flags
