---
title: MCP
sidebar_label: MCP
---

# Quonfig MCP

The Quonfig Model Context Protocol (MCP) server lets you manage feature flags and configs directly from Claude, Cursor, or any MCP-enabled IDE.

## What You Can Do

- **Browse and search** feature flags and configs across workspaces
- **View details** of specific flags including their rules and targeting
- **Check audit logs** to see who changed what and when
- **View evaluation data** to see how flags are being used in production
- **Create and update** feature flags and config values
- **Clean up flags** by finding flags marked for deletion and safely removing them
- **Set personal overrides** to test different values without affecting other users

## Installation

### Option 1: Using the CLI (Recommended)

Install the CLI and run:

```bash
qfg mcp
```

This will automatically add the MCP server to your configuration.

### Option 2: Manual Configuration

Add this URL to your MCP tool configuration:

```
https://launch.quonfig.com/api/v1/mcp
```

## Authentication

The MCP server uses OAuth for authentication. When you first use a tool, you'll be prompted to authenticate with Quonfig. The authentication is handled automatically by your MCP client.

## Example Usage

Once installed, you can ask Claude things like:

- "Show me all feature flags"
- "What's the current value of the `new-checkout` flag?"
- "Who changed `payment.timeout` and when?"
- "Create a new feature flag called `dark-mode` with a default value of false"
- "Show me evaluation data for `experiment.pricing` in production"
- "Help me clean up old feature flags"

## Multiple Workspaces

If you have access to multiple workspaces, just ask your agent to list workspaces and you'll be able to switch the current workspace.