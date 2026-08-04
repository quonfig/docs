---
title: Quonfig + Claude Tag
sidebar_label: Quonfig + Claude Tag
sidebar_position: 4
---

# Quonfig + Claude Tag

[Claude Tag](https://claude.com/docs/claude-tag) is Claude in Slack. Give it
access to the [Quonfig MCP server](/docs/api/mcp-server) and your team can ask
about flags where they already talk about them:

> **@Claude** what's the rollout of `checkout-redesign` in prod?
>
> **@Claude** who turned off the new pricing page yesterday?
>
> **@Claude** kill `ai-summaries` in staging — the vendor is down.

Unlike [Claude Code](/docs/api/claude-code), where each developer signs in as
themselves, Claude Tag acts as one shared agent identity for the whole
channel. So it authenticates with a **service-account key**, and every change
it makes is attributed to that bot in your git history and audit log.

Setup is three pieces: a service account on the Quonfig side, and on the
Claude Tag side a plugin that declares the MCP server plus a credential that
carries the key.

:::note
The Claude Tag console is Anthropic's, and it's in public beta — labels may
have moved since this page was written. The current instructions are in
[Give Claude access to your tools](https://claude.com/docs/claude-tag/admins/add-connections).
:::

## 1. Create the service account

In the Quonfig app, open the workspace you want the bot to act on, go to
**Settings**, and find **Service accounts**. You need the admin role.

1. Click **New service account**.
2. Name it `claude-bot`. This name is what shows up in flag history and the
   activity feed, so pick something a teammate will recognize six months from
   now.
3. Pick an **Access tier**:

   | Tier | What the bot can do |
   |---|---|
   | Read-only | Answer questions. Cannot change anything. |
   | Support | Read, plus edit `support`-tier configs. |
   | Engineer | Read, plus edit `support` and `standard`-tier configs — where most flags live. |
   | Protected Engineer | Everything, including `protected` configs. |

   Start with **Read-only**. A bot that answers "what's the rollout?" is
   useful on day one and can't break anything; you can raise the tier later
   from the roles editor once the team trusts it. See
   [Authorization](/docs/explanations/features/authorization) for exactly what
   each tier covers.

4. On the new account's row, click **Mint key**. Choose the workspace the key
   is scoped to, give it a label (`claude-tag`), and optionally an expiry.

The key — it starts with `qf_sa_` — is shown once and never stored in
readable form. Copy it now; you'll paste it in step 3. If you lose it, revoke
it and mint another.

Keys are workspace-scoped. To let Claude Tag reach two workspaces, mint two
keys and add two credentials.

## 2. Add the plugin that declares the MCP server

Claude Tag learns about a custom MCP server from a plugin. The plugin is
three small files:

```
quonfig/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
└── skills/
    └── quonfig/
        └── SKILL.md
```

`.claude-plugin/plugin.json`:

```json
{
  "name": "quonfig",
  "description": "Read and update Quonfig feature flags and configs.",
  "version": "1.0.0"
}
```

`.mcp.json` — this is the part that points Claude at the server:

```json
{
  "mcpServers": {
    "quonfig": {
      "type": "http",
      "url": "https://mcp.quonfig.com/mcp"
    }
  }
}
```

`skills/quonfig/SKILL.md` — optional, but it's what turns "has access" into
"uses it well":

```markdown
---
name: quonfig
description: Use for questions about feature flags, configs, and rollouts in Quonfig - what a flag currently serves, who changed it and when, and turning a flag on or off in an environment.
---

# Quonfig

Feature flags and configuration, stored in git. The `quonfig` MCP server
exposes twelve read tools and one write tool.

## Answering questions

- Current state of one flag: `get_flag` (returns per-environment rules,
  rollout percentages, and variants). Do not infer state from `list_flags`
  alone.
- A rule with the `IN_SEG` operator names a segment, it does not list its
  members. Call `get_segment` before claiming who receives the flag.
- "Who changed this, and when": `get_flag_history` / `get_config_history`.
  For workspace-wide questions use `get_recent_changes`. For "when did this
  last change" across many items, read `lastModified` off the `list_flags` /
  `list_configs` rows instead of calling a history tool per item.
- Always name the environment in your answer. A flag is usually on in
  development and off in production; an answer that omits the environment is
  wrong more often than right.

## Changing a flag

- `set_flag` is the only tool that writes, and it replaces the environment's
  rules with a single unconditional rule.
- Read the flag first, then say plainly what will change and in which
  environment before you call it.
- If it fails with `TARGETING_RULES_PRESENT`, the environment has targeting
  rules that the write would delete. Show the rules and ask a human. Retry
  with `replaceTargeting: true` only after someone in the thread agrees —
  `set_flag` cannot put those rules back afterwards. Report the returned
  `previousCommitSha` and `replacedTargetingRuleCount` in the thread.
- Never guess an environment name. Call `list_environments`; if the request
  is ambiguous ("turn it off"), ask which environment.
```

Add the plugin the way your organization adds plugins: register a
[skills repository](https://claude.com/docs/claude-tag/admins/skills-repo) as
an organization plugin source and put this folder in it, then enable the
plugin on the Access bundle's **Plugins** tab. An `.mcp.json` sitting in a
repository Claude happens to clone is *not* loaded — it has to arrive as an
attached plugin.

## 3. Add the credential

At [`claude.ai/admin-settings/claude-tag`](https://claude.ai/admin-settings/claude-tag),
open **Access bundles**, click into the bundle (or create one), and go to its
**Credentials** tab. Creating a bundle takes an Owner; adding a credential to
an existing bundle takes an Admin.

Click **Connect another tool** and fill in:

| Field | Value |
|---|---|
| Name | `Quonfig` |
| Credential type | **Bearer** |
| Token | The `qf_sa_...` key from step 1 |
| Allowed websites | `mcp.quonfig.com` |

Leave custom headers empty — the bearer token is the whole credential.

**The key never enters the sandbox.** Anthropic's Agent Proxy attaches it at
the network boundary on the way out: "Credentials are injected at the network
boundary by Agent Proxy; the model and the sandbox are not given the key. A
request to a host you haven't allowed is blocked, not sent"
([Claude Tag docs](https://claude.com/docs/claude-tag/admins/add-connections)).
That's why **Allowed websites** matters — it's the list of hosts your Quonfig
key can be sent to, and `mcp.quonfig.com` should be the only one on it.

## 4. Attach it to channels

A bundle applies to every channel in the scope it's attached to, so attaching
is how you decide who gets to use the bot. Add the bundle to the channels
that should have it — `#eng`, `#releases`, `#incidents` — and leave it off
everywhere else.

If one channel should have narrower access than the rest (a shared or
external channel, say), give it its own bundle with a read-only service
account key, and keep the writing key in the bundle attached to your internal
channels. Two service accounts cost nothing.

Plugin and credential changes apply to new threads. A thread that was already
running keeps the set it started with, so start a fresh one after you attach
the bundle.

## 5. Check it works

In a channel the bundle covers, start a new thread:

```
@Claude list the feature flags in Quonfig that are ready for cleanup.
```

Then confirm the write path, if you granted one:

```
@Claude turn off ai-summaries in staging.
```

Claude should say what it's about to change before doing it, and the change
should appear in the Quonfig activity feed attributed to `claude-bot (service
account)`. That attribution is the point: `@Claude who changed this?` and the
audit log tell the same story.

## What it can and can't do

Thirteen tools — twelve reads plus `set_flag`, the only write. The full list
is on the [MCP server](/docs/api/mcp-server#tools) page.

A few things worth knowing before you turn it loose in a channel:

- **The bot can never exceed its tier.** `set_flag` is permission-checked
  server-side on every call, exactly like a person clicking in the UI. A
  read-only service account is genuinely read-only, whatever anyone types in
  Slack.
- **Targeting rules are protected.** A write that would delete an
  environment's targeting rules is refused until someone confirms. See
  [Writing with set_flag](/docs/api/mcp-server#writing-with-set_flag).
- **Service-account keys carry no org-level permissions.** The bot can't
  manage service accounts, members, or billing even if it's given the admin
  role.
- **Rate limits are shared with the REST API** and apply per key — generous
  enough that normal channel traffic never approaches them. See
  [Rate limits](/docs/api/rest-api#rate-limits).

## Rotating and revoking

Mint a new key on the same service account, update the credential in the
bundle, then revoke the old key in Quonfig. Revocation takes effect on the
next call — there's no cached token to wait out.

To cut off the bot entirely, disable the service account. Every key it owns
stops working at once, and the history of what it changed stays intact.
