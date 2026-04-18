---
title: From Launch
sidebar_label: From Launch
sidebar_position: 1
---

# Migrating from Launch

`qfg migrate --from launch` pulls every flag, config, and segment out of a Launch
workspace and turns it into a Quonfig workspace — either as files on disk that
your SDK reads directly, or pushed up to a cloud workspace you can edit in the
Quonfig UI.

Re-runs are incremental: the migrator persists a cursor in `.qf/import-state.json`
and picks up only the changes made in Launch since the last run, so you can keep
both systems in sync while you cut over.

## :warning: Browser-SDK limitation (read this first)

**Flow A (local-only) only works for server-side SDKs.**

| SDK | Flow A (datadir, no service) | Flow B (cloud + api-delivery) |
| --- | --- | --- |
| `sdk-node` | :white_check_mark: supported (`WithDatadir`) | :white_check_mark: supported |
| `sdk-go` | :white_check_mark: supported (`WithDatadir`) | :white_check_mark: supported |
| `sdk-javascript` (browser) | :x: **not supported** — browsers cannot read a local directory | :white_check_mark: supported (SSE from `api-delivery`) |

If your app ships to browsers via `sdk-javascript`, you **must** use Flow B. The
browser SDK loads configuration from `api-delivery` over SSE and has no datadir
mode — this is architectural, not a roadmap gap. Trying to point the browser SDK
at a local directory will not work.

Node and Go users can use either flow. Most customers kick the tires with Flow A
(no signup, no cloud state to clean up) and then switch to Flow B once they are
ready to use the Quonfig UI.

---

## Prerequisites

- The `qfg` CLI installed (see [CLI tool](../tools/cli.md))
- A Launch API key with read access to the workspace you are migrating
- For Flow B: a Quonfig account and a workspace. Run `qfg login` first.

Set the API key in your shell so you are not pasting it on the command line:

```bash
export LAUNCH_KEY="launch_sk_..."
```

---

## Flow A — Local-only (server-side SDKs)

Best for: kicking the tires, diffing behavior against Launch before you sign up,
offline / air-gapped development. **Node and Go only.**

### 1. Run the migrator

```bash
qfg migrate --from launch --api-key $LAUNCH_KEY --dir ./quonfig-config
```

This pulls every flag, config, and segment from Launch and writes them into
`./quonfig-config/` as Quonfig workspace files. It also writes:

- `.qf/import-state.json` — the delta cursor, committed alongside the files
- `.qf/identifier-map.json` — a deterministic map of legacy keys to Quonfig keys
  (used by `qfg migrate my-code` later)
- `MIGRATION_REPORT.md` — counts, identifier map, anything lossy or unsupported,
  and a follow-up checklist split into "must fix before cutover" vs "review post-cutover"

**Always read `MIGRATION_REPORT.md` before you trust the output.** It is the
single source of truth for what was imported cleanly and what needs human eyes.

### 2. Point your SDK at the directory

**Node:**

```typescript
import { init } from '@quonfig/sdk';

const client = await init({
  datadir: './quonfig-config',
  environment: 'production',
});
```

**Go:**

```go
import "github.com/quonfig/sdk-go/quonfig"

client, err := quonfig.New(
    quonfig.WithDatadir("./quonfig-config"),
    quonfig.WithEnvironment("production"),
)
```

No API key, no network call — the SDK reads directly from the files the
migrator wrote.

### 3. Verify behavior matches Launch

Run your app locally against `./quonfig-config` and exercise the flags and
configs you care about. Compare the values against what Launch returns. Anything
surprising should already be flagged in `MIGRATION_REPORT.md`; if it is not,
that is a bug — file it on the `cli` repo.

### 4. Re-run to pick up deltas

Changes in Launch after the initial import? Re-run the same command:

```bash
qfg migrate --from launch --api-key $LAUNCH_KEY --dir ./quonfig-config
```

The cursor in `.qf/import-state.json` ensures only new changes are fetched.
Existing files are overwritten idempotently; the report reflects only the delta.

### 5. When you are ready, switch to Flow B

