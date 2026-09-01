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

Twenty tools: fourteen reads and six writes.

| Tool | What it does |
|---|---|
| `list_flags` | List the workspace's flags with their lifecycle status per environment, when each last changed, and who changed it. Filterable by tag and status; optionally paginated. |
| `get_flag` | One flag in full: default rules, per-environment targeting rules, rollouts, variants. |
| `get_flag_history` | The git commits that changed a flag, newest first. |
| `list_configs` | List the workspace's configs, with when each last changed. Optionally paginated. |
| `get_config` | One config in full. Encrypted values come back as stored ciphertext. |
| `get_config_history` | The git commits that changed a config. |
| `list_log_levels` | One row per service: the fallback level and the per-logger overrides in each scope. |
| `list_segments` | List the workspace's segments and how many membership rules each has. |
| `get_segment` | One segment's membership rules — who a segment-targeted flag actually reaches. |
| `get_segment_history` | The git commits that changed a segment. |
| `list_environments` | The workspace's environments: name, type, and whether each is protected. |
| `get_recent_changes` | The workspace change feed, translated into readable messages — or one item's full history. |
| `list_workspaces` | The workspaces this credential can act on. |
| `get_document` | The raw stored JSON for one flag, config, or log level — verbatim, and at any commit with `at`. |
| `create_flag` | Create a flag. Boolean by default, off everywhere; pass `type` (and `value`) for any other kind. |
| `create_config` | Create a config serving one default value. `valueType` is required. |
| `set_flag` | Update what one scope of a flag serves — an environment, or the `default` every environment inherits. |
| `set_config` | The same, for a config's value. |
| `set_log_level` | Set one service's level — for a whole scope, or for one logger prefix. Creates the document on first write. |
| `set_document` | Replace the raw stored JSON for one flag, config, or log level. The escape hatch, and the undo. |

The fourteen read tools are annotated `readOnlyHint`, so a client can tell at
a glance that they can't change anything. `set_flag`, `set_config`,
`set_log_level` and `set_document` are annotated `destructiveHint` — clients
that confirm destructive tool calls will ask before any of them runs.
`create_flag` and `create_config` are not: a create only ever adds a
document, and refuses a key that's taken rather than overwriting it.

The writes also differ in one annotation that matters for retries.
`set_flag`, `set_config` and `set_log_level` are `idempotentHint: true`:
their operations are absolute and a repeat converges to a no-op, so
replaying a timed-out call is safe. `set_document` is
`idempotentHint: false` — it is pinned to an `expectedCommitSha`, so
replaying a call that may already have landed fails with
`STALE_COMMIT_SHA` instead of converging; the fix is always to re-read and
re-apply. The creates are `idempotentHint: false` too, for the same reason
in reverse: a replayed create doesn't converge, it comes back
`ALREADY_EXISTS`.

`get_document` and `set_document` take a `type` argument — `flag`, `config`,
or `log-level` — instead of being six separate tools.

