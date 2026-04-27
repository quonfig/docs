---
title: Python
---

## Getting Started with the Python SDK
[Github](https://github.com/QuonfigHQ/sdk-python) | [PyPI](https://pypi.org/project/sdk-quonfig/)


Add `sdk-quonfig` to your package dependencies

```python
# pyproject.toml
[tool.poetry.dependencies]
sdk-quonfig = "1.1.0"
```

## Initialize Client

If you set `QUONFIG_BACKEND_SDK_KEY` as an environment variable, initializing the client is as easy as

```python
from sdk_quonfig import QuonfigSDK, Options

sdk = QuonfigSDK(Options())

```
Unless your options are configured to run using only local data, the client will attempt to connect to
the remote CDN.

<details className="alert--warning">
<summary>

#### Special Considerations with Forking servers like Gunicorn that use workers

</summary>

Webservers like gunicorn can be configured to either use threads or fork child process workers. When forking, the Quonfig SDK client must be re-created in order to continue to fetch updated configuration.

```python
from sdk_quonfig import QuonfigSDK, Options

# gunicorn configuration hook
def post_worker_init(worker):
    global sdk
    sdk = QuonfigSDK(Options())
```

You may also do something like using uWSGI decorators

```python
from sdk_quonfig import QuonfigSDK, Options

@uwsgidecorators.postfork
def post_fork():
    global sdk
    sdk = QuonfigSDK(Options())
```


This re-creates the SDK client after forking to ensure proper configuration updates.


</details>


## Basic Usage

### Defaults

Here we ask for the value of a config named `max-jobs-per-second`, and we specify
`10` as a default value if no value is available.

```python
sdk.get("max-jobs-per-second", default=10) # => 10
```

If no default is provided, the default behavior is to raise a `MissingDefaultException`.

```python
# raises a `MissingDefaultException`
sdk.get("max-jobs-per-second")
```

<details>
<summary>
Handling Undefined Configs
</summary>

If you would prefer your application return `None` instead of raising an error,
you can set `on_no_default="RETURN_NONE"` when creating your Options object.

```python
from sdk_quonfig import QuonfigSDK, Options

options = Options(
    on_no_default="RETURN_NONE"
)
sdk = QuonfigSDK(options)
sdk.get("max-jobs-per-second") # => None
```

</details>

### Getting Started

Now create a config named `my-first-int-config` in the Quonfig UI. Set a default
value to 50 and sync your change to the API.

Add a feature flag named `my-first-feature-flag` in the Quonfig UI. Add boolean
variants of `true` and `false`. Set the inactive variant to false, make the flag
active and add a rule of type `ALWAYS_TRUE` with the variant to serve as `true`.
Remember to sync your change to the API.

```python
config_key = "my-first-int-config"
print(config_key, sdk.get(config_key))

ff_key = "my-first-feature-flag"
print(ff_key, sdk.enabled(ff_key))
```

Run the code above and you should see:

```
my-first-int-config 50
my-first-feature-flag true
```

Congrats! You're ready to rock!

## Feature Flags

Feature flags become more powerful when we give the flag evaluation [rules](/docs/explanations/features/rules-and-segmentation) more
information to work with.

We do this by providing a [context](/docs/explanations/concepts/context)
for the current user (and/or team, request, etc)

## Context

### Global Context

When initializing the client, you can set a global context that will be used for all evaluations. Use global context for information that doesn't change - for example, your application's key, availability zone, machine type, etc.

```python
from sdk_quonfig import QuonfigSDK, Options
import platform

global_context = {
    "application": {
        "key": "my-python-app",
        "environment": "production"
    },
    "host": {
        "name": platform.node(),
        "cpu_count": os.cpu_count()
    }
}

options = Options(global_context=global_context)
sdk = QuonfigSDK(options)
```

Global context is the least specific context and will be overridden by more specific context passed in at the time of evaluation.

### Providing Context at Evaluation Time

You can provide context when evaluating individual flags or config values:

```python
context = {
    "user": {
        "key": 123,
        "subscription_level": "pro",
        "email": "bob@example.com"
    },
    "team": {
        "key": 432,
    },
    "device": {
        "key": "abcdef",
        "mobile": False
    }
}

result = sdk.enabled("my-first-feature-flag", context=context)
```

Feature flags don't have to return just true or false. You can get other data types using `get`:

```python
sdk.get("ff-with-string", default="default-string", context=context)
sdk.get("ff-with-int", default=5)
```

### Thread-local context

To avoid having to pass a context explicitly to every call to `get` or `enabled`, it is possible to set a thread-local
context that will be evaluated as the default argument to `context=` if none is given.

```python
from sdk_quonfig import QuonfigSDK, Options, Context

context = {
    "user": {
        "key": 123,
        "subscription_level": "pro",
        "email": "bob@example.com"
    },
    "team": {
        "key": 432,
    },
    "device": {
        "key": "abcdef",
        "mobile": False
    }
}

shared_context = Context(context)

Context.set_current(shared_context)

# with this set, the following two client calls are equivalent

result = sdk.enabled("my-first-feature-flag")
result = sdk.enabled("my-first-feature-flag", context=context)
```

### Scoped context

It is also possible to scope a context for a particular block of code, without needing to set and unset
the thread-local context

```python
from sdk_quonfig import QuonfigSDK, Options

context = {
    "user": {
        "key": 123,
        "subscription_level": "pro",
        "email": "bob@example.com"
    },
    "team": {
        "key": 432,
    },
    "device": {
        "key": "abcdef",
        "mobile": False
    }
}

sdk = QuonfigSDK(Options())

with sdk.scoped_context(context):
    result1 = sdk.enabled("my-first-feature-flag")

result2 = sdk.enabled("my-first-feature-flag", context=context)

result1 == result2 #=> True
```

## Dynamic Log Levels

Log levels in Quonfig are stored as a `log_level` config (e.g. `log-level.my-app`). The SDK consults that config on every log call, so changes made in Quonfig take effect live via SSE without restarting.

### Concept

- One `log_level` config per app, keyed like `log-level.my-app`. Value is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`.
- Tell the client which config to consult via the `logger_key` constructor argument.
- `client.should_log(logger_path=..., desired_level=...)` pushes `logger_path` into the evaluation context as `quonfig-sdk-logging.key` (verbatim — no normalization) so a single config can drive per-module rules.
- `client.should_log(config_key=..., desired_level=...)` is the primitive form — use it when you want to evaluate a specific config without the convenience layer.
- Logger names flowing through `quonfig-sdk-logging.key` are auto-captured by example-context telemetry, so the dashboard can auto-suggest rule targets.

### Install

```bash
pip install quonfig
```

### Basic usage

```python
from quonfig import Quonfig

client = Quonfig(
    sdk_key="sdk-...",
    logger_key="log-level.my-app",
).init()

if client.should_log(logger_path="my_app.auth", desired_level="DEBUG"):
    # ...
    pass

# Primitive form — no auto-injection
if client.should_log(config_key="log-level.my-app", desired_level="DEBUG"):
    pass
```

### Rule example

Create a `log_level` config with key `log-level.my-app` and target individual loggers via `quonfig-sdk-logging.key`:

```yaml
# Default to INFO for every logger in this app
default: INFO

rules:
  # Bump a module to DEBUG
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "my_app.auth"
    value: DEBUG

  # Silence a chatty library
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "urllib3"
    value: ERROR

  # Turn DEBUG on for one developer, everywhere
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG
```

Because the evaluator sees your full context — global context, per-request context, and `quonfig-sdk-logging.key` — you can combine logger rules with user, environment, or request context for targeted debugging.

### Stdlib `logging` integration

`QuonfigLoggerFilter` is a `logging.Filter` you can attach to any logger or handler. It gates each record through `client.should_log(logger_path=record.name, ...)`:

```python
import logging
from quonfig import Quonfig, QuonfigLoggerFilter

client = Quonfig(sdk_key="sdk-...", logger_key="log-level.my-app").init()

root = logging.getLogger()
root.setLevel(logging.DEBUG)  # let Quonfig do the filtering
root.addFilter(QuonfigLoggerFilter(client))

logging.getLogger("my_app.auth").debug("filtered by Quonfig")
```

The record's `name` flows into the context verbatim as `quonfig-sdk-logging.key`, so rules that `starts-with: "my_app.auth"` match what your app already logs.

### structlog integration

`structlog` is an optional dependency. Install it separately (`pip install structlog`) and use `QuonfigLoggerProcessor` in your processor pipeline:

```python
import structlog
from quonfig import Quonfig, QuonfigLoggerProcessor

client = Quonfig(sdk_key="sdk-...", logger_key="log-level.my-app").init()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,   # must come before QuonfigLoggerProcessor
        QuonfigLoggerProcessor(client),
        structlog.dev.ConsoleRenderer(),
    ]
)

