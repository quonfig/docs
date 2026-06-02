---
title: Python
---

## Getting Started with the Python SDK
[Github](https://github.com/quonfig/sdk-python) | [PyPI](https://pypi.org/project/quonfig/)


Add `quonfig` to your package dependencies

```bash
pip install quonfig
```

```python
# pyproject.toml
[tool.poetry.dependencies]
quonfig = "^0.0.21"
```

## Initialize Client

If you set `QUONFIG_BACKEND_SDK_KEY` as an environment variable, initializing the client is as easy as

```python
from quonfig import Quonfig

client = Quonfig()
client.init()
```

You can also pass the SDK key explicitly:

```python
from quonfig import Quonfig

client = Quonfig(sdk_key="sdk-...")
client.init()
```

`init()` returns the client, so `client = Quonfig(sdk_key="sdk-...").init()` works too.
Unless your options are configured to run using only local data, the client will attempt to connect to
the remote CDN.

<details className="alert--warning">
<summary>

#### Special Considerations with Forking servers like Gunicorn that use workers

</summary>

Webservers like gunicorn can be configured to either use threads or fork child process workers. When forking, the Quonfig SDK client must be re-created in order to continue to fetch updated configuration.

```python
from quonfig import Quonfig

# gunicorn configuration hook
def post_worker_init(worker):
    global client
    client = Quonfig().init()
```

You may also do something like using uWSGI decorators

```python
from quonfig import Quonfig

@uwsgidecorators.postfork
def post_fork():
    global client
    client = Quonfig().init()
```


This re-creates the SDK client after forking to ensure proper configuration updates.


</details>


## Basic Usage

### Defaults

Here we ask for the value of a config named `max-jobs-per-second`, and we specify
`10` as a default value if no value is available.

```python
client.get("max-jobs-per-second", default=10) # => 10
```

If no default is provided, the default behavior is to raise a `QuonfigKeyNotFoundError`.

```python
# raises a `QuonfigKeyNotFoundError`
client.get("max-jobs-per-second")
```

<details>
<summary>
Handling Undefined Configs
</summary>

If you would prefer your application return `None` instead of raising an error,
you can set `on_no_default="warn"` (log a warning and return `None`) or
`on_no_default="ignore"` (silently return `None`) when constructing the client.

```python
from quonfig import Quonfig

client = Quonfig(sdk_key="sdk-...", on_no_default="warn").init()
client.get("max-jobs-per-second") # => None
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
print(config_key, client.get(config_key))

ff_key = "my-first-feature-flag"
print(ff_key, client.is_feature_enabled(ff_key))
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
from quonfig import Quonfig
import os, platform

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

client = Quonfig(sdk_key="sdk-...", global_context=global_context).init()
```

Global context is the least specific context and will be overridden by more specific context passed in at the time of evaluation.

### Providing Context at Evaluation Time

You can provide context when evaluating individual flags or config values via the `contexts=` keyword argument:

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

result = client.is_feature_enabled("my-first-feature-flag", contexts=context)
```

Feature flags don't have to return just true or false. You can get other data types using `get`:

```python
client.get("ff-with-string", default="default-string", contexts=context)
client.get("ff-with-int", default=5)
```

### Bound context

To avoid having to pass a context explicitly to every call to `get` or `is_feature_enabled`, you can
bind a context once with `with_context`, which returns a client wrapper that applies that context to
every evaluation:

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

bound = client.with_context(context)

# these two calls are equivalent
result1 = bound.is_feature_enabled("my-first-feature-flag")
result2 = client.is_feature_enabled("my-first-feature-flag", contexts=context)

result1 == result2 #=> True
```

### Scoped context

It is also possible to scope a context for a particular block of code using the `scoped_context`
context manager — calls inside the `with` block pick up the context automatically:

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

with client.scoped_context(context):
    result1 = client.is_feature_enabled("my-first-feature-flag")

result2 = client.is_feature_enabled("my-first-feature-flag", contexts=context)

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

## Testing

Point the client at a local data directory instead of the remote CDN with `datadir`:

```python
from quonfig import Quonfig

client = Quonfig(datadir="path/to/quonfig-data").init()
client.get(...)
```

## Reference

### Available constructor parameters

All parameters are keyword arguments to `Quonfig(...)`.

- `sdk_key` - your quonfig.com SDK key. Falls back to the `QUONFIG_BACKEND_SDK_KEY` environment variable.
- `api_urls` - override the API endpoints your SDK key connects to (list of base URLs).
- `datadir` - path to a local data directory to load config from instead of the remote CDN.
- `environment` - which environment to evaluate (`production`, `staging`, `development`); falls back to `QUONFIG_ENVIRONMENT`.
- `on_no_default` - one of `"error"` (default), `"warn"`, or `"ignore"`. Controls behavior when a config has no value and
  no default is supplied: raise `QuonfigKeyNotFoundError`, log a warning and return `None`, or silently return `None`.
- `on_init_failure` - one of `"raise"` (default), `"return"`, or `"return_zero_value"`. Controls what happens if the initial
  fetch fails or times out.
- `init_timeout_ms` - how long `init()` waits for the first successful fetch (defaults to `10000`).
- `collect_evaluation_summaries` - send aggregate data about config and feature flag evaluations (defaults to `True`).
- `context_upload_mode` - send context information to Quonfig. One of `"none"`, `"shapes_only"` (field names and types only),
  or `"periodic_example"` (types plus example contexts; the default).
- `global_context` - a global context to be used in all lookups. Use this for things like availability zone, machine type...
- `fallback_poll_enabled` / `fallback_poll_interval_ms` - poll the CDN when the SSE stream is unavailable (defaults `True` / `60000`).
- `logger_key` - the `log_level` config key consulted by `should_log(logger_path=...)`. No default — set it to enable the `logger_path` convenience (defaults to `None`).
