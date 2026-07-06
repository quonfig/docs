---
title: Swift
---

The native **Apple-platform** SDK (iOS 15+, macOS 12+) — module `Quonfig`,
Swift-only, Swift Concurrency throughout, zero external dependencies.

Like the [JavaScript] and [React] clients it is a **frontend** SDK: it fetches
the server-evaluated config for a context, caches it, polls for updates with
`ETag`/`304`, and reads typed values synchronously. Evaluation happens
server-side in Quonfig — there is no on-device targeting engine.

## Install

Distributed via **Swift Package Manager**. In Xcode: **File → Add Package
Dependencies…** and enter `https://github.com/quonfig/sdk-swift.git`, or add it
to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/quonfig/sdk-swift.git", from: "0.0.1"),
],
targets: [
    .target(
        name: "YourApp",
        dependencies: [
            .product(name: "Quonfig", package: "sdk-swift"),
        ]
    ),
]
```

Then `import Quonfig`.

## Initialize the client

Initialize with your **frontend** SDK key (the same key type the JavaScript /
React SDKs use — never embed a backend key in a mobile binary, it's extractable):

```swift
import Quonfig

let quonfig = try await Quonfig.initialize(
    context: QuonfigContext([
        "user": ["key": .string("u_123"), "email": .string("a@example.com")],
        "device": ["mobile": .bool(true)],
    ]),
    options: .init(
        sdkKey: "YOUR_FRONTEND_SDK_KEY",
        domain: "quonfig.com"           // one knob for api + telemetry hosts
    )
)
```

`initialize` is `async throws` and **resolves once the first envelope is
available** — from the network, or, after a bounded `initTimeout` (default 5s),
from the cold-start cache or empty defaults. A hung network never hangs your UI.

:::tip
While the store is warming (before the first envelope), `isEnabled` returns
`false`, the typed getters return your supplied default, and `shouldLog` logs
everything.
:::

## Read flags & configs

Reads are **synchronous and never block** — they serve from an in-memory
snapshot. An absent key (or a not-yet-ready store) returns your default.

```swift
let on     = quonfig.isEnabled("new-checkout")                // Bool
let color  = quonfig.string("button-color", default: "blue")  // String
let limit  = quonfig.int("rate-limit", default: 100)          // Int
let ratio  = quonfig.double("sample-ratio", default: 0.1)     // Double
let pricing = quonfig.json("pricing")                         // [String: Any]?

// Full resolution details (value + reason + variant), for experiments/telemetry.
let details = quonfig.details("checkout-experiment")
```

Configs (non-flag values) are read the same way. By default configs are **not**
sent to client SDKs — enable "Send to client SDKs" on each config you want a
frontend SDK to read. Feature flags are always sent.

## Context & `updateContext`

The context is a plain multi-namespace object. To switch identity (e.g. after a
sign-in), call `updateContext` — it immediately refetches the evaluated envelope
for the new context and keeps polling with it:

```swift
try await quonfig.updateContext(
    QuonfigContext(["user": ["key": .string("u_456"), "email": .string("b@example.com")]])
)
```

## React to live updates

The SDK **polls** (default 60s foreground) with `ETag`/`If-None-Match`, so an
unchanged flag set is a cheap `304`. It refetches immediately on app foreground
and on `updateContext`, and suspends polling in the background.

Subscribe to be notified after every *change* (diff-before-notify, so unchanged
polls don't churn) — SwiftUI-friendly:

```swift
let token = await quonfig.subscribe {
    // re-read flags here and update your UI
}
// Hold the token; dropping it unsubscribes.
```

## Dynamic log levels

Drive a logger's minimum level from a Quonfig `log_level` config, so you can
raise or lower verbosity from the dashboard **without a redeploy**. `QuonfigLogger`
is built on Apple's unified logging (`os.Logger`):

```swift
let log = QuonfigLogger(quonfig: quonfig, loggerKey: "log-level.my-app")