logger = structlog.get_logger("my_app.auth")
logger.debug("filtered by Quonfig")
```

`QuonfigLoggerProcessor` raises at construction time if `structlog` isn't installed. Place it after `structlog.stdlib.add_log_level` so the level name is populated before the processor checks it.

### Reference

| Name                                                  | Example                                                                      | Description                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `logger_key` (constructor)                            | `Quonfig(sdk_key=..., logger_key="log-level.my-app")`                        | The `log_level` config consulted by the `should_log(logger_path=...)` convenience. Required for the `logger_path` form. |
| `should_log(logger_path=..., desired_level=...)`      | `client.should_log(logger_path="my_app.auth", desired_level="DEBUG")`        | Convenience. Uses `logger_key` + injects `quonfig-sdk-logging.key = logger_path`.                                    |
| `should_log(config_key=..., desired_level=...)`       | `client.should_log(config_key="log-level.my-app", desired_level="DEBUG")`    | Primitive. Evaluates the named config directly — no auto-injection. Useful for custom adapters.                      |
| `QuonfigLoggerFilter(client, logger_path=None)`       | `root.addFilter(QuonfigLoggerFilter(client))`                                | Stdlib `logging.Filter`. Reads the record's `name` into `quonfig-sdk-logging.key`.                                   |
| `QuonfigLoggerProcessor(client, logger_path=None)`    | `structlog.configure(processors=[..., QuonfigLoggerProcessor(client)])`      | structlog processor. Requires `structlog` to be installed.                                                           |

## Debugging

At this time, it's not possible to dynamically control the loglevel of the Quonfig client itself. Instead control the Quonfig client's log level by changing the `bootstrap_loglevel` in the `Options` class at start up.

By default this level is set to `Logging.WARNING`

## Testing


```python
from sdk_quonfig import QuonfigSDK, Options

