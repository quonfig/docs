---
title: Serve a Datadir to Browser SDKs (`qfg serve`)
sidebar_label: Serve to Browser SDKs (qfg serve)
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

Server-side SDKs (Node, Go, Ruby, Python, Java and .NET) can read a
[datadir](/docs/how-tos/open-source-local) directly from the filesystem.
Client SDKs (browser JavaScript, React, React Native and Swift) don't read
a datadir, so they can't consume the same checked-in workspace on their own.

`qfg serve` is the bridge. It reads a datadir on disk and exposes it over
the same HTTP wire protocol the browser SDKs already speak to
the delivery API in production. Point your SDK at `http://localhost:6580`
and the existing client code works unmodified.

## 5-minute setup

### 1. Start the server

```bash
qfg serve --datadir ./our-config --environment development
```

You should see:

```
qfg serve listening on http://127.0.0.1:6580
  datadir:     /abs/path/to/our-config
  environment: development
  auth:        none (datadir served openly)
```

Defaults you can override: `--port 6580`, `--host 127.0.0.1`,
`--environment development` (or `QUONFIG_ENVIRONMENT`), and `--datadir`.
Without `--datadir`, `qfg serve` uses `QUONFIG_DIR` if it is set, then
`./our-config`, then `./.quonfig` in the current directory. `--watch` is on
by default — edits to the datadir are picked up automatically.

### 2. Point your browser SDK at it

