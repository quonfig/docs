---
title: Get Started
sidebar_label: Get Started
sidebar_position: 1
---

# Tutorial Intro

Let's discover **Quonfig in less than 5 minutes**.

Getting setup with Quonfig should take you 5 minutes, but only if we start right now ;)

## Environments

Click **Environments & Keys** in the sidebar to view your environments. We've added `Development`, `Staging` and `Production` for you.

## Get your SDK key

Your app connects to Quonfig with an **SDK key**, found on the **Environments
& Keys** page. A workspace shares **one development SDK key** across the whole team —
SDK keys carry no identity, so there's no such thing as a personal one. Grab
your workspace's development key (or create it if the workspace doesn't have one
yet).

We're building a server example, so use the **backend** key (`qf_sk_…`); browser
and mobile apps use a **frontend** key (`qf_pk_…`).

For how SDK keys differ from `qfg login` and API keys — and why one shared
development key is the intended setup — see
[Keys & Credentials](/docs/explanations/concepts/keys-and-credentials).

![The Environments and SDK Keys page](/img/docs/getting-started/sdk-keys-page.png)

Under your **development** environment, click **Add Backend Key**. Copy the key
down now — we show it to you only once and store only a secure hash. If you lose
it, just create another; making new keys is how you rotate them.

![The one-time SDK key reveal dialog](/img/docs/getting-started/sdk-key-created.png)

## Adding a Feature Flag

Now that we have an SDK key, we're ready to go. Select **Feature Flags** from the navigation and then choose **+ Add Feature Flag** (or **Create Your First Flag** if the workspace has no flags yet).

Let's name our flag `features.example-flag` and use the default type (`bool`).

Quonfig suggests that you name things all in lowercase, with `.` as a logical separator and `-` between words.

Click **Next: Configure rules**. The flag is created and you land on its page, ready to edit its rules. A few areas to note:

1. **Rules** The **Default** tab holds the rules that every environment inherits. Each environment also gets its own tab, where you can override the default rules.
2. **Save** Changes go live as soon as you click **Save**. There is no separate publish step.
3. **Code Samples** This tab has snippets you can copy straight into your application.
4. **Evaluations** Once you start running the client, this tab charts how the flag is being evaluated.

## Configuring our Feature Flag

Time for some fun. Let's set up a feature flag that will show us a bit of the power of Quonfig.
For this example, let's say that we have a new thing we're ready to ship. We want to ship it to everyone in our Beta group.
Additionally, since the beta group might not reflect our whole user base, we also want to roll out to 5% of all traffic.

Stay on the **Default** tab. For the rollout, open the default value dropdown at the bottom (the `else` row) and pick **Percent Rollout**. Now enter `5` as your percent for `true` and `95` for `false`.

Now click **Add Rule** to add our beta group rule. Select `true`, then enter `user.group` for the property after "when", `is one of` for the operator and `beta` for the values field.

Click **Save**. The flag is now live in every environment that uses the default rules. A guide at the top of the page tracks your setup; **Finish setup** just hides it, because your changes are already saved.

:::tip
The order of the rules matters. Rules are evaluated from top to bottom and the value of the first matching rule is used.

You can drag the rules to re-order them but the default rule sticks to the bottom.
:::

## Use in Code

To use the flag, all we need to do is initialize a client with the SDK key we created and pass a context when checking the flag.

<Tabs groupId="lang">
<TabItem value="ruby" label="Ruby">

```ruby
Quonfig.init(sdk_key: "SDK-KEY") # or set the QUONFIG_BACKEND_SDK_KEY env var and call Quonfig.init
# Users in the beta group will always return true

context = { user: { key: rand(1000)}}
# 5% of other users will return true
puts Quonfig.enabled?("features.example-flag", context)

# 100% of users in the beta group will return true
context[:user][:group] = "beta"
puts Quonfig.enabled?("features.example-flag", context)
```

</TabItem>
<TabItem value="java" label="Java">

