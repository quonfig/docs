---
title: Reliability
sidebar_label: Reliability
sidebar_position: 1
---

## What if Quonfig goes down?

Uptime matters a great deal to us, but configuration is critical infrastructure,
so we take a belt-and-suspenders approach.

### Backend SDK Clients run on local copies of data

First, it's important to understand that Quonfig backend SDKs store all config
locally, so they are robust to network blips or outages.

If a connection is lost for any reason, your services keep working as-is because
they keep config locally — they simply won't receive new configuration until the
connection recovers.

### Starting New Clients

Your services don't run indefinitely, though. New pods or servers spin up and
they need to pull down configuration as they boot.

A new client boots by fetching configuration from the delivery service. If the
primary delivery service is down — or merely slow — the SDK also asks the
secondary (details below), so a booting client still gets its configuration
within a few seconds during a full primary outage. Each URL attempt has its own
short timeout (3 seconds by default), so a hung primary can't consume the whole
initialization budget and starve the secondary attempt.

## Automatic failover to the secondary

Every backend SDK ships with a **primary** and a **secondary** delivery leg and
fails over between them automatically. You don't configure anything — it is on
by default.

1. **Primary** — a global delivery network running on [fly.io](https://fly.io/)
   with servers around the world.
2. **Secondary** — an identical delivery surface running on **completely
   separate infrastructure**, so an outage of the primary's platform does not
   take the secondary with it.

Two mechanisms use these legs:

- **Hedging.** On a config fetch the SDK asks the primary first. If the primary
  hasn't answered within a short hedge delay (2s by default), the SDK also asks
  the secondary in parallel and takes whichever responds first with a valid,
  not-older envelope. A slow or hung primary therefore doesn't stall your reads.
- **Failover.** If the primary is unreachable or errors, the SDK falls over to
  the secondary. An ordering guard ensures the client never regresses to older
  configuration during a failover, and the client heals forward to the primary
  once it recovers.

Live updates over SSE stay pinned to the primary's stream (`stream.primary.…`)
with retry-forever reconnect; the secondary is the fetch/failover leg, not a
second stream herd. If the stream can't be established or has been down for two
minutes, backend SDKs fall back to HTTP polling (every 60 seconds, walking the
URL list primary-first) and stop polling once the stream recovers.

### Browsers keep a last-known-good copy

The browser SDK (`@quonfig/javascript`, and the React bindings built on it)
additionally persists the last successfully fetched configuration in
`localStorage`, keyed to your SDK key and evaluation context. If every delivery
URL is unreachable — including the secondary — the SDK serves that cached
configuration instead of failing, and marks it `STALE` so your code can tell
the difference.

Returning visitors therefore keep evaluating flags even if both delivery legs
are unreachable at once. First-time visitors have no cache; if they can reach
neither leg, initialization fails and your application's defaults apply. Where
`localStorage` is unavailable (server-side rendering, some private browsing
modes), the cache is simply skipped.

## What still degrades during a full primary outage

The secondary keeps reads working, but it is a read-only standby. While the
primary platform is down:

- **No configuration changes.** The dashboard, API, and CLI run on the same
  infrastructure as the primary, so you can't create or edit flags and configs
  until it recovers. Served configuration is frozen at its last value —
  consistent, just not updatable.
- **Very recently created or rotated SDK keys may not be recognized.** The
  secondary learns about key changes on a short delay (under a minute in
  normal operation), so a key minted moments before the outage may not work
  until the primary returns. All previously issued keys keep working.
- **Telemetry ingestion pauses.** SDKs buffer telemetry in bounded memory and
  drop it rather than block your application; flag evaluation is unaffected.
- **Live updates pause.** SSE streams reconnect automatically when the primary
  returns — and since no writes can happen during the outage, there are no
  updates to miss.
- **A brand-new backend instance that can reach neither leg fails
  initialization** according to your SDK's init-failure setting (for example
  sdk-go's `OnInitFailure`, which defaults to returning an error).

## How we verify this

The failover path is exercised continuously, not just designed:

- **Chaos tests in every backend SDK's CI.** Each backend SDK runs a shared
  suite of network-fault scenarios — hung connections, dropped streams, dead
  legs, out-of-order responses — against a real delivery server, on every
  change and on a nightly schedule. The suite asserts that failover happens
  within seconds, and also asserts what must *not* happen: SSE repointing to
  the secondary, or a client regressing to older configuration.
- **Scheduled game-days.** We periodically run live failover exercises against
  the real deployed secondary — in staging and in production — pointing a real
  SDK at a deliberately dead or hung primary and verifying cold-start, hedge,
  no-regression, and heal-forward behavior end to end.
- **Production telemetry for every failover event.** SDKs report hedge fires,
  ordering-guard rejections, and which leg actually served each client, so
  failover in the wild is measured, not inferred. Independent monitors probe
  the secondary from outside both clouds and alert if it is missing any
  workspace the primary serves.

We take reliability seriously and invite you to check
[status.quonfig.com](https://status.quonfig.com) for our track record.

## How URLs derive from `QUONFIG_DOMAIN`

Rather than configure four hostnames by hand, backend SDKs derive them all from
a single `QUONFIG_DOMAIN` (default `quonfig.com`):

```
QUONFIG_DOMAIN=quonfig.com
  ->  https://primary.quonfig.com            (config fetch — primary)
  ->  https://stream.primary.quonfig.com     (SSE stream — primary)
  ->  https://secondary.quonfig.com          (config fetch — secondary / failover)
  ->  https://stream.secondary.quonfig.com   (SSE stream — secondary)
  ->  https://telemetry.quonfig.com          (telemetry ingestion)
```

Set `QUONFIG_DOMAIN` (env var) to point an SDK at a different environment — for
example `quonfig-staging.com` — and both legs plus telemetry move together. This
is the recommended way to switch environments in local development and testing.

## Custom API URLs and the failover caveat

Every SDK exposes an explicit URL override (`apiUrls` / `WithAPIURLs` /
`api_urls`, depending on language) for advanced setups such as an on-prem proxy.
This override **replaces the derived list wholesale**.

:::warning
If you pass a single URL, you lose automatic failover — the SDK has no secondary
to fall over to. To keep failover with custom URLs, **pass both a primary and a
secondary URL:**

```
apiUrls = [ "https://primary.your-proxy.example", "https://secondary.your-proxy.example" ]
```

Every SDK — backend and browser — logs a one-line warning at client init when
an explicit URL override collapses the list to a single leg.
:::

<!-- There's more discussion of these bootstrapping files in [bootstrapping](/docs/explanations/architecture/bootstrapping.md). -->
