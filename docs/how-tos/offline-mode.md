---
title: Offline Mode
sidebar_label: Offline Mode
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

Once a Quonfig SDK has loaded your configuration, your servers keep evaluating feature flags and config from memory, even if, despite our [intense efforts][be], our servers are down. (A process that is *starting up* while it can't reach us is a different case, with its own setting; see [If Quonfig Is Unreachable at Startup][startup].) As a developer, you should also be able to run your app and test your code without a reliable internet connection. That's what offline mode is for.

## Using Quonfig offline

Offline mode runs the SDK from a [local copy of your workspace][datadir] (a datadir) instead of the Quonfig servers. Pull it once with `qfg pull --dir ./my-config`; it holds your complete ruleset, for every environment, as of the pull.

### Backend SDKs

Point the SDK at the directory and choose an environment, for example `QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=development rails server` with the Ruby SDK. Datadir mode loads synchronously from disk, so the startup-failure setting does not apply to it. [Local Workspace (datadir)][datadir] covers keeping the copy current, which environment names are valid, and what the SDK still sends over the network when an SDK key is set; [Open Source / Fully Local][local] has each SDK's setup, including auto-reload on file changes.

### Frontend SDKs

Browser and React Native SDKs can't read files from disk. Use [`qfg serve`][serve] to serve the datadir over HTTP:

```bash
qfg serve --datadir ./my-config --environment development
# qfg serve listening on http://127.0.0.1:6580
```

Then point the SDK's `apiUrls` at it. `qfg serve` doesn't accept telemetry, so turn telemetry off:

<Tabs groupId="frontend">
<TabItem value="javascript" label="JavaScript">

```ts
import { quonfig } from "@quonfig/javascript";

await quonfig.init({
  sdkKey: "PUBLIC_FRONTEND_KEY", // any string works unless qfg serve has --frontend-sdk-key
  context: { user: { key: "alice@example.com" } },
  apiUrls: ["http://localhost:6580"],
  collectEvaluationSummaries: false,
});
```

</TabItem>
<TabItem value="react" label="React">

```tsx
import { QuonfigProvider } from "@quonfig/react";

<QuonfigProvider
  sdkKey="PUBLIC_FRONTEND_KEY"
  contextAttributes={{ user: { key: "alice@example.com" } }}
  apiUrls={["http://localhost:6580"]}
  collectEvaluationSummaries={false}
>
  <App />
</QuonfigProvider>;
```

</TabItem>
</Tabs>

If you run `qfg serve` on a server (in a Docker image, for example), use that server's URL in `apiUrls` instead. The [`qfg serve` guide][serve] covers authentication, watching for changes, and what it doesn't support.

[be]: ../explanations/architecture/resiliency
[startup]: ../explanations/architecture/startup-failure
[datadir]: ../explanations/concepts/local-workspace
[local]: ./open-source-local
[serve]: ./qfg-serve
