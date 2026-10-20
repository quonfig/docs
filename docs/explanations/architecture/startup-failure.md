---
title: If Quonfig Is Unreachable at Startup
sidebar_label: Startup Failure
sidebar_position: 1.5
---

:::info Applies to the next release of each SDK
This page describes how the **next release** of every Quonfig SDK behaves at
startup. The version for each SDK is listed under
[Option names by SDK](#option-names-by-sdk) (versions TBD until each one
ships). Older SDK versions behave differently; see your SDK's page for its
current behavior.
:::

Once a Quonfig SDK has loaded your configuration, it keeps working from memory
whether or not it can reach us (see [Reliability](./resiliency.md)). This page
covers the one moment when that isn't true: **a new process starting up while
it can't reach Quonfig at all.**

That situation is rare. To hit it, both of our delivery legs, running on
separate infrastructure, have to be unreachable from your process at the same
time. But "rare" isn't "never": a bad network policy, a DNS outage inside
your cluster, or a revoked SDK key all look the same to a booting process. So
it's worth deciding ahead of time what you want to happen.

## Our position: a server shouldn't quietly run on different config

Many feature-flag SDKs, including LaunchDarkly and Statsig, take the opposite
default: if they can't reach their servers, they return the default values
hard-coded at each call site and let your app carry on.

