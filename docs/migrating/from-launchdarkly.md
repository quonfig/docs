---
title: From LaunchDarkly
sidebar_label: From LaunchDarkly
sidebar_position: 2
---

# Migrating from LaunchDarkly

`qfg migrate --from launchdarkly` imports a LaunchDarkly project into a
Quonfig workspace. The current state of every flag, segment, and environment
is converted losslessly (modulo a small documented gap list, see below) and
either pushed to a hosted Quonfig workspace or written out as a standalone
git repo your own SDK can read.

This page is the quick-start. The companion artifact you actually need to
read after every run is the **`MIGRATION_REPORT.md`** the migrator writes
into the workspace — see [Read the MIGRATION_REPORT.md](#read-the-migration_reportmd)
below.

Shipped in `qfg` 0.0.49.

---

## Quick start (the 3-command flow)

```bash
qfg login
qfg workspace create my-team --org my-org
qfg migrate --from launchdarkly \
  --source-api-key $LAUNCHDARKLY_API_KEY \
  --push --workspace my-org/my-team \
  --dir ./my-quonfig-workspace
```

That's it. The migrator clones the hosted workspace into `./my-quonfig-workspace`,
pulls every flag and segment from LaunchDarkly, converts them, validates the
result client-side, commits, and pushes.

**No cloud account?** Drop `--push` and `--workspace`, keep `--dir`. You'll
get a standalone Quonfig workspace git repo on disk that your server-side SDK
can read directly via `WithDatadir(...)` (or the equivalent option). See
[from-launch](./from-launch.md#alternative-local-only-datadir-node--go-no-signup)
for the local-only flow — it works the same way with LaunchDarkly.

> **Browser-SDK note.** The local-only `--dir` flow only works for server-side
> SDKs (Node, Go). Browser apps must use the `--push` cloud flow because the
> browser SDK loads config over SSE from `api-delivery` and has no datadir
> mode. See [from-launch](./from-launch.md#warning-browser-sdk-limitation-read-this-first)
> for details.

---

## Get a LaunchDarkly API token

In the LaunchDarkly UI: **Account Settings → Authorization → access tokens**.
Create an account-level token with read access — that's enough; the migrator
never writes back to LaunchDarkly.

Export it under any of these env vars (the CLI checks in order):

```bash
export LAUNCHDARKLY_API_KEY="api-..."         # provider-specific (preferred)
# or
export QUONFIG_MIGRATE_API_KEY="api-..."      # generic, works for any source
```

Or pass `--source-api-key <token>` on the command line.

> LaunchDarkly tokens use header auth — no `Bearer` prefix. The migrator
> handles this for you. Rate limits are per-account, shared across all
> tokens, and unpublished; the migrator backs off on `X-Ratelimit-Reset`
> automatically.

---

## What happens during migration

The migrator runs in up to two phases:

- **Phase 1 (always): config snapshot.** Roughly ~60 API calls for a typical
  500-flag project. Fast — seconds to a couple of minutes. This is the
  "imports current state" pass and is fully lossless within the documented
  gap list.
- **Phase 2 (only with `--full-summary`): history backfill.** Walks the
  LaunchDarkly audit log and replays each change as a per-flag git commit
  with the original author, date, and message. Slow — hours for a real
  account. Resumable on its own checkpoint, so an interrupted run picks up
  where it left off.

History retention is plan-gated on the LaunchDarkly side: **Developer plans
retain only the last 30 days**; unlimited history is Enterprise/select-plan
only. Anything outside that window is permanently gone in LaunchDarkly and
no API can recover it. The migrator probes your account's retention before
the slow phase starts and tells you the real horizon up front — you never
wait hours expecting two years and silently get thirty days.

If you don't need history yet, leave `--full-summary` off. You can re-run
later with the flag to backfill.

---

## Read the `MIGRATION_REPORT.md`

**This is the most important step.** Every run writes a fresh
`MIGRATION_REPORT.md` at the root of the workspace directory. It is the
honest record of what came across cleanly and what needs human eyes.

Three things in particular need your attention before you flip an SDK over:

1. **Users will be re-bucketed.** LaunchDarkly and Quonfig hash percentage
   rollouts differently. The rollout percentages are preserved exactly, but
   individual users will land in different buckets after cutover. The report
   lists every flag with a percentage rollout under a "users will be
   re-bucketed" heading — plan your comms accordingly.
2. **Dropped prerequisites.** Quonfig has no cross-flag dependency operator
   in v1. Each dropped prerequisite is named in the report; the downstream
   flag's own targeting still works, but the gate doesn't.
3. **Skipped rules.** Any clause whose operator couldn't be converted is
   listed by flag and clause so you can rebuild it by hand.

The report also documents informational drops (LaunchDarkly maintainer
metadata, mobile-key availability, `customProperties`) so nothing is
silently lost.

### Point your coding agent at it

The fastest workflow:

```bash
claude "read MIGRATION_REPORT.md and tell me what I need to do before \
flipping the SDK to Quonfig"
```

The report is structured enough that an agent can summarize the must-fix
items and propose concrete edits to your remaining LaunchDarkly call sites.

---

## What doesn't migrate cleanly

The full gap list lives in your workspace's `MIGRATION_REPORT.md`. The short
version, drawn from the [design plan §5.4](https://github.com/quonfig/project):

- **Prerequisites** — dropped and reported. The downstream flag's targeting
  survives; the cross-flag gate does not. Re-implement as in-flag rules or
  wait for native prerequisite support.
- **Individual / context targets** — LaunchDarkly's `targets` and
  `contextTargets` are converted to a leading `PROP_IS_ONE_OF` rule on the
  identifier attribute. Evaluation order is preserved; you lose the
  dedicated targets-pane UI affordance.
- **`privateAttributes`** — dropped and reported. No Quonfig equivalent in
  v1.
- **AI Configs** — out of scope for v1. The fetcher may enumerate them for
  the report, but no Quonfig file is emitted.
- **Big / synced segments** — the segment shell migrates. Membership does
  not, because LaunchDarkly does not expose unbounded segment members via
  REST. "Membership unavailable" is recorded in the report.
- **Negated comparison / date / semver operators** — skipped and reported
  per flag and clause. Quonfig has no negated form of `lessThan` /
  `greaterThan` / `before` / `after` / `semVerEqual` etc., and an algebraic
  flip would need combinatorial rule expansion (the missing-attribute trap
  makes it subtle). Negated `in` / `contains` / `startsWith` / `endsWith` /
  `matches` / `segmentMatch` are unaffected — they have direct negated
  operators and always convert.
- **Bucketing** — as above, individual user-to-bucket assignments change
  post-cutover even though the rollout percentages are identical.
- **Experiment rollouts** — converted to plain `weighted_values`; the
  `kind: "experiment"` framing and `seed` are dropped and reported.
- **Maintainer metadata, mobile-key availability, `customProperties`** —
  dropped and reported. Authorship lives in git history in Quonfig.

---

## Re-running

Each `qfg migrate` run overwrites `MIGRATION_REPORT.md` and re-asserts the
workspace state from the source. To experiment with different conversions
or compare runs side-by-side, create distinct workspaces (e.g.
`competitor-launchdarkly-1`, `-2`) and migrate into each.

`--dry-run` summarizes what would happen without writing anything — handy
for sanity-checking a fresh token before committing to a real run.

---

## Command reference

The full flag list is shared with the other sources — see
[`from-launch` → Command reference](./from-launch.md#command-reference).
LaunchDarkly-specific notes:

- `--from launchdarkly` selects this source.
- `--source-api-key <token>` (env: `LAUNCHDARKLY_API_KEY` or
  `QUONFIG_MIGRATE_API_KEY`) — the LaunchDarkly account-level read token.
  The older `--api-key` / `LAUNCH_API_KEY` pair is kept as a deprecated
  alias for the `launch` source only.
- `--full-summary` — opt into the slow Phase-2 audit-log backfill.

Run `qfg migrate --help` for live descriptions.

---

## Next steps

- [Troubleshooting common issues](./troubleshooting.md)
- Migrate your call sites — point your coding agent at
  `.qf/identifier-map.json` (the legacy → Quonfig key map the migrator
  writes) to rewrite LaunchDarkly SDK call sites.
- Swap your SDK: [Node](../sdks/node/node.md), [Go](../sdks/go.md),
  [JavaScript (browser)](../sdks/javascript.md)
