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

**The local-only alternative only works for backend (server-side) SDKs.**

| SDK | Cloud (recommended) | Local-only datadir |
| --- | --- | --- |
| Backend SDKs: Node, Go, Python, Ruby, Java, .NET | :white_check_mark: supported (streams updates over SSE) | :white_check_mark: supported (for example `datadir` in Node, `WithDataDir` in Go) |
| Browser JavaScript (`@quonfig/javascript`) | :white_check_mark: supported (fetches over HTTP and polls) | :x: **not supported** — browsers cannot read a local directory |

If your app ships to browsers via `@quonfig/javascript`, you **must** use the
cloud flow. The browser SDK fetches already-evaluated values from the delivery
API over HTTP and polls for updates. It has no datadir mode — this is
architectural, not a roadmap gap. Trying to point the browser SDK at a local
directory will not work.

---

## Prerequisites

- The `qfg` CLI installed (see [CLI tool](../tools/cli.md))
- A Launch API key with read access to the workspace you are migrating

Set the API key in your shell so you are not pasting it on the command line.
The CLI reads `LAUNCH_API_KEY` automatically when `--source-api-key` is omitted, so
**use that exact name** — `LAUNCH_KEY` (or any other variation) will not be picked up.
`QUONFIG_MIGRATE_API_KEY` also works, and takes precedence over `LAUNCH_API_KEY`:

```bash
export LAUNCH_API_KEY="123-Development-Backend-a1b2c3d4-..."
```

---

## Migrate to Quonfig (recommended)

This is the path most teams take. It works for every SDK, backend and
frontend, and the cloud workspace is what the Quonfig UI reads from.

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
qfg migrate --from launch --source-api-key $LAUNCH_API_KEY \
  --workspace acme-org/acme-prod \
  --dir ./quonfig-repo \
  --push
```

The `--workspace` value **must be in `org/slug` form** (`acme-org/acme-prod`,
not `acme-prod`). Bare slugs are rejected.

The migrator runs the same `qfg verify` checks the workspace's server-side
validation hook would run, **before** committing — so a bad migration fails locally with
a clear error rather than getting partway through a push and rolling back.

> **Why a single command (and not `migrate --dir` followed by `migrate --push`
> later)?** A two-step flow leaves the local directory as a `git init`'d repo
> with no remote. The second `--push` invocation cannot adopt that repo — it
> needs an empty path or a clone of the workspace's git repo. Running the
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
places), the push is rejected rather than silently clobbering your UI
changes. See [Troubleshooting](./troubleshooting.md#my-push-was-rejected-the-remote-has-changes-we-do-not-have-locally).

The migrator also writes:

- `.qf/MIGRATION_REPORT.md` — counts, the identifier map, anything lossy or
  unsupported, and a follow-up checklist split into "must fix before cutover" vs
  "review post-cutover"
- `.qf/key-map.json` — only when the migrator had to rename keys: a
  machine-readable map of each renamed Launch key to its new Quonfig key

Both live in the hidden `.qf/` directory inside `--dir` (use `ls -a` to see it),
not at the workspace root. With `--push`, `.qf/` is committed to the workspace's
git repo along with your config files.

**Always read `.qf/MIGRATION_REPORT.md` before you trust the output.** See
[What to expect in the migration report](#what-to-expect-in-the-migration-report)
below for the warnings most customers hit.

### 5. Confirm in the UI

Open your workspace in the Quonfig app. You should see every flag, config, and
segment from Launch. Click around, flip a flag, verify the history view shows
the migrator commit plus any edits you make.

### 6. Mint an SDK key

Cloud reads require a Quonfig SDK key — `qfg login` does not create one for you.
Create one per environment:

```bash
qfg sdk-key create --name backend --environment production --type server --workspace acme-org/acme-prod
```

`--name` is required; it labels the key in the key list (for example, the service
that uses it). Use `--type server` for backend SDKs and `--type browser` for
frontend SDKs such as browser JavaScript. The command prints the key once — store it in your secret manager
immediately, you cannot retrieve it again later.

### 7. Switch your SDK to read from the cloud

Initialized with a Quonfig SDK key, backend SDKs fetch config from the delivery
API and stream updates over SSE; the browser SDK fetches over HTTP and polls.
The SDK key selects the environment, so don't pass an `environment` option in
this mode — it is ignored, and the SDK logs a warning. In Node and browser
JavaScript the init option is named **`sdkKey`**, not `apiKey`: without an SDK
key, the Node SDK refuses to start with a "requires an SDK key" error.

**Node:**

```typescript
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY,
});
await quonfig.init();
```

**Browser JavaScript:**

```javascript
import { quonfig } from "@quonfig/javascript";