The browser SDKs accept `apiUrls` as an init option — that's the only
change needed. Telemetry is **not** served by `qfg serve` (see
[What's not in v1](#whats-not-in-v1)), so turn it off in the SDK init:

<Tabs groupId="frontend">
<TabItem value="javascript" label="JavaScript">

```ts
import { quonfig } from "@quonfig/javascript";

await quonfig.init({
  sdkKey: "PUBLIC_FRONTEND_KEY", // any string is fine if qfg serve has no --frontend-sdk-key
  context: { user: { key: "alice@example.com" } },
  apiUrls: ["http://localhost:6580"],

  // qfg serve does not accept telemetry; turn off evaluation summaries to avoid 404s in the console
  collectEvaluationSummaries: false,
});
```

</TabItem>
<TabItem value="react" label="React">

```tsx
import { QuonfigProvider } from "@quonfig/react";

<QuonfigProvider
  sdkKey="PUBLIC_FRONTEND_KEY"
  contextAttributes={{ user: { key: "alice@example.com" } }}
  apiUrls={["http://localhost:6580"]}
  collectEvaluationSummaries={false}
>
  <App />
</QuonfigProvider>;
```

</TabItem>
<TabItem value="react-native" label="React Native">

```tsx
import { QuonfigProvider } from "@quonfig/react-native";

<QuonfigProvider
  sdkKey="PUBLIC_FRONTEND_KEY"
  contextAttributes={{ user: { key: "alice@example.com" } }}
  apiUrls={["http://localhost:6580"]}
  collectEvaluationSummaries={false}
>
  <App />
</QuonfigProvider>;
```

</TabItem>
</Tabs>

### 3. Verify the loop

Edit a flag value in `our-config/feature-flags/<name>.json`, save, and
reload your frontend. The new value shows up on the next SDK poll. No
restart of `qfg serve` needed — the datadir watcher swaps the new
envelope in atomically.

## Authentication

`--frontend-sdk-key <key>` is optional. The frontend SDK key is a
**publicly-available secret** by design — it ships in browser JS and
anyone with devtools can read it. So the auth check isn't a security
boundary; it's a misconfiguration tripwire that catches "I forgot to set
the key on the frontend" mistakes locally instead of in prod.

- **With `--frontend-sdk-key`** — every request must present
  `Authorization: Basic base64("1:<key>")`. Anything else returns `401`.
- **Without `--frontend-sdk-key`** — no auth check is performed. Useful
  for quick local poking.

In both modes, the [`sendToClientSdk` filter](#what-gets-served) is
applied unconditionally.

## What gets served

`qfg serve` is a **frontend-only** endpoint. Two rules, regardless of
auth:

1. **Feature flags are always served.**
2. **Configs are served only when their JSON has `"sendToClientSdk": true`.**
   Regular server-side configs are filtered out at the evaluator
   boundary, always. There is no flag to disable this filter.

If you need a regular config in a backend process, use `@quonfig/node`
(or any server SDK) in datadir mode directly — that's the supported path
for server-side reads. `qfg serve` is the browser-side equivalent.

## CORS

The browser SDKs send an `Authorization` header, so browsers
[preflight](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
cross-origin requests. `qfg serve` answers `OPTIONS` with `204` and allows
the `Authorization` and `Content-Type` headers. It defaults
`Access-Control-Allow-Origin` to `*`, matching the delivery API in
production.

`--cors-origin` controls that header, in one of three modes:

- **`*`** (the default, or `*` anywhere in the list) — always sends
  `Access-Control-Allow-Origin: *`.
- **One origin** — always sends that origin, whatever the request's
  `Origin` is.
- **Two or more origins** — echoes the request's `Origin` when it is in the
  list and sends `Vary: Origin`. Requests from other origins still get a
  response, but with `Access-Control-Allow-Origin` omitted, so the browser
  blocks them.

If you bind to a non-loopback host with `--allow-non-loopback`, setting
`--cors-origin` is recommended (it isn't required — without it the server
stays on `*`):

```bash
qfg serve \
  --host 0.0.0.0 \
  --allow-non-loopback \
  --cors-origin https://dev.example.test \
  --cors-origin https://dev2.example.test
```

## Production positioning

`qfg serve` is **primarily for local development**. Running it in
production for frontend SDK clients is supported as a free-tier deploy
option (point browser clients at a `qfg serve` instance running next to
your app server, backed by a checked-in datadir), but **there is no
Quonfig-side SLO, observability, or scale story** behind it.

If you need any of:

- SLO-backed real-time delivery (SSE)
- Evaluation telemetry / audit history
- Multi-region scaling
- A UI for non-engineers to flip flags

…use a hosted Quonfig account or the delivery API. See
[Open Source / Fully Local](/docs/how-tos/open-source-local) for the
broader local story and [Offline Mode](/docs/how-tos/offline-mode) for
running without a network connection.

## What's not in v1

`qfg serve` v1 ships the smallest surface that closes the
browser-SDK-can't-read-a-datadir gap:

- **No SSE.** Browser SDKs poll over HTTP; no streaming endpoint is
  needed. Server-side SDKs that *do* use SSE already have native datadir
  mode.
- **No telemetry.** `POST /api/v1/telemetry/` returns `404`. The SDK init
  snippets above disable client-side telemetry collection. To send local
  sessions to Quonfig instead, point `telemetryUrl` at
  `https://telemetry.quonfig.com`. That needs a real frontend SDK key for
  your workspace (not a placeholder) and `collectEvaluationSummaries` left on.
- **No TLS.** Browsers carve `http://localhost:*` out of mixed-content
  rules, so HTTP is fine for local dev. For non-localhost HTTPS frontends,
  terminate TLS at a reverse proxy.
- **No bundled Quonfig web UI.** Edit JSON files directly, then `qfg verify`.

If you hit a real production use case that needs any of these, let us
know — `qfg serve` is designed to be small now and grow only when the ask
is concrete.

## Command reference

```
qfg serve [--datadir <path>] [--environment <slug>] [--port <n>]
          [--host <addr>] [--frontend-sdk-key <key>]
          [--cors-origin <url>] [--watch | --no-watch]
          [--allow-non-loopback]
```

| Flag | Default | Notes |
|------|---------|-------|
| `--datadir <path>` | `QUONFIG_DIR`, then `./our-config`, then `./.quonfig`, then error | Looks only in the current directory; it does not walk up to parent directories. |
| `--environment <slug>` | `development` | Flag wins, then `QUONFIG_ENVIRONMENT`, then `development`. |
| `--port <n>` | `6580` | Fails fast on collision — pass `--port` to retry. No auto-increment. |
| `--host <addr>` | `127.0.0.1` | Loopback only by default. |
| `--frontend-sdk-key <key>` | none | If set, every request must present `Authorization: Basic 1:<key>`. |
| `--cors-origin <url>` (repeatable) | `*` | `*`, one fixed origin, or an allow-list of two or more (see [CORS](#cors)). Recommended when binding to a non-loopback host. |
| `--watch` / `--no-watch` | `--watch` | Reload the envelope on datadir changes. |
| `--allow-non-loopback` | off | Confirm a LAN-reachable bind when `--host` is not loopback. |
