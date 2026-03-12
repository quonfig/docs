---
title: Migrate from Prefab
sidebar_label: Migrate from Prefab
---

## Overview

Prefab has officially relaunched as Quonfig Launch.

We've been hard at work improving the core experience around configuration, cleanup, and code generation — and building toward a unified AI-native feature management platform.

This guide walks you through what's new, what's changing, and how to migrate smoothly.

---

## What's New

- **Feature Flag Lifecycle Improvements** — Cleaner workflows for managing, tracking, and cleaning up flags.
- **MCP Support** — Connect Launch directly to Claude, Cursor, or other MCP-enabled IDEs for assisted flag cleanup.
- **Type-Safe Code Generation** — Automatically generate type-safe clients for React, Node, and JavaScript.
- **JSON Schemas** — Define and enforce structure for config and prompt JSON.
- **Mustache String Interpolation** — Combine templating with type safety via codegen.
- **Prompt Management** — Define schemas for model, temperature, and templated systemMessage values, then generate code to safely use them.

---

## What's Changing

### Dynamic Logging has been revamped

We have a new approach to dynamic control of log levels. The Prefab approach didn't scale cleanly across multi-language environments (Node, React, Ruby), per-developer overrides were awkward, and it was hard for multi-application setups as well.

We're taking another swing at this with a simpler, more unified design. The UI has been overhauled, but the actual client changes are small. Check the language specific SDK docs for details.

### New Rule Operators

The new UI will let you create rules like Before / After, Greater than, Less than and SemVer. For this reason, we'll need you to update SDKs so that they understand these operators before you start making rules with them. The best way to do this is by moving to the Quonfig SDK. 

### Env Var Names
We've changed the expected environment variable names to `QUONFIG_BACKEND_SDK_KEY` and `QUONFIG_FRONTEND_SDK_KEY`. This makes it easier & clearer for applications using both.

## Schemas
If you were in the beta of Schemas to validate your JSON configs and were using any Zod 3 specific features, we've moved to Zod 4 and you'll need to update your schemas.

### CLI
The new `quonfig` CLI now uses OAuth login for most operations. 

### Secrets
The `quonfig` CLI does not support ENV vars at this time which is necessary for Secret support. We're actively working on this and expect it to shortly. For now you'll need to use the `prefab` CLI for secret management.

### LSP (VSCode & Vi plugin)
We have not updated the LSP. In our testing the MCP has been much more capable so we are leaning towards just focussing our attention on that going forward.

---

## Migration Plan

All organizations will need to upgrade from Prefab SDK -> Quonfig SDK to access the new UI.

### Steps

#### 1. Upgrade to the Quonfig SDK
- Should be straightforward find and replace.
- Required to use the new UI.
- Ensures compatibility with new operators like and support for `quonfig.current-time`.

#### 2. Coordinate Switchover
- Once upgraded, reach out to our team to enable your org in the new UI.
- After migration, old and new UIs can not be used interchangeably.
- SAML customers we'll coordinate setting up SAML with Quonfig identity systems.

#### 3. Billing
- Existing billing continues unchanged during migration.
- When you're ready to switch, your final invoice on the legacy system will close out your previous period, and your next month's invoice will start under Quonfig Launch.

---

## Support

Reach out via email or Slack if you hit friction; we'll walk you through the steps.