await quonfig.init({
  sdkKey: "<your-frontend-sdk-key>",
  context: { user: { key: "user-123" } },
});
quonfig.poll({ frequencyInMs: 60_000 });
```

Browser code has no `process.env`, so inject the frontend key at build time or
from your page config. See the [JavaScript SDK docs](../sdks/javascript.md).

**Go:**

```go
import quonfig "github.com/quonfig/sdk-go/v2"

client, err := quonfig.NewClient(
    quonfig.WithSdkKey(os.Getenv("QUONFIG_BACKEND_SDK_KEY")),
)
```

That is the local-only snippet below with `WithDataDir(...)` and `WithEnvironment(...)`
dropped. See the [Go SDK docs](../sdks/go.md).

For other SDKs, see [Python](../sdks/python/python.md), [Ruby](../sdks/ruby.md),
[Java](../sdks/java.md) and [.NET](../sdks/dotnet.md).

> **On staging or a custom domain?** Production customers on `quonfig.com` are
> the default and need nothing extra. Staging or self-hosted customers must point
> the SDK at their domain: set `QUONFIG_DOMAIN=your-domain.com` in the
> environment (backend SDKs), or pass a `domain` option where the SDK has one
> (for example `domain: "your-domain.com"` in Node and browser JavaScript). The SDK derives its API,
> stream and telemetry URLs from that domain. Without it, the SDK will try to
> reach `quonfig.com` and you will see connection failures.

### 8. Re-run to pick up deltas

Same command, same cursor. Clone-and-stack keeps UI edits intact:

```bash
qfg migrate --from launch --source-api-key $LAUNCH_API_KEY \
  --workspace acme-org/acme-prod \
  --dir ./quonfig-repo \
  --push
```

---

<a id="alternative-local-only-datadir-node--go-no-signup"></a>

## Alternative: local-only datadir (backend SDKs, no signup)

Best for: kicking the tires, diffing behavior against Launch before you sign up,
offline / air-gapped development. **Backend SDKs only (Node, Go, Python, Ruby,
Java, .NET) — browser SDK users need the cloud flow above.**

No signup, no `qfg login`, no SDK key — the migrator writes files to disk and
your SDK reads them directly.

### 1. Run the migrator

```bash
qfg migrate --from launch --source-api-key $LAUNCH_API_KEY --dir ./quonfig-repo
```

This pulls every flag, config, and segment from Launch and writes them into
`./quonfig-repo/` as Quonfig workspace files, plus the same `.qf/MIGRATION_REPORT.md`,
`.qf/import-state.json`, and (if any keys were renamed) `.qf/key-map.json`
described in step 4 above.

### 2. Verify the migrated workspace

```bash
cd ./quonfig-repo && qfg verify
```

`qfg verify` catches schema problems, malformed files, and identifier collisions
client-side — much faster than discovering them at SDK init time.

### 3. Point your SDK at the directory

**Node:**

```typescript
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  datadir: "./quonfig-repo",
  environment: "production",
});
await quonfig.init();
```

**Go:**

```go
import quonfig "github.com/quonfig/sdk-go/v2"

