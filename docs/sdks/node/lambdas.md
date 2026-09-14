---
title: Lambdas / Serverless
---

## Vercel / Next.js Serverless

Vercel serverless functions freeze the process after the response is sent, which means background telemetry timers won't fire. Use `flush()` with Next.js `after()` to ensure telemetry is sent before the function freezes.

```typescript
import { Quonfig } from "@quonfig/node";
import { after } from "next/server";

// Singleton — initialized once per cold start
let quonfig: Quonfig | null = null;

async function getQuonfig(): Promise<Quonfig> {
  if (!quonfig) {
    const client = new Quonfig({
      sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
      enableSSE: true,
      fallbackPollEnabled: true,
    });
    await client.init();
    quonfig = client;
  }
  return quonfig;
}

// In a Next.js Server Component or Route Handler:
export default async function MyPage() {
  const quonfig = await getQuonfig();
  const showBanner = quonfig.isEnabled("show-banner");

  // flush telemetry after the response is sent, before Vercel freezes the function
  after(() => quonfig.flush());

  return <div>{showBanner && <Banner />}</div>;
}
```

`after()` runs your callback after the response is sent to the client but before Vercel freezes the Lambda. This ensures evaluation summaries, context shapes, and example contexts are delivered on every request.

---

## Netlify / AWS Lambda

:::tip TypeScript Support

**⭐ Recommended**: Use the [Quonfig CLI](/docs/tools/cli#typescript-code-generation) to generate TypeScript definitions for type-safe access to your flags and configs:

```bash
npx @quonfig/cli generate --targets node-ts
```

:::

## Choosing an Approach

The first step is to choose between a client-side style or server-side style approach. We've written a blog post that goes into detail about [choosing how to use Quonfig with Netlify](https://quonfig.com/blog/feature-flags-for-netlify-functions/).

### Feature Flags in Lambdas: The Browser-Like Approach

A practical solution is to treat Netlify functions similar to a browser. Quonfig's [Javascript client](https://docs.quonfig.com/docs/sdks/javascript), for instance, caches flag evaluations per user in a CDN. Here's a sample code snippet for this approach:

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```typescript
import { quonfig } from "@quonfig/javascript";

export default async (req: Request, context: any) => {
  const clientOptions = {
    sdkKey: process.env.QUONFIG_FRONTEND_SDK_KEY!, // client SDK key
    context: { user: { key: "1234" } }, // user context (plain Contexts object)
  };

  await quonfig.init(clientOptions); // initialize with context
  if (quonfig.isEnabled("my-flag")) { // check feature flag
    // Your code here
  }
  return new Response("ok");
};
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```javascript
import { quonfig } from "@quonfig/javascript";

export default async (req, context) => {
  const clientOptions = {
    sdkKey: process.env.QUONFIG_FRONTEND_SDK_KEY,
    context: { user: { key: "1234" } },
  };

  await quonfig.init(clientOptions);
  if (quonfig.isEnabled("my-flag")) {
    // Your code here
  }
  return new Response("ok");
};
```

</TabItem>
</Tabs>

In our testing from a Netlify function we see results around a 50ms latency initially and around then 10ms for each subsequent request for the same context. That may be too slow for some applications, but it's a good starting point and very easy to set up.

The nice thing about this solution is that you're going to get instant updates when you change a flag. The next request will have up to date data.

### The Server-Side Alternative

Alternatively, you can implement a server-side strategy using the Quonfig [NodeJS](https://docs.quonfig.com/docs/sdks/node) client.
The key will be configuring our client to disable background updates and background telemetry, then performing an update on our own timeline.

Here's a sample code snippet for this approach:

<Tabs groupId="lang">
<TabItem value="typegen" label="⭐ TypeScript + Generated Types (Recommended)">

First, generate your types:

```bash
npx @quonfig/cli generate --targets node-ts
```

Then set up your Lambda with full type safety:

```typescript
import { Quonfig, type Contexts } from "@quonfig/node";
import { QuonfigTypesafeNode } from "./generated/quonfig-server";

const baseQuonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  enableSSE: false, // we don't want any background process in our function
  fallbackPollEnabled: false, // we'll handle updates ourselves
  contextUploadMode: "none", // turn off background telemetry
  collectEvaluationSummaries: false, // turn off background telemetry
});