On a phone or in a browser that can be a reasonable choice, and every
Quonfig SDK lets you make it (see [below](#browsers-and-mobile-apps)). **We
don't think it should be the default.** A server that boots on in-code
defaults is not "degraded." It is running *different behavior* from every
other server in your fleet, and nothing about the requests it serves tells
you so:

- The flag that disabled a risky code path on every other node is off on this
  one.
- The rate limit, the pricing rule, the allow-list, or the kill switch you set
  in Quonfig is replaced by whatever value the developer typed into the code
  months ago.
- Your load balancer sends it a normal share of traffic, because it's healthy.

### A cautionary tale: Knight Capital, August 1, 2012

Knight Capital's incident was **not** a config-service outage. It was a
deployment mistake combined with a reused flag. We tell it here because its
shape is exactly what fail-open defaults can produce: one server out of a
fleet silently running different behavior from the rest.

According to the SEC's order ([Release No. 34-70694, October 16,
2013](https://www.sec.gov/litigation/admin/2013/34-70694.pdf)):

- Knight was rolling out new code to its order router, SMARS. A technician
  did not copy the new code to **one of the eight** SMARS servers, and no
  second person reviewed the deployment.
- The new code **repurposed a flag** that, years earlier, had switched on an
  old feature called "Power Peg." Knight had stopped using Power Peg in 2003,
  but the code was still on the servers.
- On August 1, seven servers handled orders carrying that flag correctly. On
  the eighth, the same flag switched on the dormant Power Peg code.
- In roughly **45 minutes**, that server turned 212 customer orders into
  millions of child orders: **over 4 million executions in 154 stocks**, more
  than 397 million shares. Knight lost **over $460 million**.
- Knight's systems had sent 97 automated emails flagging a "Power Peg
  disabled" error before the market opened. They weren't acted on in time.
- The SEC fined Knight $12 million for inadequate risk controls.

The lesson we take isn't "flags are dangerous." It's that **one node quietly
disagreeing with the rest of the fleet is one of the most expensive failures
there is**, because every other signal says things are fine. Note too that
warnings existed and weren't enough. A log line is easy to miss; a process
that refuses to start is not.

An SDK that boots on in-code defaults when it can't load configuration
creates that situation on purpose. So by default, Quonfig's SDKs don't.

## What happens at startup

When an SDK starts, it needs your configuration before it can answer
correctly. Here's what it does:

1. **It asks the primary delivery service.** If the primary hasn't answered
   within 2 seconds (the hedge delay) it also asks the **secondary**, a
   separate copy of the delivery service on completely separate
   infrastructure, and takes whichever answers first. Each leg of that
   attempt is abandoned after 6 seconds. If the primary is down, the
   secondary serves you. See
   [Automatic failover](./resiliency.md#automatic-failover-to-the-secondary).
2. **It retries through blips.** If both legs fail, it backs off (0.5s, 1s,
   2s, and so on, with jitter, capped at 30s) and tries again, until
   `initTimeout` runs out: **10 seconds** in server SDKs, **5 seconds** in
   browser and mobile SDKs.
3. **It logs as it goes,** so you can see which leg failed and why
   (connection refused, DNS, timeout, 401 for a bad key). A healthy boot logs
   nothing above DEBUG. The first failed attempt logs a WARN, and every line
   starts with `[quonfig]` and names the hosts, never your SDK key.
4. **If `initTimeout` passes without configuration, it does what you told it
   to,** with `onInitFailure`.

Almost every boot finishes at step 1, in well under a second. Your init call
returns as soon as the first configuration lands.

**A rejected SDK key fails fast.** If every delivery leg answers `401` or
`403`, the key is wrong for this environment, and waiting won't fix it.
Under `fail` the SDK fails at once instead of waiting out `initTimeout`;
under `continue` it continues at once. Under `wait` it logs an ERROR and keeps
retrying, in case the key is provisioned late.

### The three choices

| `onInitFailure` | What your app sees | Use it when |
|---|---|---|
| `fail` (default) | Initialization fails: the init call throws, rejects, or returns an error. Your process exits, and your orchestrator restarts it. | A wrong answer is worse than no answer. |
| `wait` | Initialization keeps blocking and retrying with no deadline. The SDK logs a WARN at `initTimeout` and every 30 seconds after that. | The process must eventually start, and nothing is waiting on it right now. |
| `continue` | Initialization returns. Getters return the defaults in your code. An ERROR is logged saying this instance may disagree with the rest of your fleet. Once configuration arrives, the SDK switches over. | The in-code defaults are genuinely safe, and staying up matters more than being consistent. |

**A failed start is never silently permanent.** Under `wait` and `continue`,
the SDK keeps retrying and switches to your configuration as soon as either
delivery leg is reachable, logging one `init recovered` line when it does.
Under `fail`:

- In Go, Ruby and Swift, no client is returned (`NewClient` returns an error,
  or the constructor raises or throws), so your process exits and your
  orchestrator's restart is the retry.
- In Node, Python, .NET, Java and the browser SDKs, a client object survives
  the error. If you catch the error and keep that client, it keeps retrying in
  the background and becomes ready once configuration arrives. In Java the
  constructor throws, and `e.client()` on the exception returns that client.
  If you catch the error and don't keep the client, close it so its
  background retry stops.

Before a kept client is ready, getters return the default you passed, and
evaluation-details calls report the reason `ERROR` with the error code
`PROVIDER_NOT_READY`. Getters never block waiting for initialization; the init
call is the only gate.

### Configuring it

Every SDK uses the same three values. The spelling follows each language's
conventions; see [the table below](#option-names-by-sdk) for yours.

```typescript
// Node
import { Quonfig, QuonfigInitError } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  initTimeout: 10_000, // ms
  onInitFailure: "fail", // "fail" | "wait" | "continue"
});

await quonfig.init(); // rejects with QuonfigInitError after 10s if neither leg is reachable
```

```go
// Go
client, err := quonfig.NewClient(
    quonfig.WithInitTimeout(10*time.Second),
    quonfig.WithOnInitFailure(quonfig.InitFailureFail),
)
if err != nil {
    log.Fatalf("quonfig: %v", err) // *quonfig.InitError; the orchestrator restarts us
}
```

## Option names by SDK

| SDK | Option | Values (default first) | Deprecated spellings (still accepted) | `initTimeout` (default) | Release |
|---|---|---|---|---|---|
| Go | `WithOnInitFailure(...)` | `quonfig.InitFailureFail`, `InitFailureWait`, `InitFailureContinue` | `ReturnError` (= fail), `ReturnZeroValue` (= continue); one-time WARN | `WithInitTimeout`, 10s | next minor (version TBD) |
| Node | `onInitFailure` | `"fail"`, `"wait"`, `"continue"` | none | `initTimeout`, 10000 ms | next minor (version TBD) |
| Python | `on_init_failure=` | `"fail"`, `"wait"`, `"continue"` | `"raise"` (= fail), `"return"` and `"return_zero_value"` (= continue); one-time WARN | `init_timeout_ms=`, 10000 | 2.0.0 (date TBD) |
| Ruby | `on_init_failure:` | `:fail`, `:wait`, `:continue` | `:raise` (= fail), `:return` (= continue); one-time WARN | `init_timeout_ms:`, 10_000 | next minor (version TBD) |
| .NET | `OnInitFailure` | `OnInitFailure.Fail`, `Wait`, `Continue` | `Throw` (= Fail), `ReturnDefaults` (= Continue); marked `[Obsolete]` | `InitTimeout`, 10s | next minor (version TBD) |
| Java | `Options.builder().onInitFailure(...)` | `OnInitFailure.FAIL`, `WAIT`, `CONTINUE` | none | `initTimeout(Duration)`, 10s | 2.0.0 (date TBD) |
| JavaScript (browser) | `onInitFailure` | `"fail"`, `"wait"`, `"continue"` | none | `initTimeout`, 5000 ms | next minor (version TBD) |
| React | `QuonfigProvider` props `onInitFailure` | `"fail"`, `"wait"`, `"continue"` | none | `initTimeout`, 5000 ms | next minor (version TBD) |
| React Native | same as React | same as React | none | same as React | through `@quonfig/react` (version TBD) |
| Swift | `initialize(..., onInitFailure:)` | `.fail`, `.wait`, `` .`continue` `` | none (`.continueWithDefaults` is a synonym for `` .`continue` ``) | `initTimeout:`, 5s | next minor (version TBD) |

What the error looks like under `fail`, and how to check readiness:

| SDK | Under `fail` | Ready query | Wait for ready |
|---|---|---|---|
| Go | `NewClient` returns `(nil, *quonfig.InitError)` | `client.Ready()` | `client.WaitForReady(ctx)` |
| Node | `await quonfig.init()` rejects with `QuonfigInitError` | `quonfig.isReady()` | `await quonfig.waitForReady({ timeoutMs })` |
| Python | `client.init()` raises `QuonfigInitError` (`QuonfigInitTimeoutError` when no leg answered) | `client.is_ready()` | `client.wait_for_ready(timeout_ms=...)` |
| Ruby | `Quonfig::Client.new` raises `Quonfig::Errors::InitializationError` (`InitializationTimeoutError` when an attempt hung) | `client.ready?` | `client.wait_for_ready(timeout_ms: ...)` |
| .NET | `await quonfig.InitAsync()` throws `QuonfigInitException` (`QuonfigInitTimeoutException` when the legs hung) | `quonfig.IsReady` | `await quonfig.WaitForReadyAsync(token)` |
| Java | `new Quonfig(options)` throws `QuonfigInitException` (`QuonfigInitTimeoutException` when the legs hung); `e.client()` returns the still-retrying client | `quonfig.isReady()` | `quonfig.awaitReady(Duration)` |
| JavaScript | `await quonfig.init(...)` rejects with `QuonfigInitError`, unless a cached copy exists | `quonfig.isReady()` | the `init()` promise |
| React / React Native | `onError` fires; `useQuonfig()` returns `error` | `useQuonfig().isReady` | n/a (the hooks re-render on heal) |
| Swift | `try await Quonfig.initialize(...)` throws `QuonfigInitError`, unless a disk cache exists | `quonfig.isReady` | `await quonfig.waitForReady()` |

Every error carries a reason: `timeout` (the delivery legs hung until
`initTimeout`), `unavailable` (they answered with errors, for example
connection refused), or `unauthorized` (every leg rejected the SDK key).

## `fail` and rolling deploys

`fail` sounds drastic, but in a normal deploy it's the gentlest option:

- **Rolling deploy.** New instances fail to start, so they never pass their
  health checks, so the deploy stalls. **Your old instances keep serving,**
  with the configuration they already have in memory. Nothing changes for
  your users. When Quonfig is reachable again, the next restart succeeds and
  the deploy continues.
- **Autoscaling or a replaced node.** The new instance fails and is retried
  by your orchestrator (Kubernetes, ECS, Fly, systemd) with its usual backoff.
  You run at reduced capacity for the duration, rather than adding capacity
  that behaves differently.
- **A cold start of the whole fleet** (for example, every instance restarted at
  once) is the case where `fail` costs you availability. If that's a real risk
  for a service, read the next section.

## You have to think about failure

There is no default that's right for every service. These questions help:

1. **What happens if this service runs on in-code defaults for an hour?** If
   the honest answer is "it charges the wrong price," "it skips a risk check,"
   or "it ignores a kill switch," choose `fail`.
2. **Is anyone waiting on this process right now?** A background worker can
   sit and wait; a web server behind a load balancer usually shouldn't.
3. **Are your in-code defaults actually maintained?** Defaults written when a
   flag was created are often stale by the time anyone relies on them.
4. **Can your whole fleet restart at once?** If yes, decide whether you prefer
   "down until Quonfig is reachable" or "up on defaults" for that service.

| Kind of service | Suggested `onInitFailure` | Why |
|---|---|---|
| Payments, trading, pricing, fraud and risk checks, auth and permissions | `fail` | A wrong answer costs more than a missing instance. |
| Request-serving web and API services (general) | `fail` | Rolling deploys and orchestrators make a failed start safe and visible. |
| Long-running queue workers, consumers, schedulers | `wait` | They must start eventually; a few minutes late is fine; running wrong isn't. |
| Non-critical services whose defaults are safe (internal tools, recommendation widgets, cosmetic flags) | `continue` | Staying up matters more than matching the fleet exactly. |
| Batch jobs and cron tasks | `fail`, or `wait` with an outer job timeout | A failed run is retried by the scheduler; a run on defaults may write wrong data. |
| AWS Lambda and other serverless functions | `fail` (usually) | A failed cold start fails one invocation, which is retried; consider `continue` only if every flag read has a safe default. Keep `initTimeout` well under your function timeout. |

### Health checks and readiness probes

- **Readiness: gate on initialization, not on the connection.** A process that
  hasn't loaded configuration (under `wait`, or `continue` before the first
  load) should report *not ready*, so it gets no traffic. Wire your readiness
  probe to your SDK's ready query (see [the table above](#option-names-by-sdk)).
- **Liveness: don't tie it to Quonfig.** Once initialized, the SDK works from
  memory through any outage. Restarting a healthy, initialized process because
  its stream dropped throws away good configuration and replaces it with a
  boot that may not succeed. (The [.NET page](/docs/sdks/dotnet) has the
  same warning.)
- **Under `wait`, set your startup probe generously,** or your orchestrator
  will restart a waiting process, which turns `wait` into `fail` with extra
  steps.

## Browsers and mobile apps

Client SDKs (JavaScript, React, React Native, Swift) default to `fail` too.
The same question applies: what happens if this app runs on the defaults in
your code? For many apps, `continue` is the better choice. A browser tab's
network is the end user's (a subway tunnel, airplane mode, a captive
portal), and there's no fleet for one device to disagree with. If your
defaults would show the wrong price or unlock the wrong feature, keep
`fail` and show an error or loading state instead.

**A cached copy counts as configuration.** Where the platform has storage,
a client SDK keeps the last configuration it received for this user: the
browser SDK (and React on top of it) in `localStorage`, Swift on disk. A
server-rendered bootstrap counts too. If the SDK can't reach us at startup,
it starts on that copy, marked as stale, in every mode. `fail` (or
`continue`) only applies when there's no configuration at all, fresh or
cached. React Native has no `localStorage`, so there is no cached copy there
and a cold start with no network goes straight to `onInitFailure`.

With `continue` and no cached copy, getters return the defaults in your
code. In every case the SDK keeps retrying in the background and switches
to live values as soon as it can reach us. Use the SDK's ready signal
(`isReady`, and in React and Swift also `source`: network, cache or defaults)
if you want to show a loading state.

## Summary

- A running SDK never needs Quonfig to answer a flag; this page is only about
  starting up.
- At startup the SDK tries both delivery legs and retries through blips for
  `initTimeout` (10s on servers, 5s on clients), logging as it goes.
- Then it does what `onInitFailure` says: `fail` (the default in every SDK),
  `wait`, or `continue`. A cached copy on a device counts as configuration.
- Under `wait` and `continue` it keeps retrying and recovers on its own;
  under `fail` your orchestrator's restart (or a kept client) does.
- Pick per service. If running on defaults would be wrong, let it fail.
