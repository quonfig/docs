---
title: From Flagsmith
sidebar_label: From Flagsmith
sidebar_position: 3
---

# Migrating from Flagsmith

`qfg migrate --from flagsmith` imports a Flagsmith project into a Quonfig
workspace. The current state of every feature, segment, and environment
is converted (modulo a small documented gap list, see below) and either
pushed to a hosted Quonfig workspace or written out as a standalone git
repo your own SDK can read.

This page is the quick-start. The companion artifact you actually need
to read after every run is the **`.qf/MIGRATION_REPORT.md`** the migrator
writes inside the workspace directory — see [Read the migration report](#read-the-migration-report)
below.

Use a current `qfg` (`npm install -g @quonfig/cli` installs or updates it).
If you migrated with the first Flagsmith release (0.0.51), re-run the
migration: that release imported value-less boolean features as empty
string flags.

---

## Quick start (the 3-command flow)

```bash
qfg login
qfg workspace create my-team --org my-org
qfg migrate --from flagsmith \
  --source-api-key $FLAGSMITH_API_KEY \
  --project 38856 \
  --push --workspace my-org/my-team \
  --dir ./my-quonfig-workspace
```

That's it. The migrator clones the hosted workspace into
`./my-quonfig-workspace`, pulls every feature and segment from the
Flagsmith project, converts them, validates the result client-side,
commits, and pushes.

**No cloud account?** Drop `--push` and `--workspace`, keep `--dir`.
You'll get a standalone Quonfig workspace git repo on disk that any
backend SDK (Node, Go, Python, Ruby, Java, .NET) can read directly through
its `datadir` option (`WithDataDir` in Go). See
[Local Workspace (datadir)](../explanations/concepts/local-workspace.md)
for how to point an SDK at it.

> **Browser-SDK note.** The browser SDKs (JavaScript, React, React Native)
> have no datadir mode. They fetch already-evaluated values over HTTP from
> the delivery API and poll for updates. To use them with a local-only
> workspace, serve the directory with [`qfg serve`](../how-tos/qfg-serve.md);
> otherwise use the `--push` cloud flow. See
> [Frontend SDKs](../explanations/concepts/frontend-sdks.md) for details.

The two flows side by side — same migration and the same git repo either
way; `--push` keeps that repo synced to a hosted workspace and adds
hosted delivery:

![Two ways to run the migration: free mode pulls Flagsmith into a git repo you own and your server-side SDK reads it from disk; cloud mode adds --push, syncing the repo to Quonfig Cloud, which streams updates to backend SDKs over SSE while browser SDKs fetch over HTTP and poll](/img/docs/migrating/flagsmith-two-modes.svg)

---

## Get a Flagsmith API token

In the Flagsmith dashboard, create an organisation API key for the
Management API (under API Keys in your organisation settings). Don't use
an environment key or a server-side SDK key. The migrator only reads from
Flagsmith; it never writes back.

Pass it with `--source-api-key <token>`, or export it:

```bash
export FLAGSMITH_API_KEY="..."
```

The CLI uses the first key it finds, in this order:

1. `--source-api-key`, or `QUONFIG_MIGRATE_API_KEY` (generic, works for any source)
2. `--api-key`, or `LAUNCH_API_KEY` (deprecated alias meant for the `launch`
   source; the CLI prints a warning when it is used with `--from flagsmith`)
3. `FLAGSMITH_API_KEY`

`FLAGSMITH_API_KEY` is the fallback, so a leftover
`QUONFIG_MIGRATE_API_KEY` or `LAUNCH_API_KEY` in your shell takes precedence
over it. Unset those, or pass `--source-api-key`, if they hold a key for a
different system.

> The migrator sends the key as `Authorization: Api-Key <token>` for you.
> When Flagsmith rate-limits a request (HTTP 429), the migrator backs off
> and retries automatically.

### Find your project ID

Flagsmith projects are numeric. Find yours in the URL when you have the
project open in the dashboard:

```
https://app.flagsmith.com/project/38856/environments
                                  ^^^^^
```

Pass it as `--project 38856`, or set `FLAGSMITH_PROJECT_ID=38856`. Always
set one of them: without either, the migrator falls back to project ID `1`,
which is almost certainly not your project.

---

## What happens during migration

The migrator pulls a full snapshot of the project per run: every feature
with its per-environment featurestate, every segment override and
identity (edge) override, the project-scoped segment pool, the tag pool,
and project metadata (`use_edge_identities`, etc.).

A typical project of ~500 features takes seconds to a couple of minutes.
The fetcher fans out per-environment and per-feature, but it canonicalises
weight order and other API quirks before handing data to the converter —
see [API quirks](#api-quirks-the-migrator-handles-for-you).

Phase-2 history backfill (replaying the Flagsmith audit log as per-feature
git commits) is on the roadmap but not in v1. The migration report
captures all the same dispositions either way.

### API quirks the migrator handles for you

You don't need to know any of these to use the migrator — they're listed
so you can sanity-check that what you see in the report matches your
expectations.

- **MV-option order** — Flagsmith's `/mv-options/` returns variations in
  reverse creation order; the migrator sorts by `id` ascending so
  variation order in your Quonfig file matches what you see in the
  Flagsmith dashboard.
- **MV identity-override weight order** — the Flagsmith server reorders
  override `multivariate_feature_state_values` after write, so
  idempotency must be presence-based; the converter canonicalises
  variation order before comparing.
- **Per-environment identity UUIDs** — edge identities have a different
  `identity_uuid` in each environment for the same `identifier`. The
  fetcher resolves per-environment.
- **Soft-deletes are invisible** — Flagsmith's public REST API hides
  soft-deleted features (a soft-delete looks identical to a hard-delete
  from the outside). The migrator literally cannot observe them and the
  report does not list them.

---

## Read the migration report {#read-the-migration-report}

**This is the most important step.** Every run writes a fresh
`.qf/MIGRATION_REPORT.md` inside the workspace directory (it lives under
`.qf/` so it is never pushed as workspace config). It is the honest record
of what came across cleanly and what needs human eyes.

Four things in particular need your attention before you flip an SDK
over:

1. **Users will be re-bucketed.** Flagsmith and Quonfig hash percentage
   rollouts with different salts. The rollout percentages on
   multivariate features are preserved exactly, but individual users
   will land in different buckets after cutover. The report lists every
   multivariate feature under a "users will be re-bucketed" heading —
   plan your comms accordingly.
2. **`enabled=false` on non-boolean features.** Flagsmith serves
   your code's default for a disabled non-bool feature; Quonfig serves
   the *stored* value with a note. Each instance is named in the report
   so you can review whether the stored value is what you actually want.
3. **Skipped operators / rules.** Flagsmith's `MODULO` and
   segment-level `PERCENTAGE_SPLIT` have no Quonfig equivalent in
   v1, and a `REGEX` condition whose pattern is outside
   [Quonfig regex v1](../explanations/features/rules-and-segmentation.md#quonfig-regex-v1)
   is skipped too. Each clause is listed by feature and reason so you can
   rebuild it by hand.
4. **Identity-trait references.** Every trait name used in a segment
   condition is listed. Your SDK callers
   must include those attributes on the evaluation context, or matching
   rules will silently miss. The report tells you which segments
   reference which traits so you can audit your call sites.

The report also documents informational drops (paywalled
change-requests, scheduled-version drafts, identity-override
"individual targets") so nothing is silently lost.

### Point your coding agent at it

The fastest workflow:

```bash
claude "read .qf/MIGRATION_REPORT.md and tell me what I need to do before \
flipping the SDK to Quonfig"
```

The report is structured enough that an agent can summarise the
must-fix items and propose concrete edits to your remaining Flagsmith
call sites.

---

## What doesn't migrate cleanly

The full gap list lives in your workspace's `.qf/MIGRATION_REPORT.md`,
grouped under its "Conversion notes" section. The short version:

- **`enabled=false` on non-boolean features.** Flagsmith would
  have served your code's default; Quonfig serves the stored value with
  a note. Bool features serve `false` (no surprise).
- **Identity > segment priority.** Identity overrides become a
  leading `PROP_IS_ONE_OF` rule on `user.key`, evaluated before any
  segment rules. Order matches Flagsmith's behavior; you lose the
  dedicated identities-pane UI affordance.
- **`MODULO` operator.** Skipped and reported. No Quonfig
  equivalent.
- **Segment-level `PERCENTAGE_SPLIT`.** Skipped and reported.
  Quonfig does percentage rollouts at the rule level, not the segment
  condition level.
- **Per-environment value-type divergence.** A feature whose
  envs disagree on type (`string` in Dev, `int` in Prod, etc.) is
  coerced to `string` and the divergence is named in the report.
- **Identity traits.** Flagsmith identity *traits* are runtime
  context the SDK sends — they have no server-side artifact to migrate.
  The report lists every trait referenced by a segment condition so you
  can audit your call sites.
- **`ANY` / `NONE` segment rules.** Quonfig criteria within one rule are
  AND-only, so segment rules of type `ANY` or `NONE` are skipped and
  reported.
- **Some `:semver` comparisons.** Semver `NOT_EQUAL`,
  `GREATER_THAN_INCLUSIVE`, and `LESS_THAN_INCLUSIVE` have no Quonfig
  semver equivalent and are skipped and reported. The other semver
  comparisons convert to Quonfig's semver operators.
- **Multivariate identity overrides.** Both pinning to a single
  variation and re-weighting the allocation are preserved.

### Plan-gated features the migrator cannot see

- **Change requests** — Approval-required write flows are a paid-tier
  feature; on free-tier orgs the API rejects creation. Anything sitting
  in a change-request workflow is invisible to the migrator and won't
  appear in the workspace.
- **Scheduled changes** — Scale-up plan only. Drafts scheduled in the
  future are invisible to free / start-up tier API tokens.
- **Soft-deleted features** — Hidden by the public REST API; the
  migrator cannot observe `deleted_at` tombstones (see "API quirks"
  above).

---

## Re-running

Each `qfg migrate` run overwrites `.qf/MIGRATION_REPORT.md` and re-asserts
the workspace state from the source. To experiment with different
conversions or compare runs side-by-side, create distinct workspaces
(e.g. `competitor-flagsmith-1`, `-2`) and migrate into each.

`--dry-run` summarises what would happen without writing anything —
handy for sanity-checking a fresh token and project ID before
committing to a real run.

---

## Command reference

The full flag list is shared with the other sources — see
[`from-launch` → Command reference](./from-launch.md#command-reference).
Flagsmith-specific notes:

- `--from flagsmith` selects this source.
- `--source-api-key <token>` (env: `QUONFIG_MIGRATE_API_KEY`, with
  `FLAGSMITH_API_KEY` as the fallback) — the Flagsmith Management API
  token. See [Get a Flagsmith API token](#get-a-flagsmith-api-token) for
  the full precedence.
- `--project <id>` (env: `FLAGSMITH_PROJECT_ID`) — the numeric Flagsmith
  project ID; find it in the project URL. Always set it: without it the
  migrator uses project ID `1`.

Run `qfg migrate --help` for live descriptions.

---

## Next steps

- [Troubleshooting common issues](./troubleshooting.md)
- Migrate your call sites. A Flagsmith feature name that isn't a valid
  Quonfig key (letters, numbers, `.`, `-`, `_`) is renamed. The
  "Rewritten keys (ACTION REQUIRED)" section of `.qf/MIGRATION_REPORT.md`
  lists each old and new key, and `.qf/key-map.json` has the same map in
  machine-readable form (written only when a key was renamed). Point
  your coding agent at the report to rewrite your Flagsmith SDK call
  sites.
- Swap your SDK. Backend: [Node](../sdks/node/node.md), [Go](../sdks/go.md),
  [Python](../sdks/python/python.md), [Ruby](../sdks/ruby.md),
  [Java](../sdks/java.md), [.NET](../sdks/dotnet.md). Frontend and mobile:
  [JavaScript (browser)](../sdks/javascript.md), [React](../sdks/react.md),
  [React Native](../sdks/react-native.md), [Swift](../sdks/swift.md).
