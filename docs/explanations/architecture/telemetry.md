---
title: Telemetry
sidebar_label: Telemetry
sidebar_position: 2
---

Quonfig SDKs send usage telemetry in the background so the dashboard can show
which flags and configs are evaluated, how often each rule and value is served,
and which contexts your app uses. This page explains what is sent, how an SDK
behaves when the telemetry endpoint is slow or down, and what it logs. Each SDK
page lists the option names for that language.

Telemetry never affects flag evaluation. It runs off the request path, every
failure is contained in a background reporter, and when telemetry cannot be
delivered the SDK drops it rather than slow down or grow your process.

## What is sent

- **Evaluation summaries.** Per flag or config: how many times each rule and
  value was served in the window. Turn off with `collectEvaluationSummaries`
  (spelled per language).
- **Context shapes.** The names and types of the context fields your app
  passes, for example `user.email: string`. These power autocomplete in the
  rule editor.
- **Example contexts.** For each distinct context `key`, at most one full
  context per hour, with its values (Go: v1.4.0+; earlier Go versions send one
  per flush window). See
  [What gets saved](../concepts/context.md#what-gets-saved--keys-example-contexts-and-your-bill)
  for how keys, example contexts and MTK billing relate.
- **Failover counters.** How often the SDK used the secondary delivery leg.

Backend SDKs choose how much context data to send with the context upload mode.
The default in every backend SDK is **periodic example**:

| Mode               | What it sends                                        |
| ------------------ | ---------------------------------------------------- |
| periodic example   | Context shapes plus example contexts (with values)   |
| shapes only        | Context field names and types, no values             |
| none               | No context data                                      |

Browser (JavaScript, React) and Swift SDKs send only evaluation summaries. Their
context shapes and examples are recorded server-side from the config fetch.

## When the telemetry endpoint is slow or down

Every SDK follows the same delivery rules. The numbers below are the backend
defaults; the [defaults table](#defaults) has the browser and Swift values.

- **One request at a time.** The SDK sends one POST per flush interval (60s)
  and never has more than one in flight. If the previous POST is still out when
  the next tick fires, that tick is skipped and its data rolls into the next
  window, so memory tracks the number of distinct flags and contexts, not your
  traffic.
- **Timeout.** Each POST gets 15s end to end. SDKs whose HTTP client supports a
  separate connect deadline also bound TCP connect and TLS at 5s. In Python the
  15s bounds each socket read rather than the whole request, so a server that
  never answers is abandoned at 15s.
- **Failed batches are kept and resent exactly.** On a timeout, network error,
  408, 429 or 5xx, the SDK keeps the serialized batch byte-for-byte and resends
  it unchanged later. It never merges a kept batch with newer data, so if the
  first attempt actually landed, the server recognizes the resend as a duplicate
  and counts it once.
- **Resends wait.** The SDK resends no sooner than 30s after a failure, and not
  before a `Retry-After` the server sent has elapsed (honored up to 10 minutes).
  There is no immediate retry and no exponential backoff. When it is allowed to
  send, it drains kept batches oldest first, then the current window, stopping
  at the first failure.
- **Bounded retention.** The SDK keeps at most 5 batches and 2MB (512KB in the
  browser and on iOS). When a new batch would exceed either cap, the oldest is
  dropped. A batch older than 5 minutes is discarded. A single batch larger than
  the byte cap is sent once and never kept.
- **Bounded aggregation.** Each window holds at most 10,000 evaluation-summary
  keys, 10,000 context-shape fields and 10,000 example contexts. Past a cap, new
  keys are not recorded; keys already in the window keep counting.
- **Wrong key or URL stops telemetry.** A 401, 403 or 404 means the SDK key or
  telemetry URL is wrong and will not fix itself. The SDK logs one error, drops
  its kept batches, and disables telemetry for the rest of the process. Flag
  evaluation is unaffected.
- **Rejected payload drops one batch.** Any other 4xx (400, 413, 422) drops
  that one batch, and telemetry continues on the next tick.

So a short telemetry outage costs nothing: batches wait, then land once. A long
one (past 5 batches or 5 minutes) loses the oldest telemetry, and only
telemetry.

## What the SDK logs

Telemetry is quiet unless data is actually lost or the state changes.

| Event                                              | Level | How often                                     |
| -------------------------------------------------- | ----- | --------------------------------------------- |
| A POST fails (timeout, network error, 408, 429, 5xx) | DEBUG | Every failure                                 |
| First batch dropped (cap, age or oversize)         | WARN  | Once, with the last POST result and queue depth |
| Further drops while the outage continues           | DEBUG | Plus one summary WARN at most every 10 minutes |
| First successful POST after failures               | INFO  | Once per outage                               |
| 401, 403 or 404                                    | ERROR | Once, then silence (telemetry is off)         |
| Other 4xx (batch rejected and dropped)             | ERROR | At most every 10 minutes, with a count of rejects since the last one; DEBUG in between |

A timeout whose batch is later resent successfully never logs above DEBUG. If
you see a telemetry WARN, telemetry data was dropped; flag evaluation was not
affected. Each SDK logs through its usual logger; the SDK pages say which one
and how to see DEBUG lines.

## Shutdown

Closing a backend client (`close()`, `Close()`, `stop`, `CloseAsync()`,
depending on the SDK) sends the current window once with a 5s deadline. It does
not resend kept batches from an earlier failure, and it never blocks your
process from exiting longer than that deadline. In short-lived processes such
as serverless handlers, send telemetry before returning: Node, Python and Java
have `flush()`; in Go, Ruby and .NET, close the client (`Close()`, `stop`,
`CloseAsync()`). After a failure, `flush()` still respects the 30s wait and any
`Retry-After`.

- **Browser:** `close()` and `pagehide` send the current window once with a
  `keepalive` fetch and a 2s deadline (or `telemetryTimeoutMs`, if that is
  lower). `pagehide` does not block unload.
- **iOS and macOS:** when the app goes to the background, the Swift SDK writes
  the current window to disk and POSTs it once inside a background task of
  about 5s. `shutdown()` does the same final POST with the same 5s bound, but
  not inside a background task. The POST is skipped if another POST is still in
  flight or the 30s wait or a `Retry-After` has not elapsed; the window stays on
  disk and is sent on the next foreground tick or launch. Older queued batches
  also wait for the next foreground tick.

## Defaults

| Setting                       | Backend (Node, Go, Python, Ruby, Java, .NET) | Browser (JavaScript, React)  | Swift                       |
| ----------------------------- | -------------------------------------------- | ---------------------------- | --------------------------- |
| Flush interval                | 60s                                          | 30s                          | 60s                         |
| Request timeout               | 15s                                          | 10s                          | 15s (foreground)            |
| Connect/TLS timeout           | 5s where the HTTP client supports it         | covered by the 10s timeout   | covered by the 15s timeout  |
| Wait after a failure          | 30s                                          | 30s                          | 30s                         |
| `Retry-After` honored up to   | 10 min                                       | 10 min                       | 10 min                      |
| Kept batches                  | 5 batches / 2MB, in memory                   | 5 batches / 512KB, in memory | 5 batches / 512KB, on disk  |
| Kept batch max age            | 5 min                                        | 5 min                        | 5 min                       |
| Evaluation-summary keys       | 10,000 per window                            | 10,000 per window            | 100,000 per window          |
| Context-shape fields          | 10,000 per window                            | server-side                  | server-side                 |
| Example contexts              | 10,000 per window                            | server-side                  | server-side                 |
| Final flush on shutdown       | 5s                                           | 2s (`pagehide` keepalive)    | about 5s (background task)  |
| Context upload mode           | periodic example                             | server-side                  | server-side                 |

The Swift SDK's disk queue survives an app relaunch, so a batch that was in
flight when the app was suspended is resent on the next launch, still subject to
the 5 minute age limit.

Option names and the versions that introduced these defaults:

- [Node](../../sdks/node/node.md#telemetry) (`@quonfig/node` 1.3.0+)
- [Go](../../sdks/go.md#telemetry) (v1.3.0+; v1.4.0+ for the once-per-hour
  example-context limit)
- [Python](../../sdks/python/python.md#telemetry) (`quonfig` 1.5.0+)
- [Ruby](../../sdks/ruby.md#telemetry) (`quonfig` gem 1.5.0+)
- [Java](../../sdks/java.md#telemetry) (`com.quonfig:sdk-java` 1.3.0+)
- [.NET](../../sdks/dotnet.md#telemetry) (`Quonfig.Sdk` 1.3.0+)
- [JavaScript](../../sdks/javascript.md#telemetry) and [React](../../sdks/react.md#telemetry) (1.3.0+)
- [Swift](../../sdks/swift.md#telemetry--privacy) (v0.1.0+)

## Why it works this way

- **Resend the same bytes, never merge.** The telemetry service deduplicates on
  a hash of the payload, so an identical resend of a batch that already landed
  is dropped server-side. A merged batch would be a new payload and double
  count. This is also why there is no client-side dedup ID.
- **15s, not shorter.** A healthy POST takes 1 to 3 seconds. A short timeout
  gives up on requests the server would have finished, and an aborted request
  can still land, which is exactly what verbatim resends make safe.
- **Drop rather than grow.** An SDK must never become a memory problem for your
  process because the telemetry service is having a bad day. Every buffer has a
  count, byte and age cap, and hitting one drops telemetry, never anything else.
