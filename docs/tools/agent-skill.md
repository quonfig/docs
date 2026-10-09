---
title: Agent skill
sidebar_label: Agent skill
---

# Agent skill

Install the Quonfig agent skill into your application repo and your coding
agent — Claude Code, Codex, Cursor, or anything else that reads skills — knows
how to use Quonfig the right way. Ask it to *"put the new checkout flow behind
a flag"* and it will:

- find (or set up) the Quonfig SDK for your language,
- create the flag with `qfg create`, off by default,
- gate the code with the SDK call and a context that identifies the user,
- turn the flag on in development only, and tell you the rollout command for
  production.

The skill is one `SKILL.md` plus short reference files per SDK (Node, browser
JavaScript, React, React Native, Go, Python, Ruby, Java, .NET, Swift), the
`qfg` CLI, the [MCP server](/docs/api/mcp-server) tools, and retiring flags.
The source is public at
[github.com/quonfig/skills](https://github.com/quonfig/skills).

## Install

Pick one. They all install the same skill.

| You use | Run |
|---|---|
| Claude Code | `claude plugin marketplace add quonfig/skills` then `claude plugin install quonfig@quonfig` |
| The `qfg` CLI, any agent | `qfg agent install-skill --add-pointer` in your repo |
| Any agent, via [skills.sh](https://skills.sh) | `npx skills add quonfig/skills --skill quonfig` |

### Claude Code plugin

```bash
claude plugin marketplace add quonfig/skills
claude plugin install quonfig@quonfig
```

The plugin brings the skill and registers the Quonfig MCP server, so Claude
can also read live flag state. The first time Claude uses the server, sign in
from `/mcp` — see [Quonfig + Claude Code](/docs/api/claude-code#sign-in).
Add `--scope project` to both commands to commit the setup to your repo so
teammates get it on clone.

### `qfg agent install-skill`

If you already have the [CLI](/docs/tools/cli), run this at the root of your
application repo:

```bash
qfg agent install-skill --add-pointer
```

It writes the skill to `.claude/skills/quonfig/` (Claude Code picks it up from
there) and, with `--add-pointer`, adds one line to `AGENTS.md` so Codex,
Cursor, and other agents find it too. Commit both. The skill text ships inside
`qfg`, so nothing is downloaded.

Re-run it after upgrading `qfg` to get the latest skill. Files you have edited
are left alone — the command lists them and stops; pass `--force` to replace
them. Use `--dir` to install somewhere other than `.claude/skills`.

### Manual

Copy
[`plugins/quonfig/skills/quonfig/`](https://github.com/quonfig/skills/tree/main/plugins/quonfig/skills/quonfig)
into your agent's skills directory.

## Application repo vs. workspace repo

The skill is for the repo where your **application code** lives. Your
**workspace** repo — the one `qfg init` creates, holding the flag JSON — gets
its own `AGENTS.md` and `CLAUDE.md` from `qfg init`, covering the JSON format
and `qfg verify`. Each points at the other, so an agent in either repo finds
the right instructions. You don't need the skill in the workspace repo.

## Claude Tag

[Claude Tag](/docs/api/claude-tag) loads skills from a plugin in your
organization's skills repository. Add this repository's `plugins/quonfig`
folder there — it already contains the `.mcp.json` that points at the MCP
server — then follow the Claude Tag page for the service-account credential.
