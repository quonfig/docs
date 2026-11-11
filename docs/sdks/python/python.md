---
title: Python
---

## Getting Started with the Python SDK
[Github](https://github.com/quonfig/sdk-python) | [PyPI](https://pypi.org/project/quonfig/)


Add `quonfig` to your package dependencies

```bash
pip install quonfig
```

Or, with Poetry (it writes a constraint for the latest release into `pyproject.toml`):

```bash
poetry add quonfig
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
Unless your options are configured to run using only local data, the client connects to Quonfig's
delivery servers (`primary.quonfig.com`, with `secondary.quonfig.com` as the failover).

### If Quonfig is unreachable at startup

`init()` blocks until the first config loads, retrying (jittered backoff from
0.5s, capped at 30s) for up to `init_timeout_ms` (default 10s). A healthy boot
returns as soon as the config lands. If no config loads by then,
`on_init_failure` decides what happens:

| `on_init_failure` | At the timeout | 401/403/404/410 from every configured leg |
|---|---|---|
| `"fail"` (default) | raises `QuonfigInitError` (`QuonfigInitTimeoutError`, a subclass, if no leg answered) | raises at once (`reason="unauthorized"`) |
| `"wait"` | keeps blocking and retrying | logs an ERROR and keeps retrying |
| `"continue"` | returns and logs an ERROR; getters serve code defaults | returns at once |

```python
from quonfig import Quonfig, QuonfigInitError

client = Quonfig(sdk_key="sdk-...", on_init_failure="fail", init_timeout_ms=10_000)
try:
    client.init()
except QuonfigInitError as e:
    print(e.reason)  # "unavailable" | "unauthorized" | "timeout"
    raise
```

Getters never block on init. Before the first config they return your default
(or apply `on_no_default`). A client you keep after a caught
`QuonfigInitError` keeps retrying in the background and heals on its own:
check `client.is_ready()` or block on `client.wait_for_ready(timeout_ms=...)`,
which returns `True` or `False`. Under `"wait"` or `"continue"`, wire your
readiness probe to `is_ready()`.

The 1.x spellings `"raise"` (= `"fail"`) and `"return"` /
`"return_zero_value"` (= `"continue"`) still work and log a one-time
deprecation WARN. Any other value raises `ValueError`. For how to choose
between the three, see
[If Quonfig Is Unreachable at Startup](/docs/explanations/architecture/startup-failure).

#### Upgrading from 1.x to 2.0.0

- **`init()` can now raise.** In 1.x it returned at once and never raised. If
  your code relied on that, either catch `QuonfigInitError` around `init()` or
  pass `on_init_failure="continue"` to keep booting on code defaults.
- **`init()` now blocks** until the first config loads, typically 100-300 ms
  on a healthy boot, and up to `init_timeout_ms` when delivery is down.
- **Getters no longer raise `QuonfigInitTimeoutError`.** Before the first
  config they return your default; `*_details` getters report
  `reason="ERROR"`, `error_code="PROVIDER_NOT_READY"`.
- **`except QuonfigInitTimeoutError` still works**: it is now a subclass of
  `QuonfigInitError`, but it only catches the hang case. Catch
  `QuonfigInitError` to cover `unavailable` and `unauthorized` too.
- **Readiness:** use `is_ready()` and `wait_for_ready()`. `ready()` remains as
  an alias of `is_ready()`.
- `init_timeout_ms` of zero or less runs exactly one attempt, then applies
  `on_init_failure`.

<details className="alert--warning">
<summary>

#### Forking servers (Gunicorn `--preload`, Celery prefork, uWSGI, `multiprocessing`)

</summary>

**No wiring is required on POSIX.** Importing `quonfig`
installs a child-only `os.register_at_fork` handler. A client built in the
master is re-initialized in each forked worker on that worker's first use:
the worker fetches its own config and opens its own SSE stream, and the
master is never touched. A forked worker that never calls the SDK costs
nothing. Details, platform notes (gevent, uWSGI `--enable-threads`, macOS)
and the exact list of calls that trigger the rebuild are in the SDK README's
["Forking servers" section](https://github.com/quonfig/sdk-python#forking-servers-gunicorn---preload-celery-uwsgi-multiprocessing).

Two things worth knowing:

- The **first evaluation** in a forked worker pays one config fetch, bounded
  by `init_timeout_ms`, and follows `on_init_failure` exactly like a fresh
  boot (see worker recycling below for what that means during an outage).
  To pay it before the
  first request instead, call `init()` on the master-built client in the
  worker's post-fork hook (only under `--preload`; a client that was built in
  the worker is already fresh and must not be `init()`ed twice). **Catch
  `QuonfigInitError` in the hook.** Under the default `on_init_failure="fail"`
  that `init()` raises when Quonfig is unreachable, and Gunicorn treats an
  exception from `post_fork` as a worker that failed to boot: it halts the
  master and every running worker. Caught, the worker boots, keeps retrying,
  and behaves as described under worker recycling below. Don't use this hook
  with `on_init_failure="wait"`, which blocks the worker from booting until
  Quonfig is back.

```python
# gunicorn.conf.py, with --preload
from quonfig import QuonfigInitError

def post_fork(server, worker):
    from myapp import client   # the client built and init()ed in the master
    try:
        client.init()          # re-initializes this worker now instead of on first use
    except QuonfigInitError:
        # Never let this escape: Gunicorn would halt the whole server.
        server.log.warning("Quonfig unreachable at fork; worker keeps retrying")
```

- **Worker recycling during an outage.** A worker started while Quonfig is
  unreachable (Gunicorn `max_requests`, a Celery child replaced after
  `max_tasks_per_child`) never uses the master's config: its first evaluation
  blocks for up to `init_timeout_ms` (10s by default). Under the default
  `on_init_failure="fail"`, that read and every later content read raise
  `QuonfigInitError` until Quonfig is reachable. `is_feature_enabled` is the
  exception: it never raises and returns its default instead, and the
  `*_details` getters return `reason="ERROR"` with
  `error_code="PROVIDER_NOT_READY"`. Under `"wait"` that first request blocks
  until Quonfig is back. If you recycle workers often, consider
  `on_init_failure="continue"` and make sure your in-code defaults are safe.
  The full table, for every mode, is in
  [Forked workers and worker recycling](../../explanations/architecture/startup-failure.md#forked-workers-and-worker-recycling).
- Health accessors such as `connection_state()` and `ready()` are
  diagnostic-only: in a worker that has not evaluated anything yet they report
  the pre-start state (`initializing`, `False`) without starting threads or
  making a request.

If you would rather build a fresh client in each worker, re-create it after
the fork:

```python
from quonfig import Quonfig

# gunicorn configuration hook
def post_worker_init(worker):
    global client
    client = Quonfig().init()
```

The same shape works with `@uwsgidecorators.postfork`. Re-creating the client
after the fork is the right move under **gevent** with a monkey-patched
master, and on **macOS** development machines, where a forked child that makes
HTTPS requests can be killed by the platform regardless of the SDK.

</details>


## Basic Usage

### Defaults

Here we ask for the value of a config named `max-jobs-per-second`, and we specify
`10` as a default value if no value is available.

```python
client.get_int("max-jobs-per-second", default=10) # => 10
```

If no default is provided, the default behavior is to raise a `QuonfigKeyNotFoundError`.

```python
# raises a `QuonfigKeyNotFoundError`
client.get_int("max-jobs-per-second")
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
client.get_int("max-jobs-per-second") # => None
```

</details>

### Typed getters

Read each config with the getter for its type. Every getter takes `default=` and
`contexts=` keyword arguments.

| Getter | Reads |
|---|---|
| `get_string` | string and log_level configs |
| `get_bool` | bool configs |
| `get_int` | int configs, and doubles that are whole numbers within +/-(2^53-1) |
| `get_float` | double and int configs |
| `get_string_list` | string_list configs |
| `get_duration` | duration configs, in seconds |
| `get_json` | json configs |
| `get` | any config, as its stored type |
| `is_feature_enabled` | bool flags; `False` for anything else, and never raises |

Values are never coerced: a stored string `"false"` is not a bool and `"3"` is
not a number. When a getter has no value of its type, it returns your `default`.
That covers a missing key, a value of another type, a malformed value (an int
config holding `"twelve"`), an unset ENV_VAR and a secret that cannot be
decrypted. Every case except a missing key logs one WARN per key. With no
default, `on_no_default` decides: `"error"` (the default) raises
(`QuonfigKeyNotFoundError` for a missing key, `QuonfigTypeMismatchError` for a
wrong type, `QuonfigEnvVarCoerceError` for a malformed value,
`QuonfigEnvVarNotSetError` or `QuonfigDecryptionError`), and `"warn"` and
`"ignore"` return `None`.

The `*_details` getters (`get_bool_details`, `get_string_details` and so on)
never raise. They return the value with a `reason`, and an `error_code`
(`FLAG_NOT_FOUND`, `TYPE_MISMATCH`, `PARSE_ERROR`, `PROVIDER_NOT_READY` or
`GENERAL`) when `reason="ERROR"`. `evaluate_details(key, contexts=None)` reads
any config in its stored form, for example a duration as its ISO 8601 text
(`"PT90S"`), with `value_type` naming the stored type.

```python
timeout = client.get_duration("http.timeout", default=5.0)  # seconds
regions = client.get_string_list("allowed-regions", default=["us"])

details = client.get_int_details("max-jobs-per-second")
if details.reason == "ERROR":
    print(details.error_code)  # e.g. "TYPE_MISMATCH"
```

The rules are the same in every Quonfig SDK; see
[Typed Getters, Defaults, and Error Codes](/docs/explanations/concepts/typed-getters).
The SDK README's
[typed getters table](https://github.com/quonfig/sdk-python#typed-getters)
lists every case.

#### Upgrading from 2.x to 3.0

- **No string coercion.** 2.x converted values, so `get_bool` on a stored
  string `"false"` returned `True`. In 3.0 that is a type mismatch and returns
  your default. Store values with the config type you read them with.
- **A failed read returns your default.** 2.x raised for an unset ENV_VAR or a
  decryption failure even when you passed a default. 3.0 returns the default
  and logs one WARN per key. To make a bad secret fatal, read it without a
  default under `on_no_default="error"`.
- **Numbers convert only when exact.** `get_int` on `3.9` is a type mismatch;
  2.x truncated it to `3`.
- **`is_feature_enabled` never raises.**

The full list is in the
[CHANGELOG](https://github.com/quonfig/sdk-python/blob/main/CHANGELOG.md#upgrade-to-30).

### Getting Started

Create an int config and a feature flag that is on, with the [`qfg` CLI](/docs/tools/cli)
(or in the Quonfig app; the [Get Started tutorial](/docs/tutorials/get-started) shows how):

```bash
qfg create my-first-int-config --type int --value=50
qfg create my-first-feature-flag --type boolean-flag --value=true
```

```python
config_key = "my-first-int-config"
print(config_key, client.get(config_key))

ff_key = "my-first-feature-flag"
print(ff_key, client.is_feature_enabled(ff_key))
```

Run the code above and you should see:

```
my-first-int-config 50
my-first-feature-flag True
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

Create a `log_level` config with key `log-level.my-app`, then target individual loggers via `quonfig-sdk-logging.key` with the [`qfg` CLI](/docs/tools/cli). Each `--target` adds a rule that matches every logger whose name starts with that prefix:

```bash
# Default to INFO for every logger in this app
qfg log-level log-level.my-app --value=INFO

# Bump a module to DEBUG
qfg log-level log-level.my-app --target=my_app.auth --value=DEBUG

# Silence a chatty library, in one environment only
qfg log-level log-level.my-app --target=urllib3 --value=ERROR --environment=production
```

For other criteria, such as turning DEBUG on for one developer by `user.email`, add the rule in the Quonfig app or edit the config's JSON in your workspace repo.

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

The record's `name` flows into the context verbatim as `quonfig-sdk-logging.key`, so a `--target=my_app.auth` rule matches what your app already logs.

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

## Telemetry

The SDK sends evaluation summaries and context data in the background so the dashboard can show
which flags are used and with what contexts. Opt out with `collect_evaluation_summaries=False` and
`context_upload_mode="shapes_only"` (no example contexts) or `"none"` (no context data); see
[constructor parameters](#available-constructor-parameters).

How the SDK delivers telemetry, and what it does when the endpoint is slow or down, is the same in
every SDK and is explained once on the [Telemetry](../../explanations/architecture/telemetry.md)
page. The Python option names and defaults, all keyword arguments to
`Quonfig(...)`:

| Option                               | Default           |
| ------------------------------------ | ----------------- |
| `telemetry_flush_interval_ms`        | `60_000` (60s)    |
| `telemetry_timeout_ms`               | `15_000` (15s)    |
| `telemetry_connect_timeout_ms`       | `5_000` (5s)      |
| `telemetry_max_retained_batches`     | `5`               |
| `telemetry_max_retained_bytes`       | `2_097_152` (2MB) |
| `telemetry_max_retained_age_ms`      | `300_000` (5 min) |
| `telemetry_max_evaluation_summaries` | `10_000`          |
| `telemetry_max_context_shape_fields` | `10_000`          |
| `telemetry_max_example_contexts`     | `10_000`          |

`None` or a non-positive value means the default. `telemetry_timeout_ms` bounds each read of the
response (`requests` has no whole-request deadline), so a server that never answers is abandoned
after 15s. Telemetry logs through the stdlib logger `quonfig.telemetry`.

A client you never close still sends its last window at interpreter exit, from an `atexit` hook
(all clients in parallel, 5s at most in total). A forked child never re-sends its parent's window.
With the default 60s flush interval, evaluations reach the dashboard up to a minute later.

## Invalid or revoked SDK key

If Quonfig rejects the SDK key while the client is running, `quonfig`
stops streaming, probes every 150-300 seconds until the key works again, and
logs one ERROR naming the HTTP status and host (never the key). The full rule
is on the [Reliability](../../explanations/architecture/resiliency.md#invalid-or-revoked-sdk-key) page.

While the key is rejected, `connection_state()` returns `"disconnected"`
(never `"falling_back"`) and `fallback_poller_active()` returns `False`.
Evaluation keeps serving the last installed configuration, and the client
recovers by itself on the first accepted probe.

## Testing

Point the client at a local data directory instead of Quonfig's delivery servers with `datadir` (or the `QUONFIG_DIR` environment variable). Datadir mode
requires an environment: pass `environment=` or set `QUONFIG_ENVIRONMENT`, otherwise `init()` raises
`RuntimeError`.

```python
from quonfig import Quonfig

client = Quonfig(datadir="path/to/quonfig-data", environment="development").init()
client.get(...)
```

## Reference

### Available constructor parameters

All parameters are keyword arguments to `Quonfig(...)`.

- `sdk_key` - your quonfig.com SDK key. Falls back to the `QUONFIG_BACKEND_SDK_KEY` environment variable.
- `api_urls` - override the API endpoints your SDK key connects to (list of base URLs).
- `datadir` - path to a local data directory to load config from instead of Quonfig's delivery servers. Falls back to the `QUONFIG_DIR` environment variable.
- `data_dir_auto_reload` / `data_dir_auto_reload_debounce_ms` - in `datadir` mode, watch the directory and reload when files change (defaults `False` / `200`).
- `environment` - which environment to evaluate (`production`, `staging`, `development`); falls back to `QUONFIG_ENVIRONMENT`.
  Applies only in `datadir` mode, where it is required. With an SDK key the environment comes from the key, so this
  setting is ignored and the SDK logs a warning.
- `on_no_default` - one of `"error"` (default), `"warn"`, or `"ignore"`. Controls behavior when a getter has no value and
  no default is supplied: raise the underlying error (`QuonfigKeyNotFoundError` for a missing key, `QuonfigTypeMismatchError`
  for a wrong type, and so on; see [Typed getters](#typed-getters)), log a warning and return `None`, or silently return `None`.
- `on_init_failure` - one of `"fail"` (default), `"wait"`, or `"continue"`. Controls what `init()` does if no config
  loads within `init_timeout_ms` (see [If Quonfig is unreachable at startup](#if-quonfig-is-unreachable-at-startup)).
  `"raise"`, `"return"` and `"return_zero_value"` are deprecated aliases.
- `init_timeout_ms` - how long `init()` retries the first fetch before applying `on_init_failure` (defaults to `10000`).
  With an SDK key, `init()` blocks until config loads or this runs out; getters never wait. In `datadir` mode `init()`
  loads synchronously and this setting does not apply.
- `collect_evaluation_summaries` - send aggregate data about config and feature flag evaluations (defaults to `True`).
- `context_upload_mode` - send context information to Quonfig. One of `"none"`, `"shapes_only"` (field names and types only),
  or `"periodic_example"` (types plus example contexts; the default).
- `global_context` - a global context to be used in all lookups. Use this for things like availability zone, machine type...
- `fallback_poll_enabled` / `fallback_poll_interval_ms` - poll the delivery API when the SSE stream is unavailable (defaults `True` / `60000`).
- `enable_sse` - keep a live SSE stream open for real-time updates (defaults to `True`). Pass `False` on serverless hosts; with `fallback_poll_enabled=True` polling becomes the primary update channel, with both `False` the client only updates via `refresh()` / `update_if_staler_than()`. See [Lambdas / Serverless](/docs/sdks/python/lambdas).
- `logger_key` - the `log_level` config key consulted by `should_log(logger_path=...)`. No default — set it to enable the `logger_path` convenience (defaults to `None`).

The SDK README's [Configuration table](https://github.com/quonfig/sdk-python#configuration) lists every option, including `telemetry_url` and the URLs derived from `QUONFIG_DOMAIN`.
