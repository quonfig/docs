---
title: Lambdas / Netlify
---

:::tip TypeScript Support

**⭐ Recommended**: Use the [Quonfig CLI](/docs/tools/cli#typescript-code-generation) to generate TypeScript definitions for type-safe access to your flags and configs:

```bash
npx @quonfig-com/cli generate --targets node-ts
```

:::

## Choosing an Approach

The first step is to choose between a client-side style or server-side style approach. We've written a blog post that goes into detail about [choosing how to use Quonfig with Netlify](https://quonfig.com/blog/feature-flags-for-netlify-functions/).

### Feature Flags in Lambdas: The Browser-Like Approach

A practical solution is to treat Netlify functions similar to a browser. Quonfig's [Javascript client](https://docs.quonfig.com/docs/sdks/javascript), for instance, caches flag evaluations per user in a CDN. Here's a sample code snippet for this approach:

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```typescript
import { quonfig, Context } from "@quonfig-com/javascript";

export default async (req: Request, context: any) => {
  const clientOptions = {
    sdkKey: process.env.QUONFIG_FRONTEND_SDK_KEY!, // client SDK key
    context: new Context({ user: { key: "1234" } }), // user context
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
import { quonfig, Context } from "@quonfig-com/javascript";

export default async (req, context) => {
  const clientOptions = {
    sdkKey: process.env.QUONFIG_FRONTEND_SDK_KEY,
    context: new Context({ user: { key: "1234" } }),
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
npx @quonfig-com/cli generate --targets node-ts
```

Then set up your Lambda with full type safety:

```typescript
import { Quonfig, type Contexts } from "@quonfig-com/node";
import { QuonfigTypesafeNode } from "./generated/quonfig-server";

const baseQuonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  enableSSE: false, // we don't want any background process in our function
  enablePolling: false, // we'll handle updates ourselves
  collectLoggerCounts: false, // turn off background telemetry
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
import { Quonfig, type Contexts } from "@quonfig-com/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!, // server SDK key
  enableSSE: false, // we don't want any background process in our function
  enablePolling: false, // we'll handle updates ourselves
  collectLoggerCounts: false, // turn off background telemetry
  contextUploadMode: "none", // turn off background telemetry
  collectEvaluationSummaries: false, // turn off background telemetry
});

// initialize once on cold start
await quonfig.init(); // load configuration

export default async (req: Request, context: any) => {
  const { userId } = context.params; // extract user ID from URL
  const quonfigContext: Contexts = { user: { key: userId } }; // create user context

  return quonfig.inContext(quonfigContext, (rf) => {
    if (rf.isFeatureEnabled("my-flag")) { // context-aware feature flag
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
import { Quonfig } from "@quonfig-com/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  enableSSE: false, // we don't want any background process in our function
  enablePolling: false, // we'll handle updates ourselves
  collectLoggerCounts: false, // turn off background telemetry
  contextUploadMode: "none", // turn off background telemetry
  collectEvaluationSummaries: false, // turn off background telemetry
});

// initialize once on cold start
await quonfig.init();

export default async (req, context) => {
  const { userId } = context.params;
  const quonfigContext = { user: { key: userId } };

  return quonfig.inContext(quonfigContext, (rf) => {
    if (rf.isFeatureEnabled("my-flag")) {
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

<!-- ## Dynamic Logging 

### The Code We Want To Debug

Here's a really basic skeleton of a Netlify function. It's a simple function that takes a user id from the url and returns some data from the database. Let's pretend it's misbehaving and we need to debug it.

We've added two `console.log` statements, but this probably isn't shippable as is because, at high throughput, we're going to print out way too much logging.

```javascript
export default async (req, context) => {
  const { userId } = context.params;

  var sql = "SELECT * FROM table WHERE user_id = $1";
  console.log(`running the following SQL ${sql}`, { userId: userId });

  db.run(sql, [userId], function (err, rows) {
    console.log("query returned", { rows: rows });
    return new Response("200 Okey-dokey");
  });
};

export const config = {
  path: "/users/:userId",
};
```

### Swap Logging to Quonfig

Rather than use a console.log, we will create a Quonfig logger with the name `netlify.functions.hello` and the default level of `warn` so we don't get too much output.

We can replace our `console.log` with some `logger.debug` and `logger.info`, and now it's safe to deploy. They won't emit logs until we turn them on.

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```typescript
import { LogLevel } from "@quonfig-com/node";

const logger = quonfig.logger("netlify.functions.hello", LogLevel.Warn);

// simple info logging
logger.info(`getting results for ${userId}`);

const sql = "SELECT * FROM table WHERE user_id = $1";

// more detailed debug logging
logger.debug(`running the following SQL ${sql} for ${userId}`);
db.run(sql, [userId], function (err: any, rows: any) {
  logger.debug("query returned", { rows: rows });
  return new Response("200 Okey-dokey");
});
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```javascript
const logger = quonfig.logger("netlify.functions.hello", "warn");

// simple info logging
logger.info(`getting results for ${userId}`);

var sql = "SELECT * FROM table WHERE user_id = $1";

// more detailed debug logging
logger.debug(`running the following SQL ${sql} for ${userId}`);
db.run(sql, [userId], function (err, rows) {
  logger.debug("query returned", { rows: rows });
  return new Response("200 Okey-dokey");
});
```

</TabItem>
</Tabs>

This logging will _not_ show up in your Netlify logs yet, because the logger is `warn` but the logging here is `info` and `debug`. That means it's safe to go ahead and deploy.

### Listen for Changes

Since we turned off the background polling, we'll want to update Quonfig in line. We can do this by calling the `updateIfStalerThan` with our desired polling frequency. This is a quick check to a CDN, taking around 40ms (once every minute).

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```typescript
quonfig.updateIfStalerThan(60 * 1000); // check for new updates every minute
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```javascript
quonfig.updateIfStalerThan(60 * 1000); // check for new updates every minute
```

</TabItem>
</Tabs>

We can now toggle logging in the Quonfig UI!

### Adding Per User Targeting

Now we'll go deeper and add per user targeting. This will let us laser focus in on a particular problem.

To add per user targeting, we need to tell Quonfig who the current user is. We do this by setting some [context](https://docs.quonfig.com/docs/explanations/concepts/context) for Quonfig so it can evaluate the rules. We should also move the logger creation inside this context so that the logger has this context available to it.

<Tabs groupId="lang">
<TabItem value="typescript" label="TypeScript (Recommended)">

```typescript
import type { Contexts } from "@quonfig-com/node";

// take the context from our url /users/123 and give it to Quonfig as context
const { userId } = context.params;
const quonfigContext: Contexts = { user: { key: userId } };

// wrap our code in this context
quonfig.inContext(quonfigContext, (rf) => {
  // logger goes inside the context block
  const logger = rf.logger("netlify.functions.hello", LogLevel.Warn);

  logger.info(`getting results for ${userId}`);

  const sql = "SELECT * FROM table WHERE user_id = $1";

  logger.debug(`running the following SQL ${sql} for ${userId}`);
  db.run(sql, [userId], function (err: any, rows: any) {
    logger.debug("query returned", { rows: rows });
    return new Response("200 Okey-dokey");
  });
});
```

</TabItem>
<TabItem value="javascript" label="JavaScript">

```javascript
// take the context from our url /users/123 and give it to Quonfig as context
const { userId } = context.params;
const quonfigContext = { user: { key: userId } };

// wrap our code in this context
quonfig.inContext(quonfigContext, (rf) => {
  // logger goes inside the context block
  const logger = rf.logger("netlify.functions.hello", "warn");

  logger.info(`getting results for ${userId}`);

  var sql = "SELECT * FROM table WHERE user_id = $1";

  logger.debug(`running the following SQL ${sql} for ${userId}`);
  db.run(sql, [userId], function (err, rows) {
    logger.debug("query returned", { rows: rows });
    return new Response("200 Okey-dokey");
  });
});
```

</TabItem>
</Tabs>
-->