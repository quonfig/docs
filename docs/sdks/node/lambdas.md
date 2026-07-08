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
  
  // every 60 seconds, check for updates in-process
  baseQuonfig.updateIfStalerThan(60 * 1000);
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

    // every 60 seconds, check for updates in-process
    quonfig.updateIfStalerThan(60 * 1000); // conditional update
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

    // every 60 seconds, check for updates in-process
    quonfig.updateIfStalerThan(60 * 1000);
    return new Response("ok");
  });
};

export const config = { path: "/users/:userId" };
```

</TabItem>
</Tabs>

With this approach, most of our requests will be fast, but we'll have a periodic update that will take a bit longer. This is about 50ms in my testing from a Netlify function. We're entirely in control of the frequency here, so it's a judgment call on how real-time you want your feature flag updates. You could even disable the updates altogether if tail latency is of utmost concern and you didn't mind redeploying to update your flags.