Sign up, create a workspace, then see [Flow B](#flow-b--cloud-push-all-sdks)
below for how to push `./quonfig-config` up to the cloud.

---

## Flow B — Cloud push (all SDKs)

Best for: browser SDK users (required), teams that want the Quonfig UI, and
anyone ready to operate Quonfig as their source of truth.

### 1. Sign up and log in

Create a workspace in the Quonfig UI, then authenticate the CLI:

```bash
qfg login
```

### 2. Run the migrator with `--push`

```bash
qfg migrate --from launch --api-key $LAUNCH_KEY --workspace acme-prod --push
```

The migrator:

1. Pulls from Launch into a scratch directory.
2. Clones your cloud workspace's git repo.
3. Applies the migrated data as new commits on top of existing history
   (**clone-and-stack**, not `push --mirror`).
4. Fast-forwards the push.

Clone-and-stack matters: it preserves any edits you made in the Quonfig UI
between migrator runs. If the cloud has diverged (same file edited in both
places), the push fails with a conflict rather than silently clobbering your UI
changes. See [Troubleshooting](./troubleshooting.md#i-ran-it-twice-and-got-a-merge-conflict).

### 3. Confirm in the UI

Open your workspace in app-quonfig. You should see every flag, config, and
segment from Launch. Click around, flip a flag, verify the history view shows
the migrator commit plus any edits you make.

### 4. Switch your SDK to read from the cloud

All three SDKs (Node, Go, browser JavaScript) connect to `api-delivery` over SSE
when initialized with a Quonfig SDK key. Browser customers: this is the only
supported option.

**Browser JavaScript:**

```javascript
import { init } from '@quonfig/sdk-javascript';

const client = await init({
  apiKey: process.env.QUONFIG_FRONTEND_SDK_KEY,
});
```

**Node / Go:** drop the `datadir` option and pass the SDK key instead. See
the [Node](../sdks/node/node.md) or [Go](../sdks/go.md) SDK docs.

### 5. Re-run to pick up deltas

Same command, same cursor. Clone-and-stack keeps UI edits intact:

```bash
qfg migrate --from launch --api-key $LAUNCH_KEY --workspace acme-prod --push
```

---

## Command reference

```
qfg migrate --from <source> [flags]
```

| Flag | Purpose |
| --- | --- |
| `--from <source>` | Required. `launch` is the supported source today; `launchdarkly` and `flagsmith` are stubbed. |
| `--api-key <key>` | Legacy-system API key. Also read from `LAUNCH_API_KEY`. |
| `--dir <path>` | Write to this local directory. Defaults to `./quonfig-config`. |
| `--workspace <slug>` | Push to a named cloud workspace. Requires `qfg login`. |
| `--push` | After migrating locally, push to the cloud workspace (Flow B). |
| `--dry-run` | Show what would happen; write nothing. |
| `--since <timestamp>` | Override the delta cursor. |
| `--reset` | Ignore the cursor and do a full re-import. |
| `--recent <N>` | Import only the last N changes (useful for smoke tests). |

### Force a full reimport

```bash
qfg migrate --from launch --api-key $LAUNCH_KEY --dir ./quonfig-config --reset
```

`--reset` ignores the cursor entirely; the identifier map is re-derived so your
code-migration output stays stable.

---

## What does not migrate automatically

Quonfig's schema differs from Launch in a few places. The full list lives in
`MIGRATION_REPORT.md` for your workspace, but expect to manually review:

- Custom context adapters that transform user attributes before evaluation
- Unusual rule shapes (nested OR/AND trees beyond two levels)
- Scheduled changes and experiments — out of scope for v1
- Identifier collisions on case-insensitive filesystems (the migrator fails
  loudly rather than silently clobbering)

---

## Next steps

- [Troubleshooting common issues](./troubleshooting.md)
- Migrate your call sites with `qfg migrate my-code` (Claude skill, see [CLI tool](../tools/cli.md))
- Swap your SDK: [Node](../sdks/node/node.md), [Go](../sdks/go.md), [JavaScript (browser)](../sdks/javascript.md)
