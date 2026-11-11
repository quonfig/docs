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

Log-level keys must also start with `log-level.` (for example
`log-level.my-app`).

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
- trailing dots (`my-flag.`)
- a Windows-reserved device name (`con`, `prn`, `aux`, `nul`, `com1`-`com9`,
  `lpt1`-`lpt9`, any case) before the first dot, such as `con` or
  `nul.settings`. Keys like `console` and `foo.con` are fine.
- the key `new`, which is reserved

## Migrating keys that don't conform

`qfg migrate` automatically rewrites non-conforming imported keys to valid
ones (for example, `my flag` becomes `my-flag`, and `new` becomes `new-key`).
Every rewrite is reported in `.qf/MIGRATION_REPORT.md` and recorded in `.qf/key-map.json`, so you can see
exactly what changed and update your code to match. If you'd rather fail
than rewrite, pass `--strict-keys`.

## Enforcement

The rules are checked when you create a key in the app or with `qfg create`,
and again by `qfg verify`, which also runs on every push to your workspace's
git repo. A key that breaks a rule is an error: `qfg verify` fails and the push
is rejected.

An audit of existing workspaces found no keys that break these rules, so keys
you already have aren't affected. If you do hit a non-conforming key (for
example, one written by hand into a cloned repo), rename it and update the code
that reads it.

:::note Windows path length

A 200-character key is always a safe *filename*, but on deep directory trees
the *full path* to it can still exceed Windows' 260-character limit. If you
clone workspaces into deeply nested folders on Windows, enable long paths
with `git config --global core.longpaths true`.

:::