sdk = QuonfigSDK(Options(data_sources="LOCAL_ONLY"))
sdk.get(...)
```

## Reference

### Available `Option` parameters

- `sdk_key` - your quonfig.com SDK key
- `quonfig_api_url` - the API endpoint your SDK key has been created for (i.e. `https://primary.quonfig.com`)
- `datafile` - datafile to load
- `on_no_default` - one of `"RAISE"` (default) or `"RETURN_NONE"`. This determines how the client behaves when a request for
  a config cannot find a value, and no default is supplied. These settings will, respectively, raise a `MissingDefaultException`,
  or return `None`.
- `on_connection_failure` - one of `"RETURN"` (default) or `"RAISE"`. This determines what should happen if the connection to
  a remote datasource times out. These settings will, respectively, return whatever is in the local cache from the latest sync
  from the remote source, or else raise an `InitializationTimeoutException`.
- `collect_sync_interval` - how often to send telemetry to Quonfig (seconds, defaults to 30)
- `collect_evaluation_summaries` - send aggregate data about config and feaure flag evaluations, results (defaults to True) **Evaluation Summary telemetry Implemented in v0.10+**
- `collect_logs` - send aggregate logger volume data to Quonfig (defaults to True)
- `context_upload_mode` - send context information to Quonfig. Values (from the `Options.ContextUploadMode` enum) are `NONE` (don't send any context data), `SHAPE_ONLY` to only send the schema of the contexts to Quonfig (field name, data types), `PERIODIC_EXAMPLE` to send the data types AND the actual contexts being used to Quonfig **Context telemetry Implemented in v0.10+**
- `global_context` - an immutable global context to be used in all lookups. Use this for things like availability zone, machine type...
- `on_ready_callback` - register a single method to be called when the client has loaded its first configuration and is ready for use
- `logger_key` - the `log_level` config key consulted by `should_log(logger_path=...)`. No default — set it to enable the `logger_path` convenience (defaults to `None`).