client, err := quonfig.NewClient(
    quonfig.WithDataDir("./quonfig-repo"),
    quonfig.WithEnvironment("production"),
)
```

`environment` is required in datadir mode and is case-sensitive: use the
environment name exactly as it appears in the workspace. Python, Ruby, Java and
.NET have the same mode; see the SDK's own page and
[Local workspace](../explanations/concepts/local-workspace.md).

No SDK key and no config fetch — the SDK reads directly from the files the
migrator wrote. (If an SDK key is also set, telemetry is still sent; see
[Local workspace](../explanations/concepts/local-workspace.md).)

### 4. Re-run to pick up deltas

```bash
qfg migrate --from launch --source-api-key $LAUNCH_API_KEY --dir ./quonfig-repo
```

The cursor in `.qf/import-state.json` ensures only new changes are fetched.

### 5. When you are ready, switch to the cloud

Sign up and follow the [recommended cloud flow](#migrate-to-quonfig-recommended)
above. Use a fresh empty `--dir` for the cloud run — don't reuse the local-only
directory, since `--push` needs to clone the cloud workspace's git repo into it.

---

## What to expect in the migration report

`.qf/MIGRATION_REPORT.md` is the source of truth for what came across cleanly and
what needs human eyes. Two warnings show up in nearly every real migration —
both are normal, but you should know what they mean before you panic:

- **Dropped override sections.** Launch stores environment-specific overrides on
  each flag/config. If the referenced environment was archived or deleted in
  Launch, the migrator drops the override rather than inventing a target. See
  [Troubleshooting: dropped override sections](./troubleshooting.md#i-got-a-warning-about-dropped-override-sections).
- **Resolved cross-type duplicates.** Quonfig keys are unique across configs,
  flags and segments. When a Launch key exists as more than one type (for
  example, a flag that was converted to a config), the migrator keeps the config
  and drops the others. See
  [Troubleshooting: resolved cross-type duplicates](./troubleshooting.md#i-got-a-warning-about-resolved-cross-type-duplicates).

---

## Command reference

```
qfg migrate --from <source> [flags]
```

| Flag | Purpose |
| --- | --- |
| `--from <source>` | Required. `launch`, `launchdarkly`, and `flagsmith` are supported. |
| `--source-api-key <key>` | API key for the source system. Also read from `QUONFIG_MIGRATE_API_KEY`, then from the per-source variable (`LAUNCH_API_KEY` for Launch). |
| `--api-key <key>` | **Deprecated** alias for `--source-api-key`, kept for `--from launch`. Also read from `LAUNCH_API_KEY`. `--source-api-key` wins if both are set. |
| `--dir <path>` | Write to this local directory. Defaults to `./quonfig-repo` when cwd is not already a Quonfig workspace. |
| `--workspace <org/slug>` | Cloud workspace to operate on. **Must be `org/slug` form** (e.g. `acme-org/acme-prod`); bare slugs are rejected. Requires `qfg login`. |
| `--push` | After migrating locally, push to the cloud workspace. Required to combine `--dir` and `--workspace`. |
| `--dry-run` | Show what would happen; write nothing. |
| `--since <timestamp>` | Override the delta cursor. |
| `--reset` | Ignore the cursor and do a full re-import. |
| `--recent <N>` | Import only the last N changes (useful for smoke tests). |
| `--strict-keys` | Refuse to migrate if any Launch key would need renaming to meet Quonfig key rules, instead of renaming it. Use when you need byte-identical keys. |
| `--full-summary` | Turn the full Launch audit log into one git commit per change (original author, timestamp and summary). First-run imports only; combine with `--reset` into a fresh directory to redo an existing import. Can't be combined with `--recent`. |

> `--dir` and `--workspace` are mutually exclusive **unless `--push` is also
> passed**. Use `--dir` alone for the local-only alternative, `--workspace`
> alone for an in-place cloud op, or all three (`--dir + --workspace + --push`)
> for the recommended cloud migration.

### Force a full reimport

```bash
qfg migrate --from launch --source-api-key $LAUNCH_API_KEY --dir ./quonfig-repo --reset
```

`--reset` ignores the cursor entirely. Keys the migrator renamed on earlier runs
keep the same Quonfig names, so your code does not need to change again.

---

## What does not migrate automatically

Quonfig's schema differs from Launch in a few places. The full list for your
workspace lives in `.qf/MIGRATION_REPORT.md`. These sections need action from you
when they appear:

- **Rewritten keys (ACTION REQUIRED).** Keys Quonfig does not allow verbatim, or
  that collide with another key (including keys that differ only in case), are
  renamed. Update your code to look up the new key; `.qf/key-map.json` lists every
  rename. Pass `--strict-keys` to refuse instead of renaming.
- **Users will be re-bucketed.** Launch and Quonfig hash users into buckets
  differently. Rollout percentages are preserved, but which users land in which
  bucket changes after cutover. Plan for it before you switch.
- **Coerced sentinel rule values.** Rule values Launch left as "no value set yet"
  are converted to a concrete served value. Check each one.
- **Skipped invalid configs.** Configs with structurally invalid source data are
  not migrated. Fix them in Launch and re-run. See
  [Troubleshooting: skipped invalid configs](./troubleshooting.md#i-got-a-warning-about-skipped-invalid-configs).
- **Lossy mapping list** and **Unsupported feature list.** Launch features that
  came across with changes, or not at all.

---

## Next steps

- [Troubleshooting common issues](./troubleshooting.md)
- Migrate your call sites — point your coding agent at `.qf/MIGRATION_REPORT.md` (its identifier map and "Rewritten keys" section) and, if present, `.qf/key-map.json` to rewrite Launch SDK call sites to Quonfig keys.
- Swap your SDK: [Node](../sdks/node/node.md), [Go](../sdks/go.md), [Python](../sdks/python/python.md), [Ruby](../sdks/ruby.md), [Java](../sdks/java.md), [.NET](../sdks/dotnet.md), [JavaScript (browser)](../sdks/javascript.md)
