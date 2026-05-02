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
- For Flow B: a Quonfig account. Run `qfg login` first.

Set the API key in your shell so you are not pasting it on the command line.
The CLI reads `LAUNCH_API_KEY` automatically when `--api-key` is omitted, so
**use that exact name** — `LAUNCH_KEY` (or any other variation) will not be picked up:

```bash
export LAUNCH_API_KEY="123-Development-Backend-a1b2c3d4-..."
```

Real Launch keys look like `<NUM>-<EnvName>-<Role>-<UUID>` (e.g.
`456-Production-Backend-9f8e7d6c-...`). The legacy `launch_sk_` prefix is
no longer issued.

---

## Flow A — Local-only (server-side SDKs)

Best for: kicking the tires, diffing behavior against Launch before you sign up,
offline / air-gapped development. **Node and Go only.**

### 1. Run the migrator

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY --dir ./quonfig-repo
```

This pulls every flag, config, and segment from Launch and writes them into
`./quonfig-repo/` as Quonfig workspace files. It also writes:

- `.qf/import-state.json` — the delta cursor, committed alongside the files
- `.qf/identifier-map.json` — a deterministic map of legacy keys to Quonfig keys
  (used by `qfg migrate my-code` later)
- `MIGRATION_REPORT.md` — counts, identifier map, anything lossy or unsupported,
  and a follow-up checklist split into "must fix before cutover" vs "review post-cutover"

**Always read `MIGRATION_REPORT.md` before you trust the output.** See
[What to expect in `MIGRATION_REPORT.md`](#what-to-expect-in-migration_reportmd)
below for the warnings most customers hit.

### 2. Verify the migrated workspace

Before pointing your SDK at it, ask the CLI to validate the directory:

```bash
cd ./quonfig-repo && qfg verify
```

`qfg verify` catches schema problems, malformed files, and identifier collisions
client-side — much faster than discovering them at SDK init time or on a `--push`.

### 3. Point your SDK at the directory

**Node:**

```typescript
import { init } from '@quonfig/sdk';

const client = await init({
  datadir: './quonfig-repo',
  environment: 'production',
});
```

**Go:**

```go
import "github.com/quonfig/sdk-go/quonfig"

client, err := quonfig.New(
    quonfig.WithDatadir("./quonfig-repo"),
    quonfig.WithEnvironment("production"),
)
```

No API key, no network call — the SDK reads directly from the files the
migrator wrote.

### 4. Verify behavior matches Launch

Run your app locally against `./quonfig-repo` and exercise the flags and
configs you care about. Compare the values against what Launch returns. Anything
surprising should already be flagged in `MIGRATION_REPORT.md`; if it is not,
that is a bug — file it on the `cli` repo.

### 5. Re-run to pick up deltas

Changes in Launch after the initial import? Re-run the same command:

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY --dir ./quonfig-repo
```

The cursor in `.qf/import-state.json` ensures only new changes are fetched.
Existing files are overwritten idempotently; the report reflects only the delta.

### 6. When you are ready, switch to Flow B

