---
title: Dynamic Log Levels
sidebar_label: Dynamic Log Levels
sidebar_position: 6
---

A dynamic log level is a Quonfig config of type `log_level` that decides how verbose your loggers
are. You change it in Quonfig, and running processes pick up the change over their live connection.
You don't redeploy or restart.

This page shows how to write the rules. To wire a logger to the config, see your SDK's
**Dynamic Log Levels** section: [Node](../../sdks/node/node.md#dynamic-log-levels),
[Go](../../sdks/go.md#dynamic-log-levels), [Java](../../sdks/java.md#dynamic-log-levels),
[.NET](../../sdks/dotnet.md#dynamic-log-levels), [Ruby](../../sdks/ruby.md#dynamic-log-levels),
[Python](../../sdks/python/python.md#dynamic-log-levels).

## How it works

- Use one `log_level` config per app. The key must start with `log-level.`, for example
  `log-level.my-app`.
- The value is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` or `FATAL`.
- Give the SDK the key with its logger-key option (for example `loggerKey` in Node or
  `WithLoggerKey` in Go). When your logger asks whether to write a message, the SDK puts the
  logger's name into the context as `quonfig-sdk-logging.key` and evaluates the config.
- Rules are evaluated top to bottom, and the first rule that matches wins. A rule on
  `quonfig-sdk-logging.key` can set the level for one logger, or for every logger under a prefix.
- The evaluation also sees the rest of your context, so a rule can match on `user.email` or any
  other property, just like a flag rule.

Per-logger rules on `quonfig-sdk-logging.key` work in the backend SDKs listed above. The browser SDK
doesn't send the logger name, so in the browser write rules on the context you pass to `init()`
instead; see [JavaScript](../../sdks/javascript.md#dynamic-log-levels).

## Example

Create the config with a default of `INFO` for every logger in the app:

```bash
qfg log-level log-level.my-app --value=INFO
```

Turn on `DEBUG` for every logger whose name starts with `com.example.auth`:

```bash
qfg log-level log-level.my-app --target=com.example.auth --value=DEBUG
```

Use the prefix your logger names actually have, for example `MyApp.Services.Auth` in .NET,
`MyApp::Services::Auth` in Ruby or `my_app.auth` in Python. The match is a plain string prefix on
the logger name the SDK receives.

`--target` adds a rule above the existing rules, so it wins over the default. Run it again with the
same target to change that rule's level. Pass `--target` more than once to match any of several
prefixes in one rule. Add `--environment=<env>` to write the rule to one environment only:

```bash
qfg log-level log-level.my-app --target=org.apache.kafka --value=ERROR --environment=production
```

After the first two commands, the config's default rules look like this (other fields left out):

```json
{
  "key": "log-level.my-app",
  "type": "log_level",
  "valueType": "log_level",
  "default": {
    "rules": [
      {
        "criteria": [
          {
            "operator": "PROP_STARTS_WITH_ONE_OF",
            "propertyName": "quonfig-sdk-logging.key",
            "valueToMatch": { "type": "string_list", "value": ["com.example.auth"] }
          }
        ],
        "value": { "type": "log_level", "value": "DEBUG" }
      },
      {
        "criteria": [{ "operator": "ALWAYS_TRUE" }],
        "value": { "type": "log_level", "value": "INFO" }
      }
    ]
  }
}
```

To change the catch-all level in one environment, use `set-default`:

```bash
qfg set-default log-level.my-app --value=DEBUG --environment=production
```

## Rules on other properties

`qfg log-level --target` only writes rules on `quonfig-sdk-logging.key`. For any other rule, such as
turning on `DEBUG` for one developer by `user.email`, open the log level under **Log Levels** in the
Quonfig app and add the rule there. Log-level rules use the same operators as flag and config rules;
see [Rules and Segmentation](./rules-and-segmentation.md).

You can also edit the config's JSON in your workspace repo. Log levels live in the `log-levels/`
directory, one file per key.

See the [CLI reference](../../tools/cli.md#log-level) for every `qfg log-level` option.
