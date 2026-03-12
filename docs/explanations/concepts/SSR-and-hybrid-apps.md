---
title: JavaScript SSR, CSR, Hybrid, and Statically Generated Sites
sidebar_label: JavaScript SSR & Hybrid Apps
sidebar_position: 6
---

## Quonfig 🫶 JavaScript: SSR, CSR, Hybrid, and Statically Generated Sites

Quonfig is designed to work in a variety of environments, from server-side rendering (SSR) to client-side rendering (CSR) to hybrid apps that use both.

## The relevant clients

- [Node](../../sdks/node) client: This runs on your server and provides in-memory evaluation of config and feature flags. You can provide it with user-specific context for those evaluations in your request handlers. It gets streaming updates over SSE from Quonfig. [Learn more about backend SDKs](./backend-sdks).
- [JavaScript](../../sdks/javascript) (or [React](../../sdks/react)) client: This runs in the browser and makes a single HTTP request to Quonfig with the current user's context to get the evaluated feature flags (and any config you've specified as "Send to frontend SDKs"). Once it has the flags, it can evaluate them in memory. [Learn more about frontend SDKs](./frontend-sdks).

## SSR

If you're doing pure server-side rendering, you only need the Node client.

## CSR

If you're doing pure client-side rendering, you only need the JavaScript (or React) client.

## Hybrid apps

Hybrid apps (those using SSR and CSR) will probably want _both_ the Node and JavaScript (or React) clients.

The Node client can handle in-request evaluations, and the JavaScript (or React) client can handle client-side evaluations to determine what to render.

:::tip Improve the Performance of your Hybrid Apps
Eliminate loading states and improve performance by avoiding extra HTTP requests in your front-end by using our [SSR + CSR Rehydration Guide](../../sdks/react#server-side-rendering-ssr-to-client-side-rendering-csr-rehydration) guide for client-side rehydration.
:::

## Statically Generated Sites

Statically generated sites can use the Node client to evaluate flags at build time. If your statically generated site has client-side rendering, you'll also want the JavaScript (or React) client.
