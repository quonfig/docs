---
title: Your First Config and Flag
sidebar_label: Your First Config and Flag
sidebar_position: 2
---

## Your first config and flag

```ruby
config_key = "my-first-int-config"
puts "#{config_key} is: #{Quonfig.get(config_key)}"

flag_name = "my-first-feature-flag"
puts "#{flag_name} is: #{Quonfig.enabled? flag_name}"
```

Run these and you should see the following:

```bash
my-first-int-config is: 30
my-first-feature-flag is: false
```

Now create a config named `my-first-int-config` in the Quonfig UI. Set a default value to 50 and sync your change to the
API.

Add a feature flag named `my-first-feature-flag` in the Quonfig UI. Add boolean variants of `true` and `false`.
Set the inactive variant to `false`, make the flag active and add a rule of type `ALWAYS_TRUE` with the variant to serve
as `true`.
Remember to sync your change to the API.

Run your command again and you should see:

```bash
my-first-int-config is: 50
my-first-feature-flag is: true
```

Congrats! You're ready to rock!
