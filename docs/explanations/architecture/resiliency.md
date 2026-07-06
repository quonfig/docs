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

Enter the beauty of immutable distributed logs. They are perfectly cacheable. A
single blob of bytes can describe your entire configuration, and we can
aggressively cache it in CDNs and other services. As long as your services can
reach the Internet, they can get the latest configuration.

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
second stream herd.

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

Every backend SDK logs a one-line warning at client init when an explicit URL
override collapses the list to a single leg.
:::

<!-- There's more discussion of these bootstrapping files in [bootstrapping](/docs/explanations/architecture/bootstrapping.md). -->
