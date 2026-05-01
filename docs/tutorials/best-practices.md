---
title: Best Practices & Tips
sidebar_label: Best Practices
sidebar_position: 3
---

Getting Quonfig installed is great, but there are some Tips & Best Practices that will help you get the most out of your Quonfig experience.


## Improve your contexts

We use [Context](/docs/explanations/concepts/context) to tell Quonfig the current state of the world so it can run the rules engine and give you the right values. One of the most common things we see is people setting only very basic context.

### Use PermanentKeys, Not Anonymous
<Tabs groupId="lang">
<TabItem value="simple" label="Barebones">
```json
 {
  user: {id: 123}
 }
 // and
 {
  user: {anonymous: true}  // no way to target / debug this particular anonymous user
 }
```
</TabItem>
<TabItem value="better" label="Prefer: Use the 'key' attribute">
```json
 {
  user: {key: "4f4b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b", 
         id: 123,
  }
 }
  // and
 {
  user: {key: "2e2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b"} // a permanent key for an anonymous user allows us to target / debug this user
 }
```
</TabItem>
</Tabs>

### Use Names
`key` is the special attribute that Quonfig uses to determine the canonical identifier for a context. It's used for things like debugging, logging, and matching context across requests. That's great, but GUIDs aren't very easy on the eyes. Use the `name` attribute and Quonfig will use that in the UI instead of the `key`.

<Tabs groupId="lang">
<TabItem value="simple" label="Barebones">
```json
 {
  user: {key: "2e2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b"}
 }
```
</TabItem>
<TabItem value="better" label="Prefer: Add a name">
```json
 {
  user: {key: "2e2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b", 
         name: "John Doe" // UI will use this name in the Context & Debugger UIs
        }
 }
```
</TabItem>
</Tabs>

### Use Multi-Context
Some feature flag tools only allow a single set of attributes / properties to be set for a context. Quonfig allows you to set multiple contexts for a single request. This is great for things like user context and team context, and helps when you want to target other things like a `deployment` or `request`. If you set a `key` we'll use that as the canonical identifier for the context. If you don't want the context to be indexed, just don't set the `key`.
<Tabs groupId="lang">
<TabItem value="simple" label="Team jammed into the user context">
```json
 {
  user: {key: 123, 
         name: "John Doe",
         team_id: 453
  }
 }
```
</TabItem>
<TabItem value="better" label="Prefer: Separate out the team so it can have it's own Name">
```json
 {
  user: {key: 123,
         name: "John Doe",
  },
  team: {key: 456, 
         name: "Foo Corp"} 
  },
  request: {
    path: "/dashboard/profile"
  }
 }
```
</TabItem>
</Tabs>

## Try the Context Playground

Is a flag not evaluating the way you expect? We've got tools to help. 

Some users miss the [Context Playground & Debugger](/docs/tools/debugger) tools that Quonfig provides to help you understand how Contexts work and how they're used in your application.

These tools let you see the live contexts that are being used in your application, which can help you understand why a flag is or isn't evaluating the way you expect. Check them out.

## Configs vs Flags

Many feature flag tools just have flags. Quonfig has both flags and configs. What's the difference? When should you use one over the other?

Here's the basic guideline:
    1. FF are designed for things that are ephemeral
    2. Configs are designed for things that are permanent

Under the covers, these objects are very similar. But in practice, we've found that these are two different concepts and that they are each deserving of their own user interface. 

Sometimes we have ephemeral things. We're doing a rollout, we're launching something and we want to be able to turn it on and off while we verify that we like it. These are flags.

Other times we have things that are more permanent, 

In both cases we want to be able to have sophisticated targeting rules based on context. But for config it's pretty common that we may have no targeting rules at all. Something like the `http.timeout` is a great example. It's a great piece of configuration that we may want the option to change, but it may also just sit at 10 seconds for all time. 

:::note
One caveat: you can't do percent rollout today for Configs. We'll address this in the future. Please chat with us if this is blocking you today.
:::


