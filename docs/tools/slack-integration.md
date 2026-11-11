---
title: Slack Integration
sidebar_label: Slack Integration
---


![image](/img/docs/tools/devtools-slack.jpg)

The Slack integration sends a message to a channel of your choice every time a flag, config, segment, or log-level changes in a workspace. The message body is formatted from the same audit translator the in-app audit log uses, so what your team sees in Slack matches what they see in the UI.

## Connect a workspace

Each Quonfig workspace is connected to Slack independently — connect once per workspace.

1. In the Quonfig app, open your workspace and click **Integrations** in the sidebar (between Environments & Keys and Debugger).
2. Click **Connect to Slack**. You'll be redirected to Slack's OAuth consent page.
3. Pick the Slack workspace to install Quonfig into and approve the requested scopes:
   - `chat:write` — post messages to a channel
   - `channels:read` / `groups:read` — list channels for the picker
4. Slack returns you to the integrations page. The integration now shows **Needs setup**: Slack is connected but no channel is selected yet.

Any member of the Quonfig org that owns the workspace can start the Slack install, but saving the notification channel and disconnecting need the `integrations.manage` permission, which only the built-in **Admin** role grants. Have an Admin do the setup, or see [Authorization](/docs/explanations/features/authorization).

## Pick a notification channel

After the OAuth dance the page shows a channel picker listing every channel the Quonfig bot is currently a member of.

1. In Slack, run `/invite @Quonfig` in the channel where you want change notifications to land.
2. Back in the Quonfig integrations page, click **Refresh channels** if the picker is empty, or reload the page otherwise. The new channel appears in the picker (Slack reflects new memberships immediately on the `users.conversations` endpoint Quonfig uses).
3. Select the channel and click **Save**. The integration now shows **Connected**.

Once a channel is saved, the page shows only the current channel and a **Disconnect** button. To send notifications to a different channel, click **Disconnect** and repeat the connect flow, picking the new channel.

## What gets notified

Quonfig posts one message per commit to the workspace's git repo that touches a config-shaped file, so a push with several such commits produces several messages. A file is config-shaped if it is a `.json` file under any of:

- `configs/`
- `feature-flags/`
- `segments/`
- `log-levels/`

Each message starts with the commit author and the commit subject, so you can trace the change back to the person and PR. Below that is one line per changed file, in the form `` • `key` <action> — <summary> ``, where the action is `created`, `updated`, or `deleted` and the summary is the same human-readable text the audit log shows. For example:

```text
Jane Doe updated configs:
> Turn on the new checkout flow
• `checkout.new-flow` updated — Changed value from false to true
```

Other summaries look like *"Changed rollout from … to …"* or *"Added rule 2 (…) → true"*, matching what you see in the audit log.

Non-config files (READMEs, top-level `quonfig.json`, non-`.json` files, anything outside the four directories above) are skipped.

## Disconnect

On the integrations page, click **Disconnect**. Quonfig calls Slack's `apps.uninstall` to revoke the bot token and removes the installation row. You can reconnect at any time by repeating the connect flow.

:::tip Looking for Claude in Slack?
This integration is one-way: Quonfig posts change notifications into a
channel. To let your team *ask* about flags and change them from Slack, see
[Quonfig + Claude Tag](/docs/api/claude-tag).
:::
