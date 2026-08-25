---
title: Lambdas / Serverless
---

AWS Lambda (and any other host that freezes the process between invocations)
needs two decisions from you: where the client is created, and how config
updates reach a process that is asleep most of the time.

The options on this page — `enable_sse`, `update_if_staler_than()` and
`flush()` — require `quonfig >= 1.3.0`.

## One client per execution environment

Create and `init()` the client at module scope, outside the handler. Lambda
reuses a warm execution environment across many invocations, so the client is
built once per cold start and every later invocation reads the config already
in memory. Building it inside the handler pays a config fetch on every request
and throws the cache away each time.

```python
import os

from quonfig import Quonfig

# Module scope — runs once per execution environment, on cold start.
client = Quonfig(sdk_key=os.environ["QUONFIG_BACKEND_SDK_KEY"]).init()


def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["principalId"]
    bound = client.with_context({"user": {"key": user_id}})

    if bound.is_feature_enabled("my-flag"):
        # ...
        pass

    return {"statusCode": 200, "body": "ok"}
```

`init()` kicks off the first fetch in the background and returns immediately;
the first flag read then blocks until that fetch lands (bounded by
`init_timeout_ms`, default 10s). Either way the cost is paid once per cold
start, not on every request.

## The cost-lean recipe

The default client keeps an SSE stream open and runs background telemetry
timers. Neither is much use in Lambda: the process is frozen between
invocations, so the stream is dead weight and the timers don't fire. Turn all
of the background work off and pull updates on your own schedule instead.

```python
import os

from quonfig import Quonfig

client = Quonfig(
    sdk_key=os.environ["QUONFIG_BACKEND_SDK_KEY"],
    enable_sse=False,                    # no long-lived stream
    fallback_poll_enabled=False,         # no background poller — we drive updates
    collect_evaluation_summaries=False,  # no background telemetry
    context_upload_mode="none",          # no background telemetry
).init()


def lambda_handler(event, context):
    # Bound staleness to 60s. Non-blocking — see below.
    client.update_if_staler_than(60_000)

    bound = client.with_context({"user": {"key": event["pathParameters"]["userId"]}})
    return {"statusCode": 200, "body": bound.get("greeting", default="hello")}
```

With `enable_sse=False` and `fallback_poll_enabled=False`, the client fetches
once during `init()` and then never moves on its own. `update_if_staler_than()`
is what advances it.

### `update_if_staler_than()` is non-blocking

It is stale-while-revalidate, so it never adds network latency to the request
that calls it:

- If the config is fresher than `max_age_ms`, it returns `False` immediately,
  having done nothing but read the clock.
- If the config is stale, it starts one refresh on a background daemon thread
  and returns `True` **immediately**. The current invocation keeps serving the
  config already in memory; a later invocation sees the fresher one.
- Refreshes are coalesced — at most one is ever in flight, so calling this on
  every request cannot stack threads against a slow or unreachable upstream.

If the environment is frozen while that thread is mid-fetch, the thread simply
resumes on the next thaw. Installing a late payload is safe: every network
install goes through the reject-older guard, so a stale response cannot
overwrite newer config.

### Fleet consistency

Each execution environment refreshes on its own clock, so after a flag change
two warm environments can serve different values for up to `max_age_ms`.
That argument is the dial — lower it for a tighter fleet, raise it for fewer
refreshes.

## Vanilla defaults are also fine

None of this is required. SSE is billed per connection-minute, and a modest
fleet running the default settings costs cents a month:

```python
client = Quonfig(sdk_key=os.environ["QUONFIG_BACKEND_SDK_KEY"]).init()
```

You get flag changes in real time, with no staleness window to reason about.
The tuned recipe above is for large fleets, where connection-minutes add up, or
for people who want zero background work in the process. Start with the
defaults and tune when you have a reason to.

## Telemetry

If you keep telemetry on, call `client.flush()` before returning. Evaluation
summaries and context shapes are batched in memory and POSTed by a background
timer, and that timer does not fire while the environment is frozen — so
telemetry recorded during an invocation waits for the next thaw and is lost
when the environment is recycled. `flush()` drains and delivers it
synchronously (it does add a POST to the request path), is a no-op when
telemetry is disabled, and never raises.

```python
def lambda_handler(event, context):
    body = client.get("greeting", default="hello")
    client.flush()
    return {"statusCode": 200, "body": body}
```
