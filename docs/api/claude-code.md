---
title: Quonfig + Claude Code
sidebar_label: Quonfig + Claude Code
sidebar_position: 3
---

# Quonfig + Claude Code

Connect Claude Code to the [Quonfig MCP server](/docs/api/mcp-server) and it
can look up flags, read the audit trail, and change what an environment serves
— from the terminal you're already in, while it works on the code the flag
guards.

There is no API key to create, paste, or rotate: you sign in through your
browser, and the session acts with your own Quonfig permissions.

## Add the server

Run this in your terminal, not inside a Claude Code session:

```bash
claude mcp add --transport http quonfig https://mcp.quonfig.com/mcp
```

That registers the server for the current project. To make it available in
every project, add it at user scope instead:

```bash
claude mcp add --scope user --transport http quonfig https://mcp.quonfig.com/mcp
```

`claude mcp list` now shows `quonfig` with `! Needs authentication` — that's
expected, the next step is the sign-in.

## Sign in

Start Claude Code and open the MCP panel:

```
/mcp
```

Select `quonfig`, press Enter, and choose **Authenticate**. Your browser opens
Quonfig's sign-in page (or goes straight through, if you're already signed in),
then shows a consent screen naming the client that's asking for access.
Approve it, and the terminal reports the server connected.

You can also do it from the shell without starting a session:

```bash
claude mcp login quonfig
```

Either way, `claude mcp list` should now show `✔ Connected`. The sign-in is
remembered; tokens refresh in the background.

## Use it

Just ask. Claude picks the tools on its own:

```
What's the rollout of checkout-redesign in production?
Who turned off the new pricing page, and when?
Which flags in this workspace are ready for cleanup?
Disable ai-summaries in staging.
```

A useful pattern while working in a codebase: **"find every flag this service
reads, and tell me which ones are still off in production."** The code search
is local, the flag state comes from Quonfig, and the answer is one message.

Twenty tools are available — fourteen reads plus six writes. See
[Tools](/docs/api/mcp-server#tools) for the full list and what each returns.

### Writes ask first

Six tools write: `set_flag` and `set_config` for the everyday change,
`set_log_level` for logging, `create_flag` and `create_config` to add
something new, and `set_document` for edits the others can't express. Claude
Code asks your permission the first time it calls a tool, and the four
changing writes are annotated destructive so clients can keep confirming them
after that.

A write sets the scope's fallback — what users get when no targeting rule
matches — and keeps the targeting rules above it, saying how many it kept.
Asking for the value to apply to *everyone* is a different request:
`replaceTargeting: true` deletes those rules, so the tool's description tells
Claude to show you the rules and get your agreement first. `set_log_level`
never destroys targeting at all. See
[The three write shapes](/docs/api/mcp-server#the-three-write-shapes).

If a change does turn out wrong, ask for it back: *"undo that"*. The bad
write named the version it replaced, so Claude reads that version with
`get_document` and writes it back with `set_document` — see
[Raw documents and undo](/docs/api/mcp-server#raw-documents-and-undo).

You can only do what your Quonfig account can do — the session carries your
own roles, so a flag you can't edit in the UI is a flag Claude can't edit for
you either.

### If you belong to more than one workspace

With exactly one workspace, everything is automatic. With several, the first
call comes back asking which one and listing your options; Claude retries with
the workspace you name. Save the round trip by saying it up front — *"in the
payments workspace, what's the rollout of..."*.

## Share it with your team

`--scope project` writes the server into a `.mcp.json` in your repository, so
teammates who clone it get the server without running any command:

```bash
claude mcp add --scope project --transport http quonfig https://mcp.quonfig.com/mcp
```

Commit that file. Each teammate approves the server on first use and signs in
as themselves — no shared credential, and every change stays attributed to
the person who made it.

## Headless and CI

Browser sign-in needs a browser. For an unattended agent — CI, a container, a
cron job — use a
[service-account key](/docs/api/rest-api#authentication) instead and pass it
when you add the server:

```bash
claude mcp add --transport http quonfig https://mcp.quonfig.com/mcp \
  --header "Authorization: Bearer $QUONFIG_API_KEY"
```

The key pins the workspace and the bot's roles, and changes are attributed to
the service account. This is the same credential shape
[Claude Tag](/docs/api/claude-tag) uses.

## Troubleshooting

| Symptom | What to do |
|---|---|
| `! Needs authentication` after adding | Expected — run `/mcp` and authenticate, or `claude mcp login quonfig`. |
| Browser doesn't open | Copy the URL printed in the terminal and open it manually. |
| `No MCP servers configured` | The server was added at `local` scope in a different project. Re-add with `--scope user`. |
| Tools return `FORBIDDEN` | Your Quonfig account lacks edit permission for that flag or environment; see [Authorization](/docs/explanations/features/authorization). |

Claude Code's own [MCP guide](https://code.claude.com/docs/en/mcp-quickstart)
covers the general cases.
