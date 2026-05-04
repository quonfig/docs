---
title: From Launch
sidebar_label: From Launch
sidebar_position: 1
---

# Migrating from Launch

`qfg migrate --from launch` pulls every flag, config, and segment out of a Launch
workspace and turns it into a Quonfig workspace — pushed up to a cloud workspace
you can edit in the Quonfig UI (the recommended path), or written as files on
disk that your SDK reads directly (the local-only alternative).

Re-runs are incremental: the migrator persists a cursor in `.qf/import-state.json`
and picks up only the changes made in Launch since the last run, so you can keep
both systems in sync while you cut over.

## :warning: Browser-SDK limitation (read this first)

**The local-only alternative only works for server-side SDKs.**

| SDK | Cloud (recommended) | Local-only datadir |
| --- | --- | --- |
| `sdk-node` | :white_check_mark: supported | :white_check_mark: supported (`WithDatadir`) |
| `sdk-go` | :white_check_mark: supported | :white_check_mark: supported (`WithDatadir`) |
| `sdk-javascript` (browser) | :white_check_mark: supported (SSE from `api-delivery`) | :x: **not supported** — browsers cannot read a local directory |

If your app ships to browsers via `sdk-javascript`, you **must** use the cloud
flow. The browser SDK loads configuration from `api-delivery` over SSE and has
no datadir mode — this is architectural, not a roadmap gap. Trying to point the
browser SDK at a local directory will not work.

---

## Prerequisites

- The `qfg` CLI installed (see [CLI tool](../tools/cli.md))
- A Launch API key with read access to the workspace you are migrating

Set the API key in your shell so you are not pasting it on the command line.
The CLI reads `LAUNCH_API_KEY` automatically when `--api-key` is omitted, so
**use that exact name** — `LAUNCH_KEY` (or any other variation) will not be picked up:

```bash
export LAUNCH_API_KEY="123-Development-Backend-a1b2c3d4-..."
```

---

## Migrate to Quonfig (recommended)

This is the path most teams take. It works for every SDK (Node, Go, browser
JavaScript), and the cloud workspace is what the Quonfig UI reads from.

### 1. Sign up at quonfig.com