:::note One kind, two spellings
`get_document` and `set_document` spell the log-level kind `log-level`, with
a hyphen. `get_recent_changes` (and the `collidingType` a create returns)
spell the same kind `log_level`, with an underscore. Both are shipped wire
enums and neither will be renamed, so translate when you move a kind between
them. The tool descriptions say so too, which is what keeps an agent from
guessing.
:::

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
- **"Set the poll interval to 30s."** — `set_config` with
  `environment: "default"`, because that's where most configs actually keep
  their value. See [Scopes: an environment, or the default](#scopes-an-environment-or-the-default).
- **"Turn on debug logging for the cache."** — `set_log_level` with a
  `target` of the logger prefix. It changes that one rule and leaves the
  rest of the service's levels alone.
- **"Add a flag for the new onboarding flow."** — `create_flag` makes it,
  off in every environment; enabling it anywhere is a separate, explicit
  `set_flag`.
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

### Scopes: an environment, or the default

Every write names a **scope**, and there are two kinds. A scope is either the
name of one of your environments — from `list_environments`, never guessed —
or the literal `"default"`, meaning the rules every environment *without its
own entry* inherits.

The distinction is the one worth internalising, because for a lot of items
the value only lives in `default`: `environments` is empty and every
environment reads through to it. Naming an environment there doesn't change
the value everywhere, it **shadows** the default in that one environment and
leaves the rest on the old value. So "turn this on everywhere" is usually
`"default"`, and "turn it on in staging only" is `staging`.

`"default"` is a reserved environment name, so the sentinel is never
ambiguous with a real environment.

### The three write shapes

The six writes behave in three different ways, and the difference is
behavioural rather than cosmetic — it decides when an agent has to come back
and ask you something.

**Replace — `set_flag` and `set_config`.** Each takes exactly one operation
per call (for flags: toggle `enabled`, serve a single `value`, or run a
percentage `rollout`) and replaces the scope's rules with one unconditional
rule.

If the scope currently has **targeting rules**, the call fails instead of
quietly deleting them: the agent gets back
`CONFLICT` / `TARGETING_RULES_PRESENT` naming how many rules are at stake, and
has to retry with `replaceTargeting: true` to go through. The tool
descriptions instruct the agent to confirm with a human before that retry
rather than deciding on its own.

That confirmation matters because these two can only ever write a single
unconditional rule, so **they cannot put multi-rule targeting back
themselves**. A successful write returns `previousCommitSha` (the version the
rules were last stored in) and `replacedTargetingRuleCount` when targeting was
genuinely destroyed; an agent that replaces targeting should report both
back to whoever asked. Recovering those rules is a `get_document` /
`set_document` pair — see below — not a UI trip.

**Surgical — `set_log_level`.** The exception. There is one log-level
document per *service*, and individual loggers live inside it as rules, so
this tool adds or overwrites exactly one rule and leaves every sibling in
place. Pass `target` — a logger path prefix — to set the level for that
logger and everything under it, or omit it to set the scope's fallback level.
It never has to ask before destroying targeting, because it never destroys
any, and a repeated call converges instead of stacking duplicates. If the
service has no document yet, the first write creates one (`created: true`).

**Add — `create_flag` and `create_config`.** They only ever add a document.
A flag is created off in every environment; a config is created serving one
default value, plain (never encrypted) and at the standard access tier. A key
that's already taken is refused with `ALREADY_EXISTS` and a `collidingType`
saying what holds it — keys are pooled case-insensitively across flags,
configs, segments and log levels. The tool descriptions are emphatic that an
agent must never "retry" a create by mutating the key it was given; that's
how a workspace ends up with three flags nobody can tell apart.

For anything the six can't express — multi-rule targeting, variants,
metadata, a schema binding — the answer is always the same: create or write
the simple version, then reshape it with `set_document`.

The full write semantics (value types, rollout percents, sticky bucketing,
no-op writes, `expectedCommitSha`) are documented once, on the REST page:
[Updating a flag](/docs/api/rest-api#updating-a-flag).

### Raw documents and undo

`get_document` and `set_document` read and replace the JSON file Quonfig
actually stores for a flag, config, or log level — `access`, `$schema`,
`type` and all. They're the escape hatch for edits the write verbs can't
express (multi-rule targeting, variants, metadata) and the reason an agent
can undo its own mistake — any write, not just a `set_flag`.

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
every write fails with `FORBIDDEN` / `PERMISSION_DENIED` for a principal that
can't edit that item — per item and environment for `set_flag`, `set_config`
and `set_log_level`, per access tier for `set_document` and the creates. See
[Authorization](/docs/explanations/features/authorization) for how roles and
config tiers compose.

A service-account key with no config-tier role goes one step further: the
six write tools aren't listed for it at all, so an agent sees fourteen read
tools and nothing that could change anything. That's a courtesy, not the
control — the permission check on every call is what actually refuses a
write, and it refuses one just the same if a client calls a tool it wasn't
shown. But it means a read-only bot in a Slack channel answers "I can't
change that" instead of trying six times first.

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