// initialize once on cold start
await baseQuonfig.init();

// Create typed instance
const quonfig = new QuonfigTypesafeNode(baseQuonfig);

export default async (req: Request, context: any) => {
  const { userId } = context.params;
  const quonfigContext: Contexts = { user: { key: userId } };

  // Use type-safe methods with context
  if (quonfig.myFlag(quonfigContext)) {
    // Your code here with full type safety
  }

  const userConfig = quonfig.userSpecificConfig(quonfigContext);

  // at most every 60 seconds, kick off a refresh in-process (fire-and-forget)
  baseQuonfig.updateIfStalerThan(60 * 1000)?.catch(() => {});
  return new Response("ok");
};

export const config = { path: "/users/:userId" };
```

</TabItem>
<TabItem value="typescript" label="TypeScript">

```typescript
import { Quonfig, type Contexts } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!, // server SDK key
  enableSSE: false, // we don't want any background process in our function
  fallbackPollEnabled: false, // we'll handle updates ourselves
  contextUploadMode: "none", // turn off background telemetry
  collectEvaluationSummaries: false, // turn off background telemetry
});

// initialize once on cold start
await quonfig.init(); // load configuration

export default async (req: Request, context: any) => {
  const { userId } = context.params; // extract user ID from URL
  const quonfigContext: Contexts = { user: { key: userId } }; // create user context

  return quonfig.withContext(quonfigContext, (rf) => {
    if (rf.isEnabled("my-flag")) { // context-aware feature flag
      // Your code here
    }

    // at most every 60 seconds, kick off a refresh in-process (fire-and-forget)
    quonfig.updateIfStalerThan(60 * 1000)?.catch(() => {}); // conditional update
    return new Response("ok");
  });
};

export const config = { path: "/users/:userId" }; // URL pattern
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```javascript
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: false, // we don't want any background process in our function
  fallbackPollEnabled: false, // we'll handle updates ourselves
  contextUploadMode: "none", // turn off background telemetry
  collectEvaluationSummaries: false, // turn off background telemetry
});

// initialize once on cold start
await quonfig.init();

export default async (req, context) => {
  const { userId } = context.params;
  const quonfigContext = { user: { key: userId } };

  return quonfig.withContext(quonfigContext, (rf) => {
    if (rf.isEnabled("my-flag")) {
      // Your code here
    }

    // at most every 60 seconds, kick off a refresh in-process (fire-and-forget)
    quonfig.updateIfStalerThan(60 * 1000)?.catch(() => {});
    return new Response("ok");
  });
};

export const config = { path: "/users/:userId" };
```

</TabItem>
</Tabs>

With this approach every request is served from memory. `updateIfStalerThan` does no network round-trip unless the last successful refresh is older than the interval you pass, and when it does start one it returns immediately — the fetch runs in the background and the new config is installed when it lands, about 50ms later in our testing from a Netlify function. Concurrent calls coalesce onto the same in-flight fetch, so a burst of requests during an outage never stacks retries. We're entirely in control of the frequency here, so it's a judgment call on how real-time you want your feature flag updates. You could even disable the updates altogether if you didn't mind redeploying to update your flags.

Two things to know about that background fetch in a frozen lambda:

- **Always attach `.catch()`.** The call returns the in-flight `Promise` when it starts a fetch (and `undefined` when it doesn't need one — hence the `?.`). That promise rejects if the HTTP fetch fails, and an unawaited rejection is an `unhandledRejection`, which crashes modern Node by default. The `?.catch(() => {})` in the snippets above is what keeps a flaky network from taking the function down; log inside it if you want visibility.
- **It may not complete until the next thaw.** If the platform freezes the process right after the response is sent, the fetch pauses with it and finishes when the function next wakes. That is fine: the SDK's reject-older guard means a late-arriving envelope can never roll your config backwards, and the next request simply sees whatever landed. If you'd rather guarantee the refresh finishes before the freeze, `await` it (or, on Vercel, run it inside `after()`) at the cost of that request's latency.