```java
import com.quonfig.sdk.Options;
import com.quonfig.sdk.Quonfig;
import com.quonfig.sdk.eval.ContextSet;
import java.util.Map;

// sdkKey falls back to the QUONFIG_BACKEND_SDK_KEY env var
Quonfig quonfig = new Quonfig(Options.builder().sdkKey("SDK-KEY").build());

// true for 5% of the users
quonfig.featureIsOn(
    "features.example-flag",
    new ContextSet().withNamedContext("user", Map.of("key", String.valueOf(Math.random()))));

// true because of the beta group rule
quonfig.featureIsOn(
    "features.example-flag",
    new ContextSet().withNamedContext("user", Map.of("group", "beta")));
```

</TabItem>
<TabItem value="node" label="Node">

```javascript
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: "SDK-KEY", // or set the QUONFIG_BACKEND_SDK_KEY env var
});
await quonfig.init();

// true for 5% of the users
quonfig.isEnabled("features.example-flag", { user: { key: String(Math.random()) } });

// 100% of users in the beta group will return true
quonfig.isEnabled("features.example-flag", {
  user: { key: String(Math.random()), group: "beta" },
});
```

</TabItem>
<TabItem value="python" label="Python">

```python
import random
from quonfig import Quonfig

# sdk_key falls back to the QUONFIG_BACKEND_SDK_KEY env var
quonfig = Quonfig(sdk_key="SDK-KEY").init()

context = {"user": {"key": str(random.randrange(1000))}}
# 5% of other users will return true
print(quonfig.is_feature_enabled("features.example-flag", contexts=context))

# 100% of users in the beta group will return true
context["user"]["group"] = "beta"
print(quonfig.is_feature_enabled("features.example-flag", contexts=context))
```

</TabItem>
</Tabs>

And that's it! A nice feature flag with a complex rule and a partial rollout in 5 minutes.

For this example, we used "Just in Time" context, passing the context straight into each flag check. In general, you'll bind the context once at the beginning of the request and then check flags without passing it again. Read more about context [here](/docs/explanations/concepts/context).

## Add a Config

Configs work the same way as flags, but return a value instead of on/off. Read
one in code with a **code default**, which you get back until the config exists:

<Tabs groupId="lang">
<TabItem value="ruby" label="Ruby">

```ruby
puts Quonfig.get("my-first-int-config", 30) # 30 is the code default
```

</TabItem>
<TabItem value="java" label="Java">

```java
Long value = quonfig.getLong("my-first-int-config", 30L); // 30 is the code default
```

</TabItem>
<TabItem value="node" label="Node">

```javascript
const value = quonfig.getInt("my-first-int-config", undefined, 30); // 30 is the code default
```

</TabItem>
<TabItem value="python" label="Python">

```python
print(quonfig.get_int("my-first-int-config", default=30))  # 30 is the code default
```

</TabItem>
</Tabs>

Run it and you get `30`. Now select **Configs** from the navigation, click
**+ Add Config**, enter `my-first-int-config` as the key, pick the `int` type and
click **Create config**. Set the default value to `50` and click **Save**. Run
your code again and you get `50`.

## TypeScript Type Generation (Optional)

If you are using Node.js or React with TypeScript, the Quonfig CLI can generate type-safe definitions for all your flags and configs. This gives you autocomplete and compile-time safety in your IDE.

Install the CLI globally (requires Node 20.9+):

```bash
npm install -g @quonfig/cli
```

Then log in, pull your workspace config, and generate types:

```bash
qfg login
qfg pull --dir ./my-config
qfg generate --dir ./my-config                       # react-ts (default)
qfg generate --dir ./my-config --targets node-ts     # Node.js
```

Set `QUONFIG_DIR=./my-config` once (e.g. in `.env`) to avoid passing `--dir` every time.

For full details on generated output files, configuration options, and IDE integration, see the [CLI documentation](/docs/tools/cli#typescript-code-generation).
