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
to read after every run is the **`MIGRATION_REPORT.md`** the migrator
writes into the workspace — see [Read the MIGRATION_REPORT.md](#read-the-migration_reportmd)
below.

Shipped in `qfg` 0.0.51.

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
You'll get a standalone Quonfig workspace git repo on disk that your
server-side SDK can read directly via `WithDatadir(...)` (or the
equivalent option). See
[from-launch](./from-launch.md#alternative-local-only-datadir-node--go-no-signup)
for the local-only flow — it works the same way with Flagsmith.

> **Browser-SDK note.** The local-only `--dir` flow only works for
> server-side SDKs (Node, Go). Browser apps must use the `--push` cloud
> flow because the browser SDK loads config over SSE from
> the delivery API and has no datadir mode. See
> [from-launch](./from-launch.md#warning-browser-sdk-limitation-read-this-first)
> for details.

---

## Get a Flagsmith API token

In the Flagsmith UI: **Account → API Keys**. Create a Management API
token (the personal-access-style token, not an environment or server-side
key). Read access is enough — the migrator never writes back to
Flagsmith.

Export it under any of these env vars (the CLI checks in order):

```bash
export FLAGSMITH_API_KEY="..."                # provider-specific (preferred)
# or
export QUONFIG_MIGRATE_API_KEY="..."          # generic, works for any source
```

Or pass `--source-api-key <token>` on the command line.

> Flagsmith Management API tokens authenticate via `Authorization: Token <token>`.
> The migrator handles this for you. Rate limits are per-token (default
> 500 req/min on the free tier); the migrator backs off and retries
> automatically.

### Find your project ID

Flagsmith projects are numeric. Find yours in the URL when you have the
project open in the dashboard:

```
https://app.flagsmith.com/project/38856/environments
                                  ^^^^^
```

Pass it as `--project 38856`, or set `FLAGSMITH_PROJECT_ID=38856`. There
is no implicit "default project" — Flagsmith requires you to be explicit.

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
git commits) is on the roadmap but not in v1. The MIGRATION_REPORT
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

## Read the `MIGRATION_REPORT.md`

**This is the most important step.** Every run writes a fresh
`MIGRATION_REPORT.md` at the root of the workspace directory. It is the
honest record of what came across cleanly and what needs human eyes.

Four things in particular need your attention before you flip an SDK
over:

1. **Users will be re-bucketed.** Flagsmith and Quonfig hash percentage
   rollouts with different salts. The rollout percentages on
   multivariate features are preserved exactly, but individual users
   will land in different buckets after cutover. The report lists every
   multivariate feature under a "users will be re-bucketed" heading —
   plan your comms accordingly.
2. **`enabled=false` on non-boolean features (D-F1).** Flagsmith serves
   your code's default for a disabled non-bool feature; Quonfig serves
   the *stored* value with a note. Each instance is named in the report
   so you can review whether the stored value is what you actually want.
3. **Skipped operators / rules.** Flagsmith's `MODULO` (D-F3) and
   segment-level `PERCENTAGE_SPLIT` (D-F4) have no Quonfig equivalent in
   v1. Each clause is listed by feature and reason so you can rebuild it
   by hand.
4. **Identity-trait references (D-F6).** Every segment condition
   property name your converter sees is summarised. Your SDK callers
   must include those attributes on the evaluation context, or matching
   rules will silently miss. The report tells you which segments
   reference which traits so you can audit your call sites.

The report also documents informational drops (paywalled
change-requests, scheduled-version drafts, identity-override
"individual targets") so nothing is silently lost.

### Point your coding agent at it

The fastest workflow:

```bash
claude "read MIGRATION_REPORT.md and tell me what I need to do before \
flipping the SDK to Quonfig"
```

The report is structured enough that an agent can summarise the
must-fix items and propose concrete edits to your remaining Flagsmith
call sites.

---

## What doesn't migrate cleanly

The full gap list lives in your workspace's `MIGRATION_REPORT.md`. The
short version, organised by disposition code (`D-F*`), so you can find
each one in the report:

- **D-F1 — `enabled=false` on non-boolean features.** Flagsmith would
  have served your code's default; Quonfig serves the stored value with
  a note. Bool features serve `false` (no surprise).
- **D-F2 — Identity > segment priority.** Identity overrides become a
  leading `PROP_IS_ONE_OF` rule on `user.key`, evaluated before any
  segment rules. Order matches Flagsmith's behavior; you lose the
  dedicated identities-pane UI affordance.
- **D-F3 — `MODULO` operator.** Skipped and reported. No Quonfig
  equivalent.
- **D-F4 — Segment-level `PERCENTAGE_SPLIT`.** Skipped and reported.
  Quonfig does percentage rollouts at the rule level, not the segment
  condition level.
- **D-F5 — Per-environment value-type divergence.** A feature whose
  envs disagree on type (`string` in Dev, `int` in Prod, etc.) is
  coerced to `string` and the divergence is named in the report.
- **D-F6 — Identity traits.** Flagsmith identity *traits* are runtime
  context the SDK sends — they have no server-side artifact to migrate.
  The report lists every trait referenced by a segment condition so you
  can audit your call sites.
- **D-F7 — Multivariate identity overrides.** Both pinning to a single
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

Each `qfg migrate` run overwrites `MIGRATION_REPORT.md` and re-asserts
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
- `--source-api-key <token>` (env: `FLAGSMITH_API_KEY` or
  `QUONFIG_MIGRATE_API_KEY`) — the Flagsmith Management API token.
- `--project <id>` (env: `FLAGSMITH_PROJECT_ID`) — required. The numeric
  Flagsmith project ID; find it in the project URL.

Run `qfg migrate --help` for live descriptions.

---

## Next steps

- [Troubleshooting common issues](./troubleshooting.md)
- Migrate your call sites — point your coding agent at
  `.qf/identifier-map.json` (the legacy → Quonfig key map the migrator
  writes) to rewrite Flagsmith SDK call sites.
- Swap your SDK: [Node](../sdks/node/node.md), [Go](../sdks/go.md),
  [JavaScript (browser)](../sdks/javascript.md)
