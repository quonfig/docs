---
title: MCP server
sidebar_label: MCP server
sidebar_position: 2
---

# MCP server

Quonfig runs a hosted [MCP](https://modelcontextprotocol.io) server, so an AI
assistant can answer questions about your flags and configs — and change what
an environment serves — with no glue code on your side.

```
https://mcp.quonfig.com/mcp
```

The transport is streamable HTTP, and the tools are the
[REST API](/docs/api/rest-api) surface: same permissions, same validation,
same git-backed audit trail. A flag flipped from Slack shows up in the app's
history exactly like one flipped by a person.

Setting it up takes a couple of minutes:

- [Quonfig + Claude Code](/docs/api/claude-code) — one command, then sign in
  through your browser. No API key to handle.
- [Quonfig + Claude Tag](/docs/api/claude-tag) — a service account your team
  shares in Slack channels.

Any other MCP client works the same way: point it at the URL above and use one
of the two [authentication methods](#authentication) below.

## Tools

Nine tools: eight reads and one write.

| Tool | What it does |
|---|---|
| `list_flags` | List the workspace's flags with their lifecycle status per production environment. Filterable by tag and status. |
| `get_flag` | One flag in full: default rules, per-environment targeting rules, rollouts, variants. |
| `get_flag_history` | The git commits that changed a flag, newest first. |
| `list_configs` | List the workspace's configs. |
| `get_config` | One config in full. Encrypted values come back as stored ciphertext. |
| `get_config_history` | The git commits that changed a config. |
| `get_recent_changes` | The workspace change feed, translated into readable messages — or one item's full history. |
| `list_workspaces` | The workspaces this credential can act on. |
| `set_flag` | Update what one environment of a flag serves. The only tool that writes. |

The eight read tools are annotated `readOnlyHint`, so a client can tell at a
glance that they can't change anything. `set_flag` is annotated
`destructiveHint` — clients that confirm destructive tool calls will ask
before it runs.

Things the tools are good at, in practice:

- **"What's the rollout of `checkout-redesign` in production?"** — `get_flag`
  returns the actual rules, including percentage splits.
- **"Who turned this off, and when?"** — `get_flag_history` and
  `get_recent_changes` read straight from git, so the answer includes the
  author and the commit.
- **"Kill the new pricing page in prod."** — `set_flag`, subject to the same
  permission check the UI applies.

### Writing with `set_flag`

`set_flag` takes exactly one operation per call — toggle (`enabled`), serve a
single value (`value`), or run a percentage `rollout` — and replaces that
environment's rules with a single unconditional rule.

If the environment currently has **targeting rules**, the call fails instead
of quietly deleting them: the agent gets back
`CONFLICT` / `TARGETING_RULES_PRESENT` naming how many rules are at stake, and
has to retry with `replaceTargeting: true` to go through. The tool
description tells the agent to confirm with you first, and in practice it
does — it reports what the rules do and waits.

The full write semantics (value types, rollout percents, sticky bucketing,
no-op writes, `expectedCommitSha`) are documented once, on the REST page:
[Updating a flag](/docs/api/rest-api#updating-a-flag).

## Authentication

Two ways in. They differ in who the change is attributed to and who does the
setup.

| Method | Credential | Attribution | Best for |
|---|---|---|---|
| Browser sign-in (OAuth) | None to handle — you sign in | Your user account | Individual developers, Claude Code, any interactive client |
| Bearer key | `qf_sa_...` service-account key, or `qf_uk_...` personal key | The service account (or you) | Shared bots, Slack, CI, anything headless |

**Browser sign-in** follows the MCP authorization spec: the client discovers
Quonfig's authorization server from
`https://mcp.quonfig.com/.well-known/oauth-protected-resource/mcp`, registers
itself, and runs an authorization-code flow with PKCE in your browser. Clients
that support this — Claude Code among them — need nothing but the URL. Access
tokens are short-lived and refreshed automatically.

**Bearer keys** go in the `Authorization: Bearer` header and never expire
unless you set an expiry. Mint them as described under
[Authentication](/docs/api/rest-api#authentication) on the REST page — use a
service account for anything shared, so the audit trail names the bot rather
than whoever set it up.

:::warning SDK keys don't work here
`qf_sk_...` / `qf_pk_...` SDK keys authenticate your *application* to the
delivery API — they cannot manage config. See
[Keys & Credentials](/docs/explanations/concepts/keys-and-credentials).
:::

## Which workspace a call acts on

Every tool call acts on exactly one workspace.

- **With a key**, the workspace is the one the key was minted for. There is
  nothing to choose, and passing a different workspace fails.
- **After a browser sign-in**, the session can reach every workspace your
  account can. With exactly one, it's selected automatically. With several,
  the first call comes back asking which — naming your options — and the
  agent retries with a `workspace` argument. You can skip the round trip by
  saying which one you mean ("in the `payments` workspace, ...").

`list_workspaces` shows the options and their ids at any time.

## Permissions

An MCP session has exactly the permissions of the principal behind it: your
own roles after a browser sign-in, the service account's roles when a key is
used. Nothing is elevated for agents.

So a read-only bot is just a service account with no config-tier role, and
`set_flag` fails with `FORBIDDEN` / `PERMISSION_DENIED` for a principal that
can't edit that flag in that environment. See
[Authorization](/docs/explanations/features/authorization) for how roles and
config tiers compose.

One useful property: keys never carry org-level permissions, so a
service-account key can't manage service accounts or billing — even if
someone gives the account the admin role.

## Errors and rate limits

Failed tool calls come back as MCP errors carrying the same
`{error, message, details}` envelope the REST API returns, so an agent can
read the failure and correct itself. The codes are listed once, on the REST
page: [Errors](/docs/api/rest-api#errors).

Rate limits are shared with the REST API and apply per credential (per user
for browser sessions). Over the limit, calls fail with a retry delay the
client honors. See [Rate limits](/docs/api/rest-api#rate-limits).
