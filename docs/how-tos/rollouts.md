---
title: Rollouts
sidebar_label: Rollouts
---

## Using Quonfig For Rollouts

So you've built a new pipeline and are hoping to slowly dial up how much traffic uses it. You've got two great ways to
do that with Quonfig.

One approach is to simply use dynamic config. We can use a floating point number to specify the percent of traffic we
want to rollout to and then evaluate that against a random number to determine whether to run the new code.

<Tabs groupId="lang">
<TabItem value="ruby" label="Ruby">

```ruby
if rand() < @config.get_float("percent-to-rollout")
  do_new_pipeline
end
```

</TabItem>
</Tabs>

This approach works fine, but each evaluation of `rand()` will get you a different result. Sometimes this is what you
want, but if you'd like the rollout to be sticky and keep server, requests, users in the new pipeline you may want to use a feature flag.

<Tabs groupId="lang">
<TabItem value="ruby" label="Ruby">

```ruby
Quonfig.enabled? "new-feature", { user: { tracking_id: user.tracking_id } }
```

</TabItem>
</Tabs>