## Explore Advanced Datatypes
### Duration
Ever written `http.connect(timeout: Quonfig.get("my.timeout'))` and been worried that someone might use millisecond or seconds or minutes? Naming all your time duration configs `kafka.retry.timeout-in-seconds` to try to be really explicit? We've got a better way!

Durations is a type of config that acts like the `java.time.Duration` object or `ActiveSupport::Duration` in Ruby. You can specify it in whatever units you like and then retrieve it in whatever units you like. Under the covers it's stored as an ISO 8601 duration.

![duration datatype](/img/docs/how-tos/best-practices/duration.jpg)

Then you can use it in code and be explicit about the units you want

```javascript
duration = Quonfig.get("mysql.timeout")

mysql.connect(timeout: duration.in_milliseconds) // 80000
mysql.connect(timeout: duration.in_seconds)      // 80
mysql.connect(timeout: duration.in_minutes)      // 1.5
mysql.connect(timeout: duration.in_days)         // 0.00001
```

### JSON

Sometimes your config is more complex than a simple string or number. You might have a JSON object that you want to store in Quonfig. That's where the JSON datatype comes in. Quonfig will store it as a JSON object and you can retrieve it as a JSON object.

## Slack Integration

An easy way to get more out of your Quonfig experience is to setup the [Slack Integration](/docs/tools/slack-integration). It's a great way to get notifications when things are changed and see how your team is using Quonfig.

## Cron Job Contexts

If you've got feature flags going you've likely solved how to set the context for web requests. This happens in things like a `Around Actions` that sets the context for each web request. Cron jobs are a bit different, but the same concept applies. If we have a cron job that loops over every team and processes them, we can set the context for that processing with the same `Quonfig.with_context` pattern. In Ruby this might look like this:

```ruby
class CronJob
  LOG = SemanticLogger[self]

  def self.run_all
    Team.all.each do |team|
      Quonfig.with_context(team: {key: team.id}) do
        LOG.tagged(team_id: team.id) do
          ProcessTeam.new(team).process
        end
      end
    end
  end
```
With this example, we'll get 2 big benefits:

1. We'll be able to use feature flags to control how each team is processed.
2. We'll have great logs showing us which team was processed and when.



## Get yourself a Firealarm

You know the feeling when something is wrong and you'd like to let users know that you're aware of the issue? A quick and easy way to do this is to setup a Firealarm. In it's simplest form, it's just a Quonfig Config that you can use to display a message to users. Add something like this:


```ruby
<%= if Quonfig.get("callouts.firealarm") %>
  <div class="firealarm">
    <%= Quonfig.get("callouts.firealarm") %>
  </div>
<% end %>
```
Now you can set the `callouts.firealarm` string to `We're currently performing routine system maintenance. Some reports may not populate or update immediately during this time.` to display the message to users.

:::info

We're currently performing routine system maintenance. Some reports may not populate or update immediately during this time.

:::

### Advanced Firealarms

If you'd like more control over the appearance of the firealarm, you might like a `JSON` datatype. This will give you a little more flexibility over the look and feel of the firealarm.

We'll create these as a Config with a`JSON` datatype. If your callout is Javascript/Frontend make sure to click "Send to frontend SDKs". 

![configuring a firealarm callout](/img/docs/how-tos/best-practices/callouts-firealarm-config.jpg)

Then a bit of code to set the callout's class based on the `type` and we'll check whether the JSON is empty.
```ruby
<% if !Quonfig.get("callouts.firealarm").empty? %>
  <div class="callout radius <%= Quonfig.get("callouts.firealarm")["type"] %>">
    <%= Quonfig.get("callouts.firealarm")["message"] %>
  </div>
<% end %>
```

![UI for advanced firealarm callouts](/img/docs/how-tos/best-practices/callouts-ui.jpg)

Want more control? Set the current url as [Context](/docs/explanations/concepts/context) to allow you to only show the firealarm on certain pages.