Sign up at [quonfig.com](https://quonfig.com). Signup creates your **organization**
— this is the parent that owns your workspaces, your team members, and your
billing. You'll pick an org slug during signup (e.g. `acme-org`); it shows up in
every URL afterwards (`app.quonfig.com/<org-slug>/...`).

You only do this once. If your team already has an org, get yourself invited to
it instead of creating a new one.

### 2. Log in from the CLI

```bash
qfg login
```

This opens a browser, has you confirm the device, and saves a token per org you
belong to. When it finishes, login prints your default org slug **and the next
command to run** — copy that line, you'll use it in step 3:

```
Successfully logged in!
Logged in as: you@acme.com

No workspaces found in acme-org. Create one with: qfg workspace create <slug> --org acme-org
```

If you already have a workspace, login prints `Default workspace: acme-org/<slug>`
instead — skip to step 4.

### 3. Create the cloud workspace

A workspace is one logical config repo (most teams have one per product or one
per environment family). Pick a slug and run:

```bash
qfg workspace create acme-prod
```

The slug becomes the workspace's address: `acme-org/acme-prod`. You'll use that
`<org>/<slug>` pin in every other CLI command.

> **Multi-org users:** if you belong to more than one org, add
> `--org <org-slug>`. The login output in step 2 listed your org slugs. You can
> also see them on each org's settings page in the UI.

### 4. Migrate in one step

Point `--dir` at an empty directory or a path that does not exist yet — the
migrator will clone the workspace into it, apply the data, and push:

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY \
  --workspace acme-org/acme-prod \
  --dir ./quonfig-repo \
  --push
```

The `--workspace` value **must be in `org/slug` form** (`acme-org/acme-prod`,
not `acme-prod`). Bare slugs are rejected.

The migrator runs the same `qfg verify` checks the server-side `qfg-verify`
hook would run, **before** committing — so a bad migration fails locally with
a clear error rather than getting partway through a push and rolling back.

> **Why a single command (and not `migrate --dir` followed by `migrate --push`
> later)?** A two-step flow leaves the local directory as a `git init`'d repo
> with no remote. The second `--push` invocation cannot adopt that repo — it
> needs an empty path or a clone of the target Gitea repo. Running the
> single-command flow above avoids that trap. If you want to inspect the
> migrated files before pushing, run the same command without `--push` against
> a fresh `--dir`, then re-run with `--push` against a **different fresh empty
> path** (or `qfg pull --workspace acme-org/acme-prod --dir <new-empty>` first
> to seed the dir with the workspace's repo, then re-run with `--push`).

The migrator:

1. Clones your cloud workspace's git repo into `--dir`.
2. Pulls from Launch into the same directory; the cursor in
   `.qf/import-state.json` ensures re-runs only fetch new changes.
3. Applies the migrated data as new commits on top of existing history
   (**clone-and-stack**, not `push --mirror`).
4. Fast-forwards the push.

Clone-and-stack matters: it preserves any edits you made in the Quonfig UI
between migrator runs. If the cloud has diverged (same file edited in both
places), the push fails with a conflict rather than silently clobbering your UI
changes. See [Troubleshooting](./troubleshooting.md#i-ran-it-twice-and-got-a-merge-conflict).

The migrator also writes:

- `MIGRATION_REPORT.md` — counts, identifier map, anything lossy or unsupported,
  and a follow-up checklist split into "must fix before cutover" vs "review post-cutover"
- `.qf/identifier-map.json` — a deterministic map of legacy keys to Quonfig keys
  (used by `qfg migrate my-code` later)

**Always read `MIGRATION_REPORT.md` before you trust the output.** See
[What to expect in `MIGRATION_REPORT.md`](#what-to-expect-in-migration_reportmd)
below for the warnings most customers hit.

### 5. Confirm in the UI

Open your workspace in app-quonfig. You should see every flag, config, and
segment from Launch. Click around, flip a flag, verify the history view shows
the migrator commit plus any edits you make.

### 6. Mint an SDK key

Cloud reads require a Quonfig SDK key — `qfg login` does not create one for you.
Create one per environment:

```bash
qfg sdk-key create --environment production --type server --workspace acme-org/acme-prod
```

`--type server` for backend SDKs (Node, Go); `--type browser` for the JavaScript
browser SDK. The command prints the key once — store it in your secret manager
immediately, you cannot retrieve it again later.

### 7. Switch your SDK to read from the cloud

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

### 8. Re-run to pick up deltas

Same command, same cursor. Clone-and-stack keeps UI edits intact:

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY \
  --workspace acme-org/acme-prod \
  --dir ./quonfig-repo \
  --push
```

---

## Alternative: local-only datadir (Node + Go, no signup)

Best for: kicking the tires, diffing behavior against Launch before you sign up,
offline / air-gapped development. **Node and Go only — browser SDK users need
the cloud flow above.**

No signup, no `qfg login`, no SDK key — the migrator writes files to disk and
your SDK reads them directly.

### 1. Run the migrator

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY --dir ./quonfig-repo
```

This pulls every flag, config, and segment from Launch and writes them into
`./quonfig-repo/` as Quonfig workspace files, plus the same `MIGRATION_REPORT.md`,
`.qf/import-state.json`, and `.qf/identifier-map.json` described in step 4 above.

### 2. Verify the migrated workspace

```bash
cd ./quonfig-repo && qfg verify
```

`qfg verify` catches schema problems, malformed files, and identifier collisions
client-side — much faster than discovering them at SDK init time.

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

### 4. Re-run to pick up deltas

```bash
qfg migrate --from launch --api-key $LAUNCH_API_KEY --dir ./quonfig-repo
```

The cursor in `.qf/import-state.json` ensures only new changes are fetched.

### 5. When you are ready, switch to the cloud

Sign up and follow the [recommended cloud flow](#migrate-to-quonfig-recommended)
above. Use a fresh empty `--dir` for the cloud run — don't reuse the local-only
directory, since `--push` needs to clone the cloud workspace's git repo into it.

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
segment). Launch lets you migrate from Feature Flag to Config; for configs
that came into existence like this, Quonfig will only retain the config
history/audit trail. When the migrator sees this, it **keeps the
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
| `--push` | After migrating locally, push to the cloud workspace. Required to combine `--dir` and `--workspace`. |
| `--dry-run` | Show what would happen; write nothing. |
| `--since <timestamp>` | Override the delta cursor. |
| `--reset` | Ignore the cursor and do a full re-import. |
| `--recent <N>` | Import only the last N changes (useful for smoke tests). |

> `--dir` and `--workspace` are mutually exclusive **unless `--push` is also
> passed**. Use `--dir` alone for the local-only alternative, `--workspace`
> alone for an in-place cloud op, or all three (`--dir + --workspace + --push`)
> for the recommended cloud migration.

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

- Identifier collisions on case-insensitive filesystems (the migrator fails
  loudly rather than silently clobbering)

---

## Next steps

- [Troubleshooting common issues](./troubleshooting.md)
- Migrate your call sites — point your coding agent at `.qf/identifier-map.json` (the legacy → Quonfig key map the migrator writes alongside your workspace files) to rewrite Launch SDK call sites. `qfg migrate my-code` wraps this for Claude Code.
- Swap your SDK: [Node](../sdks/node/node.md), [Go](../sdks/go.md), [JavaScript (browser)](../sdks/javascript.md)
