---
title: Open Source / Fully Local
sidebar_label: Open Source (No Account)
---

Quonfig is, at its core, a folder of JSON files in a git repo. You can use the
whole system — feature flags, configs, segments, type-safe SDK clients — with
**no Quonfig account, no API key, and no network connection**. This page walks
through that path end-to-end.

## What you get without an account

- `qfg init` — scaffold a workspace (git repo + the right directory layout)
- `qfg verify` — validate every JSON file against the schema and the
  cross-file rules (filename = key, no duplicate keys, segment refs resolve,
  etc.)
- `qfg generate` — emit TypeScript clients with type-safe accessors for every
  config in the workspace
- `qfg config-schema` — print the canonical config schema for AI agents and
  editor tooling
- `qfg migrate` — import flags from LaunchDarkly, Flagsmith, etc.
- Every Quonfig SDK can be pointed at a local directory (`datadir`) and will
  evaluate flags entirely from local files, with no SSE connection, no API
  fetch, and no telemetry POSTs.

## What you don't get without an account

These commands talk to `app.quonfig.com` and **require `qfg login`**:

- `qfg push` / `qfg pull` — sync with hosted Gitea (you can use plain `git` instead)
- `qfg create` / `qfg delete` / `qfg list` / `qfg get` / `qfg info` — server-backed CRUD
- `qfg set-default` / `qfg set-rollout` / `qfg override` — server-backed mutations
- The hosted UI at `app.quonfig.com`, real-time SSE delivery, evaluation
  telemetry, and audit history

If you want any of that later, sign up for an account and your existing repo
will work — none of the local files change shape.

## The mental model

```
your-repo/
├── quonfig.json          # workspace metadata (environments, etc.)
├── feature-flags/        # one JSON file per feature flag
├── configs/              # one JSON file per dynamic config value
├── segments/             # audience segments referenced by flags
├── log-levels/           # dynamic log-level configs
└── schemas/              # JSON Schemas configs can be validated against
```

The filename (minus `.json`) is the config key. The SDK reads this directory,
evaluates rules in memory, and returns values. Nothing else is required.

## Step by step

### 1. Initialize the workspace

```bash
npm install -g @quonfig/cli
mkdir my-config && cd my-config
qfg init --samples
```

`qfg init` is fully offline. It creates a git repo, lays down the directory
structure, writes a `quonfig.json`, installs a `qfg verify` pre-commit hook,
and (with `--samples`) drops in one example of each type so you have something
working to copy from.

There is no `qfg login` step. You'll never be asked for credentials.

### 2. Edit a flag

Open `feature-flags/example.dark-mode.json` (created by `--samples`) and read
the shape. To make a new flag, copy the file and edit it:

```json
{
  "$schema": "https://api.quonfig.com/schemas/v1/stored-config.json",
  "key": "checkout.new-flow",
  "type": "feature_flag",
  "valueType": "bool",
  "default": {
    "rules": [
      { "criteria": [{ "operator": "ALWAYS_TRUE" }], "value": { "type": "bool", "value": false } }
    ]
  },
  "environments": [],
  "variants": []
}
```

Rules apply: the filename (without `.json`) must match the `key` field
exactly, and it must live in the directory matching its `type`.

The `$schema` URL is fetched once by your editor's LSP for autocomplete; the
CLI and SDK don't need it. You can also generate a local copy with
`qfg config-schema > schema.json` if you want to be fully offline including
your editor.

### 3. Validate

```bash
qfg verify
```

This runs locally — no network. The git pre-commit hook installed by
`qfg init` calls it automatically, so a broken JSON file can't slip in.

### 4. Generate typed SDK code

```bash
# react-ts by default; --targets node-ts for server
qfg generate --targets node-ts -o ./generated
```

When `qfg generate` is run inside a workspace directory (one containing
`quonfig.json`), it auto-detects the local workspace and reads the JSON
files directly. **No login needed.** You can also be explicit with
`--dir ./path/to/workspace`.

### 5. Point your SDK at the directory

Every SDK supports a `datadir` (or `datafile`) option. With `datadir` set and
no `sdkKey`, the SDK runs in fully local mode: no SSE, no telemetry, no API
fetches. See the [Next.js + TypeScript tutorial](/docs/tutorials/nextjs-typescript-local)
for a complete walkthrough.

```ts
// lib/quonfig.ts
import { Quonfig } from "@quonfig/node";
import path from "node:path";

export const quonfig = new Quonfig({
  datadir: path.join(process.cwd(), "my-config"),
  environment: process.env.QUONFIG_ENVIRONMENT ?? "development",
  enableSSE: false,
  fallbackPollEnabled: false,
});

await quonfig.init();
```

