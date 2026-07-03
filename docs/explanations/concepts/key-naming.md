---
title: Key Naming Rules
sidebar_label: Key Naming Rules
sidebar_position: 4
---

# Key Naming Rules

Config and flag keys must:

- match `^[A-Za-z0-9._-]+$` — letters, digits, dots, underscores, and hyphens
- be at most **200 characters** long
- be **unique case-insensitively** within a workspace — `myFlag` and `MyFlag`
  cannot coexist

## Why these rules?

Your configs are files in a git repo you can clone. Every key becomes a
filename (`my-flag` is stored as `my-flag.json`), so these rules exist to
guarantee that every key is a safe filename on macOS, Windows, and Linux —
and that two keys never collide into one file on a case-insensitive
filesystem.

## Mixed case is fine

Case is preserved everywhere: a camelCase key like `myFlag` works in the UI,
in git, in every SDK, and in generated code, exactly as you typed it. The
case-insensitive uniqueness rule only means you can't *also* create `MyFlag`
in the same workspace.

## Also blocked (you'll rarely hit these)

A few extra patterns are rejected because they break filenames on at least
one operating system:

- leading dots (`.my-flag`)
- Windows-reserved device names (`con`, `nul`, `com1`, ...)
- trailing dots or spaces

## Migrating keys that don't conform

`qfg migrate` automatically rewrites non-conforming imported keys to valid
ones (for example, `my flag` becomes `my-flag`). Every rewrite is reported in
`MIGRATION_REPORT.md` and recorded in `.qf/key-map.json`, so you can see
exactly what changed and update your code to match. If you'd rather fail
than rewrite, pass `--strict-keys`.

## Existing keys keep working

Keys created before these rules keep working — nothing you already have
breaks. `qfg verify` currently **warns** on non-conforming legacy keys; this
warning will become an error in a future release, so it's worth renaming
stragglers when convenient.

:::note Windows path length

A 200-character key is always a safe *filename*, but on deep directory trees
the *full path* to it can still exceed Windows' 260-character limit. If you
clone workspaces into deeply nested folders on Windows, enable long paths
with `git config --global core.longpaths true`.

:::
