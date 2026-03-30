---
title: Reliability
sidebar_label: Reliability
sidebar_position: 1
---

## What if Quonfig goes down?

Uptime is incredibly important to us at Launch but configuration is critical infrastructure so it is important to have a belt & suspenders approach.

### Backend SDK Clients run on local copies of data

First, it's imporant to understand that Quonfig Backend SDKs store all config locally so they are robust to network blips or outages.

If a connection is lost for any reason, your services continue to work as is because they keep config locally, but they will not be able to receive new configuration.

### Starting New Clients

Your services don't run indefinitely however. New pods or servers will spin up and they need to pull down configuration as they boot.

Enter the beauty of immutable distributed logs. They are perfectly cacheable. One single blob of bytes can describe your entire configuration and we can aggressively cache this in CDNs and other services As long as your services can still connect to the Internet your services can get the latest configuration.

### Belts & Suspenders & More Suspenders

Here's how the load order works for [Backend SDKs](/docs/explanations/concepts/backend-sdks):

1. First, the SDKs make a request to our global deliver network. This runs on [fly.io](https://fly.io/) with servers across the globe. 
2. If this fails, the SDKs make a request to the Quonfig HTTP APIs, cached by [Fast.ly](https://Fast.ly). This cache is soft purged when you make configuration updates. This system is running on completely different infrastructure from the fly.io primary.

We take the reliability of our systems very seriously and invite you to check out [status.quonfig.com](https://status.quonfig.com) to check our track record.

<!-- There's more discussion of these bootstrapping files in [bootstrapping](/docs/explanations/architecture/bootstrapping.md). -->