If you want the SDK to pick up edits to the datadir without restarting the
process, see [Auto-reload on file changes](#auto-reload-on-file-changes) below.

### 6. Use plain git for distribution

Your `my-config` directory is a regular git repo. Push it to GitHub, GitLab,
self-hosted Gitea, an S3 bucket, anywhere. Your build pulls the latest before
`npm run build` and embeds it via `datadir`. That's the whole deployment loop.

## Auto-reload on file changes

When the SDK is pointed at a `datadir`, you can opt it into watching that
directory and re-loading configs in process as soon as a file changes — no
restart needed. This is **off by default**: you must explicitly turn it on.

### What it does

The SDK registers a filesystem watcher on the `datadir`. When a `.json` file
is added, changed, or removed, the SDK re-reads the directory, re-parses the
new state, and atomically swaps it into the live evaluator. In-flight
evaluations finish against the old state; new evaluations see the new state.

Semantics worth knowing:

- **Debounced (~200ms).** A burst of writes (e.g. `git pull` rewriting many
  files at once) coalesces into a single reload.
- **Parse-then-swap.** If the new state fails to parse — a malformed JSON file
  mid-edit, a broken schema, etc. — the SDK logs the error and keeps serving
  the previous good state. A typo in your editor will never poison the running
  config.
- **Clean shutdown.** The watcher stops when the client shuts down; there are
  no leaked file descriptors or background threads on `client.close()` / equivalent.

### How to enable

<Tabs groupId="lang">
<TabItem value="node" label="Node">

```ts
import { Quonfig } from "@quonfig/node";

const quonfig = new Quonfig({
  datadir: "./my-config",
  dataDirAutoReload: true,
});
await quonfig.init();
```

</TabItem>
<TabItem value="go" label="Go">

```go
import "github.com/quonfig/sdk-go/pkg/quonfig"

client, err := quonfig.NewClient(
    quonfig.WithDataDir("./my-config"),
    quonfig.WithDataDirAutoReload(true),
)
```

</TabItem>
<TabItem value="ruby" label="Ruby">

```ruby
Quonfig.init(
  Quonfig::Options.new(
    datadir: "./my-config",
    data_dir_auto_reload: true,
  )
)
```

</TabItem>
<TabItem value="python" label="Python">

```python
from quonfig import Options, Client

client = Client(Options(
    datadir="./my-config",
    data_dir_auto_reload=True,
))
```

</TabItem>
<TabItem value="java" label="Java">

```java
import cloud.quonfig.client.Options;
import cloud.quonfig.client.QuonfigCloudClient;

var client = new QuonfigCloudClient(
    Options.builder()
        .datadir("./my-config")
        .dataDirAutoReload(true)
        .build()
);
```

</TabItem>
</Tabs>

### When to enable it

- **Local development** with the `datadir` checked out from git — edit a JSON
  file, save, see the new value on the next evaluation without bouncing your
  dev server.
- **Self-hosted servers** where you `git pull` the `datadir` on a schedule
  (cron, systemd timer, etc.) — auto-reload turns each pull into a live config
  update.
- **CI jobs** that mutate the `datadir` mid-run — useful for tests that want
  to flip a flag and observe the system without re-initializing the SDK.

### When NOT to enable it

- **Read-only / immutable filesystems** — many container images, AWS Lambda,
  and similar sandboxes don't allow registering inotify (or equivalent)
  watchers. The SDK degrades gracefully if registration fails (you keep your
  initial datadir snapshot), but you're paying initialization cost for nothing.
- **Build-time-embedded workflows** — if your `datadir` is bundled into the
  image at build time and never changes at runtime, there's nothing to watch.
- **Performance-sensitive production paths** where you'd rather control reload
  timing explicitly — e.g. via a deploy that restarts the process, or via SSE
  delivery from a hosted Quonfig account.

### Default

Off. The watcher is never registered unless `dataDirAutoReload` (or its
language equivalent) is explicitly set to `true`.

### Fork-safety (Ruby)

Forking servers like Puma and Unicorn need an extra hook to re-initialize the
Quonfig client (and its file watcher) per worker. See the
[Puma & Unicorn notes in the Ruby SDK docs](/docs/sdks/ruby#special-considerations-with-forking-servers-like-puma--unicorn-that-use-workers).

## Working with AI agents

`qfg init` writes `CLAUDE.md` and `AGENTS.md` into the workspace explicitly
telling agents:

- Edit JSON files directly — do **not** run `qfg create`, `qfg set-default`,
  `qfg push`, or anything else that talks to a hosted server.
- Always run `qfg verify` after a change.
- Look at sibling files for the canonical shape; run `qfg config-schema` to
  confirm field names, operator enums, and value-type shapes before writing a
  new config.

Point your agent at the workspace directory and it has everything it needs.

## When to upgrade to a hosted account

The fully-local path covers a lot of ground. You'll want to add a Quonfig
account when you want one or more of:

- **A UI** for non-engineers to flip flags
- **Real-time delivery** — SSE pushes config updates to running services in
  milliseconds, with HTTP fallback
- **Evaluation telemetry** — see which flags are getting evaluated, by which
  contexts, and what they're returning
- **Audit history** — a server-side log of every change
- **Multi-environment access control** — protected envs, per-env permissions

Adding an account doesn't break the local path. The repo shape is identical;
`qfg push` just publishes it.