Sign up, then see [Flow B](#flow-b--cloud-push-all-sdks) below for how to push
`./quonfig-repo` up to the cloud.

---

## Flow B — Cloud push (all SDKs)

Best for: browser SDK users (required), teams that want the Quonfig UI, and
anyone ready to operate Quonfig as their source of truth.

### 1. Sign up and log in

Sign up at [quonfig.com](https://quonfig.com), then authenticate the CLI:

```bash
qfg login
```

### 2. Create the cloud workspace

The CLI does not auto-create the workspace on first push — create it explicitly
so you control the slug and the owning org:

```bash
qfg workspace create acme-prod --org acme-org
```

`--org` accepts an org slug or UUID. The slug you pass becomes the workspace
slug; combined with the org, the workspace is addressable as `acme-org/acme-prod`
in every other CLI command.

### 3. Migrate locally

Run the migrator pointed at a local directory first (no `--push` yet):

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY --dir ./quonfig-repo
```

### 4. Verify the migrated workspace

```bash
cd ./quonfig-repo && qfg verify
```

This catches schema and structural problems before the cloud sees them. Skipping
verify means a bad migration becomes a failed `--push` (or worse, a successful
push of broken data).

### 5. Push to the cloud workspace

From the parent directory, re-run with `--workspace`, `--dir`, and `--push`:

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY \
  --workspace acme-org/acme-prod \
  --dir ./quonfig-repo \
  --push
```

The `--workspace` value **must be in `org/slug` form** (`acme-org/acme-prod`,
not `acme-prod`). Bare slugs are rejected.

`--dir` and `--workspace` are mutually exclusive **unless `--push` is also
passed** — `--push` is what tells the CLI you want both a local copy and a cloud
target. Drop one of the flags if you do not need the local copy.

The migrator:

1. Pulls from Launch into the local directory (the cursor in
   `.qf/import-state.json` ensures the second pull is a no-op if nothing changed
   since step 3).
2. Clones your cloud workspace's git repo.
3. Applies the migrated data as new commits on top of existing history
   (**clone-and-stack**, not `push --mirror`).
4. Fast-forwards the push.

Clone-and-stack matters: it preserves any edits you made in the Quonfig UI
between migrator runs. If the cloud has diverged (same file edited in both
places), the push fails with a conflict rather than silently clobbering your UI
changes. See [Troubleshooting](./troubleshooting.md#i-ran-it-twice-and-got-a-merge-conflict).

### 6. Confirm in the UI

Open your workspace in app-quonfig. You should see every flag, config, and
segment from Launch. Click around, flip a flag, verify the history view shows
the migrator commit plus any edits you make.

### 7. Mint an SDK key

Cloud reads require a Quonfig SDK key — `qfg login` does not create one for you.
Create one per environment:

```bash
qfg sdk-key create --environment production --type server --workspace acme-org/acme-prod
```

`--type server` for backend SDKs (Node, Go); `--type browser` for the JavaScript
browser SDK. The command prints the key once — store it in your secret manager
immediately, you cannot retrieve it again later.

### 8. Switch your SDK to read from the cloud

All three SDKs (Node, Go, browser JavaScript) connect to `api-delivery` over SSE
when initialized with a Quonfig SDK key. The init option is named **`sdkKey`**
(not `apiKey` — `apiKey` will be silently ignored and the SDK will fail to
authenticate with a 401).

**Node:**

```typescript
import { init } from '@quonfig/sdk';

const client = await init({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
  environment: 'production',
});
```

**Browser JavaScript:**

```javascript
import { init } from '@quonfig/sdk-javascript';

const client = await init({
  sdkKey: process.env.QUONFIG_FRONTEND_SDK_KEY,
});
```

**Go:** see the [Go SDK docs](../sdks/go.md) — pass the SDK key via
`quonfig.WithSdkKey(...)` and drop `WithDatadir(...)`.

> **On staging or a custom domain?** Production customers on `quonfig.com` are
> the default and need nothing extra. Staging or self-hosted customers must also
> pass `domain: "your-domain.com"` (e.g. `domain: "quonfig-staging.com"`). The
> SDK derives api / SSE / telemetry URLs from `domain`. Without it, the SDK will
> try to reach `quonfig.com` and you will see connection failures.

### 9. Re-run to pick up deltas

Same command, same cursor. Clone-and-stack keeps UI edits intact:

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY \
  --workspace acme-org/acme-prod \
  --dir ./quonfig-repo \
  --push
```

---

## What to expect in `MIGRATION_REPORT.md`

`MIGRATION_REPORT.md` is the source of truth for what came across cleanly and
what needs human eyes. Two warnings show up in nearly every real migration —
both are normal, but you should know what they mean before you panic:

### Dropped override sections

Reforge stores environment-specific overrides on each flag/config. If a
referenced environment has been **archived or deleted in Launch**, the migrator
drops the override section rather than silently inventing a target. These are
listed under "Dropped override sections" in the report.

This is intentional — the override has no live home in Launch either. If you
want to keep it, restore the missing environment in Launch and re-run the
migrator with `--reset` to re-import that workspace from scratch.

### Cross-type key collisions

Quonfig requires globally-unique keys across all types (config, feature_flag,
segment). Reforge does not — the same key can exist as both a config and a
feature_flag at the same time. When the migrator sees this, it **keeps the
config side and deletes the others**, recorded under "Resolved cross-type
duplicates" in the report.

Review each entry and rename the loser in Launch (or accept the resolution and
move on). If you do nothing, the next run will resolve the same collision the
same way.

---

## Command reference

```
qfg migrate --from <source> [flags]
```

| Flag | Purpose |
| --- | --- |
| `--from <source>` | Required. `launch` is the supported source today; `launchdarkly` and `flagsmith` are stubbed. |
| `--api-key <key>` | Legacy-system API key. Also read from `LAUNCH_API_KEY`. |
| `--dir <path>` | Write to this local directory. Defaults to `./quonfig-repo` when cwd is not already a Quonfig workspace. |
| `--workspace <org/slug>` | Cloud workspace to operate on. **Must be `org/slug` form** (e.g. `acme-org/acme-prod`); bare slugs are rejected. Requires `qfg login`. |
| `--push` | After migrating locally, push to the cloud workspace (Flow B). Required to combine `--dir` and `--workspace`. |
| `--dry-run` | Show what would happen; write nothing. |
| `--since <timestamp>` | Override the delta cursor. |
| `--reset` | Ignore the cursor and do a full re-import. |
| `--recent <N>` | Import only the last N changes (useful for smoke tests). |

> `--dir` and `--workspace` are mutually exclusive **unless `--push` is also
> passed**. Use `--dir` alone for Flow A, `--workspace` alone for an in-place
> cloud op, or all three (`--dir + --workspace + --push`) for Flow B.

### Force a full reimport

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY --dir ./quonfig-repo --reset
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
