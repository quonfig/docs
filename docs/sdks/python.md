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

The Quonfig SDK provides integration with Python's standard logging module and structlog, enabling you to dynamically manage log levels across your application in real-time without restarting.

### Features

- **Centrally manage log levels** - Control logging across your entire application from the Quonfig dashboard
- **Real-time updates** - Change log levels without restarting your application
- **Context-aware logging** - Different log levels for different loggers based on runtime context
- **Framework support** - Works with standard Python logging and structlog

### Standard Python Logging Integration

Add the `LoggerFilter` to your logging handlers during application startup:

```python
import logging
import sys
from sdk_quonfig import QuonfigSDK, Options, LoggerFilter

def configure_logger():
    """Add the Quonfig LoggerFilter after SDK is ready"""
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(LoggerFilter())

    logger = logging.getLogger()
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)  # Set to lowest level; Quonfig will filter

# Initialize SDK with on_ready_callback
sdk = QuonfigSDK(Options(on_ready_callback=configure_logger))

# Now all your logging respects Quonfig log levels
logger = logging.getLogger("myapp.services")
logger.debug("This will be filtered by Quonfig's dynamic config")
logger.info("So will this")
```

### Structlog Integration

Structlog is available as an optional dependency. Install it with:

```bash
pip install sdk-quonfig[structlog]
```

Add the `LoggerProcessor` to your structlog processor pipeline:

```python
import structlog
from sdk_quonfig import QuonfigSDK, Options, LoggerProcessor

# Configure structlog with Quonfig processor
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,  # Must come before LoggerProcessor
        structlog.processors.CallsiteParameterAdder(
            {
                structlog.processors.CallsiteParameter.MODULE,
            }
        ),
        LoggerProcessor().processor,  # Add Quonfig log level control
        structlog.dev.ConsoleRenderer(),
    ]
)

sdk = QuonfigSDK(Options())
logger = structlog.getLogger()

# Log levels are controlled dynamically by Quonfig
logger.debug("Debug message")
logger.info("Info message")
```

**Important**: The `LoggerProcessor` must come **after** `structlog.stdlib.add_log_level` in the processor pipeline.

### Configuration

Create a `LOG_LEVEL_V2` config in your Quonfig dashboard with key `log-levels.default`:

```yaml
# Default to INFO for all loggers
default: INFO

# Set specific packages to DEBUG
rules:
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "myapp.services"
    value: DEBUG

  # Only log errors in noisy third-party library
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "urllib3"
    value: ERROR
```

You can customize the config key name using the `logger_key` option. This is useful if you have multiple applications sharing the same Quonfig project and want to isolate log level configuration per application:

```python
from sdk_quonfig import QuonfigSDK, Options

# Use a different config key for this application
sdk = QuonfigSDK(Options(logger_key="myapp.log.levels"))
```

The SDK automatically includes `lang: "python"` in the evaluation context, which you can use in your rules to create Python-specific log level configurations:

```yaml
# Different log levels for Python vs other languages
rules:
  - criteria:
      quonfig-sdk-logging.lang: python
      quonfig-sdk-logging.logger-path:
        starts-with: "myapp"
    value: DEBUG

  - criteria:
      quonfig-sdk-logging.lang: java
      quonfig-sdk-logging.logger-path:
        starts-with: "com.myapp"
    value: INFO
```

### Targeted Log Levels

You can use [rules and segmentation](/docs/explanations/features/rules-and-segmentation) to change your log levels based on the current user/request/device context. This allows you to increase log verbosity for specific users, environments, or conditions without affecting your entire application.

The log level evaluation has access to **all context** that is available during evaluation, not just the `quonfig-sdk-logging` context. This means you can create rules combining:

- **SDK logging context** (`quonfig-sdk-logging.*`) - Logger name and language
- **Global context** - Application name, environment, availability zone, etc.
- **Dynamic context** - User, team, device, request information from thread-local or scoped context

For example, you can create rules like:

```yaml
# Enable DEBUG logs only for specific application in staging
rules:
  - criteria:
      application.key: "myapp"
      application.environment: "staging"
      quonfig-sdk-logging.logger-path:
        starts-with: "myapp"
    value: DEBUG

  # Enable DEBUG logs for a specific user across all applications
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG

  # Lower verbosity in production
  - criteria:
      application.environment: "production"
    value: WARN
```

This allows you to increase log verbosity for specific users, specific applications, particular environments, or any combination of conditions without affecting your entire system.

### How It Works

Once configured, the integration automatically filters **all** logging calls:

- Works with **all loggers** (no need to configure individual loggers)
- Filters happen **before** log messages are formatted (performance benefit)
- Checks configuration on every log call for real-time updates
- No modification of your existing logging configuration needed

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
- `quonfig_api_url` - the API endpoint your SDK key has been created for (i.e. `https://api.quonfig.com`)
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
- `logger_key` - the config key to use for dynamic log level configuration (defaults to `"log-levels.default"`)
