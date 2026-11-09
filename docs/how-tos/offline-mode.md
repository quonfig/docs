---
title: Offline Mode
sidebar_label: Offline Mode
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

Once a Quonfig SDK has loaded your configuration, your servers keep evaluating feature flags and config from memory, even if, despite our [intense efforts][be], our servers are down. (A process that is *starting up* while it can't reach us is a different case, with its own setting; see [If Quonfig Is Unreachable at Startup][startup].) As a developer, you should also be able to run your app and test your code without a reliable internet connection. That's what offline mode is for.

## Using Quonfig offline

Offline mode runs the SDK from a [local copy of your workspace][datadir] (a datadir) instead of the Quonfig servers. Pull it with the Quonfig CLI:

```bash
qfg pull --dir ./my-config
```

The datadir has your complete ruleset as of the pull, for every environment. You can commit it to source control and run your app from it. Re-run `qfg pull` now and then to pick up the latest changes.

### Backend SDKs

Point the SDK's `datadir` option at the directory (`WithDataDir` in Go; see your SDK's page for the exact spelling) and pick the environment to evaluate. The SDK evaluates flags and configs from the local files without connecting to the Quonfig servers. Datadir mode loads synchronously from disk, so the startup-failure setting does not apply to it.

If you're using Ruby on Rails, for example, the Ruby SDK reads the directory and environment from environment variables:

```bash
QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=development rails server
```

See [Open Source / Fully Local][local] for every SDK's setup and for auto-reload on file changes.

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
  apiKey: "PUBLIC_FRONTEND_KEY", // any string works unless qfg serve has --frontend-sdk-key
  context: { user: { key: "alice@example.com" } },
  apiUrls: ["http://localhost:6580"],
  collectEvaluationSummaries: false,
  contextUploadMode: "none",
});
```

</TabItem>
<TabItem value="react" label="React">

```tsx
import { QuonfigProvider } from "@quonfig/react";

<QuonfigProvider
  apiKey="PUBLIC_FRONTEND_KEY"
  contextAttributes={{ user: { key: "alice@example.com" } }}
  apiUrls={["http://localhost:6580"]}
  collectEvaluationSummaries={false}
  contextUploadMode="none"
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