log.trace("entering render")
log.debug("cache warm: \(count) entries")   // suppressed unless level <= DEBUG
log.info("signed in as \(userID)")
log.warn("retrying after \(err)")
log.error("checkout failed: \(err)")
```

The severity ladder is `TRACE < DEBUG < INFO < WARN < ERROR < FATAL` (the same
ranks every Quonfig SDK uses). A record emits iff its level is **at or above** the
configured threshold — a `log_level` config of `WARN` emits `WARN`/`ERROR`/`FATAL`
and drops the rest. The gate is re-checked on every call, so flipping the config
takes effect on the next log line. Message arguments are autoclosures, so a
suppressed record never builds its string.

Just want the decision (to gate your own logging framework)?

```swift
if quonfig.shouldLog(.debug, loggerKey: "log-level.my-app") { /* … */ }
```

Supply a `QuonfigLogSink` to bridge to another backend instead of `os.Logger`:

```swift
struct MySink: QuonfigLogSink {
    func emit(level: QuonfigLogLevel, message: String) { /* forward anywhere */ }
}
let log = QuonfigLogger(quonfig: quonfig, loggerKey: "log-level.my-app", sink: MySink())
```

:::info Client-side limitation
Quonfig evaluates server-side, so a frontend SDK gates against the single
threshold the server resolved for its **current context**. Per-logger overrides
(the backend SDKs' per-`quonfig-sdk-logging.key` routing) require on-device
evaluation and aren't available here — one `log_level` config drives one
threshold for the whole client. Best for application-wide log-level control, or
rules that key on stable context (user, app version, environment). Call
`updateContext` to re-evaluate after a context change.
:::

## Exposure-decoupled reads

Every getter has a `logExposure:` variant so debug screens / pre-render probes
can read a flag without it counting as an exposure for telemetry:

```swift
let v = quonfig.isEnabled("new-checkout", logExposure: false)
```

## Offline & server-side evaluation

Because Quonfig evaluates entirely server-side:

- **Cold start / offline for a previously-seen context** works — the cached
  envelope is served instantly (no flicker), and also on a failed poll, so the
  last known-good values stay on screen.
- **Offline with a _new_ context** can't be evaluated on-device; the SDK serves
  the cached envelope for a previously-seen context, or your supplied defaults.

This is the same trade-off LaunchDarkly and Statsig make.

## Telemetry & privacy

By default the SDK uploads per-flag evaluation summaries (opt out with
`collectEvaluationSummaries: false`). Context shapes/examples are captured
server-side; tune with `collectContextMode` (`PERIODIC_EXAMPLE` default,
`SHAPE_ONLY`, or `NONE`).

The SDK ships an App Store `PrivacyInfo.xcprivacy` (wired into the SPM package
resources), and disables the eval request's `URLCache` so the context-bearing
eval URL is never written to an on-device cache.

## Teardown

```swift
await quonfig.shutdown()   // stops polling + telemetry, flushing one last window
```

## Reference

### `Quonfig` methods

| method | purpose |
| --- | --- |
| `Quonfig.initialize(context:options:initTimeout:)` | create a client; resolves once the first envelope (network or cache) is available |
| `isEnabled(_:logExposure:)` | `Bool` (default `false`) for a flag in the current context |
| `string(_:default:)` / `int(_:default:)` / `double(_:default:)` | typed value or your default |
| `json(_:)` | `[String: Any]?` for an object config |
| `details(_:)` | full resolution details (value + reason + variant) |
| `subscribe(_:)` | run a closure after every change; returns a cancellation token |
| `updateContext(_:)` | switch identity and refetch |
| `shouldLog(_:loggerKey:)` | whether a record at a level should emit under a `log_level` config |
| `logLevelThreshold(for:)` | the resolved `QuonfigLogLevel` for a `log_level` config, or `nil` |
| `shutdown()` | stop polling + telemetry (drains one last window) |
| `context` / `isReady` | current context; whether an envelope has been applied |

### `Configuration` options

| option | type | default | description |
| --- | --- | --- | --- |
| `sdkKey` | `String` | required | your frontend SDK key |
| `domain` | `String` | `"quonfig.com"` | single knob flipping api + telemetry hosts in lockstep |
| `apiURLs` | `[URL]?` | derived from `domain` | explicit API base URLs (failover order); wins over `domain` |
| `telemetryURL` | `URL?` | derived from `domain` | explicit telemetry base URL; wins over `domain` |
| `pollInterval` | `TimeInterval` | `60` | foreground poll interval; `0` disables polling |
| `collectEvaluationSummaries` | `Bool` | `true` | upload per-flag evaluation summaries |
| `collectContextMode` | `CollectContextMode` | `.periodicExample` | `.periodicExample`, `.shapeOnly`, or `.none` |
| `requestTimeout` / `resourceTimeout` | `TimeInterval?` | `nil` | per-request / resource timeouts |
| `customHeaders` | `@Sendable () -> [String: String]` | `{}` | headers recomputed per request (e.g. rotating proxy tokens) |

[JavaScript]: /docs/sdks/javascript
[React]: /docs/sdks/react
