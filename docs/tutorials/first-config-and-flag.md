---
title: Your First Config and Flag
sidebar_label: Your First Config and Flag
sidebar_position: 2
---

## Your first config and flag

```ruby
config_key = "my-first-int-config"
puts "#{config_key} is: #{Quonfig.get(config_key, 30)}" # 30 is the code default

flag_name = "my-first-feature-flag"
puts "#{flag_name} is: #{Quonfig.enabled? flag_name}"
```

Run these and you should see the following:

```bash
my-first-int-config is: 30
my-first-feature-flag is: false
```

Neither key exists yet, so you get the code default for the config and `false` for the flag.

Now create a config named `my-first-int-config` in the Quonfig UI with a default value of 50. Save and publish.

Add a feature flag named `my-first-feature-flag` in the Quonfig UI (type `bool`) and set its default rule to serve `true`.
Save and publish.

Run your command again and you should see:

```bash
my-first-int-config is: 50
my-first-feature-flag is: true
```

Congrats! You're ready to rock!
