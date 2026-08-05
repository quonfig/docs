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

Fifteen tools: thirteen reads and two writes.

| Tool | What it does |
|---|---|
| `list_flags` | List the workspace's flags with their lifecycle status per environment, when each last changed, and who changed it. Filterable by tag and status; optionally paginated. |
| `get_flag` | One flag in full: default rules, per-environment targeting rules, rollouts, variants. |
| `get_flag_history` | The git commits that changed a flag, newest first. |
| `list_configs` | List the workspace's configs, with when each last changed. Optionally paginated. |
| `get_config` | One config in full. Encrypted values come back as stored ciphertext. |
| `get_config_history` | The git commits that changed a config. |
| `list_segments` | List the workspace's segments and how many membership rules each has. |
| `get_segment` | One segment's membership rules — who a segment-targeted flag actually reaches. |
| `get_segment_history` | The git commits that changed a segment. |
| `list_environments` | The workspace's environments: name, type, and whether each is protected. |
| `get_recent_changes` | The workspace change feed, translated into readable messages — or one item's full history. |
| `list_workspaces` | The workspaces this credential can act on. |
| `get_document` | The raw stored JSON for one flag, config, or log level — verbatim, and at any commit with `at`. |
| `set_flag` | Update what one environment of a flag serves. The everyday write. |
| `set_document` | Replace the raw stored JSON for one flag, config, or log level. The escape hatch, and the undo. |

The thirteen read tools are annotated `readOnlyHint`, so a client can tell at
a glance that they can't change anything. `set_flag` and `set_document` are
both annotated `destructiveHint` — clients that confirm destructive tool
calls will ask before either runs.

The two writes differ in one annotation that matters for retries.
`set_flag` is `idempotentHint: true`: its operations are absolute and a
repeat converges to a no-op, so replaying a timed-out call is safe.
`set_document` is `idempotentHint: false`: it is pinned to an
`expectedCommitSha`, so replaying a call that may already have landed fails
with `STALE_COMMIT_SHA` instead of converging. The fix is always to re-read
and re-apply, never to retry the same arguments.

`get_document` and `set_document` take a `type` argument — `flag`, `config`,
or `log-level` — instead of being six separate tools. Log levels are
reachable *only* through this pair; there is no `list_log_levels` or
`get_log_level`.

Things the tools are good at, in practice:

- **"What's the rollout of `checkout-redesign` in production?"** — `get_flag`
  returns the actual rules, including percentage splits.
- **"So who actually gets it?"** — when a rule targets a segment
  (`IN_SEG`), the flag document only names the segment. `get_segment`
  resolves what that segment matches, so the answer describes people rather
  than a key.
- **"Who turned this off, and when?"** — `get_flag_history` and
  `get_recent_changes` read straight from git, so the answer includes the
  author and the commit.
- **"Which of these flags are stale?"** — every `list_flags` /
  `list_configs` row carries `lastModified`, with the date and author of the
  last change, so age questions are one call rather than one call per flag.
- **"Kill the new pricing page in prod."** — `set_flag`, subject to the same
  permission check the UI applies. `list_environments` first, so the agent
  uses the environment names your workspace actually has instead of
  guessing at `prod`.
- **"That was wrong — put it back."** — `get_document` reads the flag as it
  stood at the commit the bad write named, and `set_document` writes that
  version back. Two tool calls, no UI trip. See
  [Raw documents and undo](#raw-documents-and-undo).

### Flag status, precisely

`list_flags` returns two status maps: `statuses` (production environments
only — the one the status filter matches) and `environmentStatuses` (every
active environment). A flag that is `live` in production and `pre_rollout`
in staging is an environment gate, not a finished rollout, and only the
second map shows that.

Status is derived from the stored rules plus `readyForCleanup`, a marker
the flag's owner sets by hand — never from usage or telemetry. The exact
rule is on the REST page:
[Flag lifecycle status](/docs/api/rest-api#flag-lifecycle-status).

### Reading a large workspace

`list_flags` and `list_configs` return every row by default. Pass `limit`
(1–100) to bound the response, then keep passing the returned `nextCursor`
back as `cursor` until it's absent. Rows come back ordered by key once you
paginate, and filters have to be resent with each page — see
[Pagination](/docs/api/rest-api#pagination).

The tool descriptions tell the agent the part it can't infer from a schema:
a partial page is never the whole answer, so a "how many..." or "does any
flag..." question must not be answered from a page that still carries a
`nextCursor`.

### Writing with `set_flag`

`set_flag` takes exactly one operation per call — toggle (`enabled`), serve a
single value (`value`), or run a percentage `rollout` — and replaces that
environment's rules with a single unconditional rule.

If the environment currently has **targeting rules**, the call fails instead
of quietly deleting them: the agent gets back
`CONFLICT` / `TARGETING_RULES_PRESENT` naming how many rules are at stake, and
has to retry with `replaceTargeting: true` to go through. The tool's own
description instructs the agent to confirm with a human before that retry
rather than deciding on its own.

That confirmation matters because `set_flag` can only ever write a single
unconditional rule, so **it cannot put multi-rule targeting back itself**. A
successful write returns `previousCommitSha` (the version the rules were
last stored in) and `replacedTargetingRuleCount` when targeting was
genuinely destroyed; an agent that replaces targeting should report both
back to whoever asked. Recovering those rules is a `get_document` /
`set_document` pair — see below — not a UI trip.

The full write semantics (value types, rollout percents, sticky bucketing,
no-op writes, `expectedCommitSha`) are documented once, on the REST page:
[Updating a flag](/docs/api/rest-api#updating-a-flag).

### Raw documents and undo

`get_document` and `set_document` read and replace the JSON file Quonfig
actually stores for a flag, config, or log level — `access`, `$schema`,
`type` and all. They're the escape hatch for edits `set_flag` can't express
(multi-rule targeting, variants, metadata) and the reason an agent can undo
its own mistake.

The undo recipe is three tool calls:

1. The bad write returned `previousCommitSha`. Call `get_document` with `at`
   set to that sha — that reads the item as it stood before the write.
2. Call `get_document` again without `at`, to get the **current**
   `commitSha`.
3. Call `set_document` with the old document and the current sha as
   `expectedCommitSha`.

Pinning to the current sha, not the historical one, is the step agents get
wrong: `expectedCommitSha` asserts "I have read the version I am about to
overwrite", which is the bad write. The tool descriptions say so, and the
full walkthrough with curl is on the REST page:
[Undoing a write](/docs/api/rest-api#undoing-a-write).

Two properties an agent has to respect, both spelled out in the tool
descriptions and enforced server-side:

- **`set_document` is a full replacement.** A field omitted from the
  document is deleted, so the document must come from a `get_document`
  result — never hand-built.
- **`expectedCommitSha` is required and must be fresh.** A stale one fails
  with `STALE_COMMIT_SHA` and writes nothing. Re-read and re-apply; don't
  replay the call.

Writes are validated even though reads aren't, so restoring a very old
version can be rejected with a `400` naming the field that no longer
validates — the fix is to correct the JSON forward. And the pair updates
only: it never creates or deletes an item. Everything else is on the REST
page: [Raw documents](/docs/api/rest-api#raw-documents).

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
both writes fail with `FORBIDDEN` / `PERMISSION_DENIED` for a principal that
can't edit that item — per flag and environment for `set_flag`, per access
tier for `set_document`. See
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
