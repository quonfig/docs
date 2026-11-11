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
read after every run is the **`.qf/MIGRATION_REPORT.md`** the migrator writes
inside the workspace directory — see [Read the migration report](#read-the-migration-report)
below.

Use a current `qfg` (`npm install -g @quonfig/cli` installs or updates it).

---

## Quick start (the 3-command flow)

```bash
qfg login
qfg workspace create my-team --org my-org
qfg migrate --from launchdarkly \
  --source-api-key $LAUNCHDARKLY_API_KEY \
  --project my-ld-project \
  --push --workspace my-org/my-team \
  --dir ./my-quonfig-workspace
```

That's it. The migrator clones the hosted workspace into `./my-quonfig-workspace`,
pulls every flag and segment from the LaunchDarkly project, converts them,
validates the result client-side, commits, and pushes.

`--project` is the LaunchDarkly project **key** (not its name). It defaults
to `default`, or to `LAUNCHDARKLY_PROJECT_KEY` when that is set. If your
flags live in any other project, pass it explicitly, or the migrator imports
the `default` project instead.

**No cloud account?** Drop `--push` and `--workspace`, keep `--dir`. You'll
get a standalone Quonfig workspace git repo on disk that any backend SDK
(Node, Go, Python, Ruby, Java, .NET) can read directly through its `datadir`
option (`WithDataDir` in Go). See [Local Workspace (datadir)](../explanations/concepts/local-workspace.md)
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

![Two ways to run the migration: free mode pulls LaunchDarkly into a git repo you own and your server-side SDK reads it from disk; cloud mode adds --push, syncing the repo to Quonfig Cloud, which streams updates to backend SDKs over SSE while browser SDKs fetch over HTTP and poll](/img/docs/migrating/launchdarkly-two-modes.svg)

---

## Get a LaunchDarkly API token

In the LaunchDarkly UI: **Account Settings → Authorization → access tokens**.
Create an account-level token with read access — that's enough; the migrator
never writes back to LaunchDarkly.

Pass it with `--source-api-key <token>`, or export it:

```bash
export LAUNCHDARKLY_API_KEY="api-..."
```

The CLI uses the first key it finds, in this order:

1. `--source-api-key`, or `QUONFIG_MIGRATE_API_KEY` (generic, works for any source)
2. `--api-key`, or `LAUNCH_API_KEY` (deprecated alias meant for the `launch`
   source; the CLI prints a warning when it is used with `--from launchdarkly`)
3. `LAUNCHDARKLY_API_KEY`

`LAUNCHDARKLY_API_KEY` is the fallback, so a leftover
`QUONFIG_MIGRATE_API_KEY` or `LAUNCH_API_KEY` in your shell takes precedence
over it. Unset those, or pass `--source-api-key`, if they hold a key for a
different system.

> LaunchDarkly tokens use header auth — no `Bearer` prefix. The migrator
> handles this for you. Rate limits are per-account, shared across all
> tokens, and unpublished; the migrator backs off on `X-Ratelimit-Reset`
> automatically.

---

## What happens during migration

The migrator imports in one of two modes:

- **Config snapshot (default).** Roughly ~60 API calls for a typical
  500-flag project. Fast — seconds to a couple of minutes. This is the
  "imports current state" pass and is fully lossless within the documented
  gap list.
- **History backfill (with `--full-summary`).** Instead of the snapshot,
  walks the LaunchDarkly audit log and replays each flag change as a git
  commit with the original author, date, and message, then adds the current
  segments. Slow — hours for a real account. It keeps a checkpoint, so an
  interrupted run picks up where it left off.

History retention is plan-gated on the LaunchDarkly side: **Developer plans
retain only the last 30 days**; unlimited history is Enterprise/select-plan
only. Anything outside that window is permanently gone in LaunchDarkly and
no API can recover it. The migrator probes your account's retention before
the slow phase starts and tells you the real horizon up front — you never
wait hours expecting two years and silently get thirty days.

`--full-summary` works only on a first-run import. On a directory that has
already been migrated, the CLI refuses it. To add history later, re-import
from scratch into a fresh directory with `--reset --full-summary`.
`--full-summary` also can't be combined with `--recent`.

---

## Read the migration report {#read-the-migration-report}

**This is the most important step.** Every run writes a fresh
`.qf/MIGRATION_REPORT.md` inside the workspace directory (it lives under
`.qf/` so it is never pushed as workspace config). It is the honest record
of what came across cleanly and what needs human eyes.

Four things in particular need your attention before you flip an SDK over:

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
4. **Mobile-only flags stop reaching mobile clients.** A flag that was
   available to mobile SDKs but not to client-side (environment ID) SDKs in
   LaunchDarkly (`usingMobileKey: true`, `usingEnvironmentId: false`) is
   flagged as must-fix: it won't be visible to mobile SDKs after migration.
   Rebuild client-side access by hand before cutover.

The report also documents informational drops (LaunchDarkly maintainer
metadata, the mobile-key setting on flags that stay client-visible,
`customProperties`) so nothing is silently lost.

### Point your coding agent at it

The fastest workflow:

```bash
claude "read .qf/MIGRATION_REPORT.md and tell me what I need to do before \
flipping the SDK to Quonfig"
```

The report is structured enough that an agent can summarize the must-fix
items and propose concrete edits to your remaining LaunchDarkly call sites.

---

## What doesn't migrate cleanly

The full gap list lives in your workspace's `.qf/MIGRATION_REPORT.md`. The
short version:

- **Prerequisites** — dropped and reported. The downstream flag's targeting
  survives; the cross-flag gate does not. Re-implement as in-flag rules or
  wait for native prerequisite support.
- **Individual / context targets** — LaunchDarkly's `targets` and
  `contextTargets` are converted to a leading `PROP_IS_ONE_OF` rule on the
  identifier attribute. Evaluation order is preserved; you lose the
  dedicated targets-pane UI affordance.
- **`privateAttributes`** — not migrated. It is a LaunchDarkly SDK-side
  setting, not part of the flag data, so it doesn't appear in the report.
  Quonfig has no equivalent.
- **AI Configs** — out of scope for v1. The fetcher may enumerate them for
  the report, but no Quonfig file is emitted.
- **Big / synced segments** — the segment shell migrates. Membership does
  not, because LaunchDarkly does not expose unbounded segment members via
  REST. "Membership unavailable" is recorded in the report.
- **Negated comparison / date / semver operators** — skipped and reported
  per flag and clause. Quonfig has no negated form of `lessThan` /
  `greaterThan` / `before` / `after` / `semVerEqual` etc., and an algebraic
  flip would need combinatorial rule expansion (the missing-attribute trap
  makes it subtle).
- **Other negated operators** — negated `in` / `contains` / `startsWith` /
  `endsWith` / `matches` convert to Quonfig's negated operators with an
  `IS_PRESENT` check on the same attribute ANDed in front. LaunchDarkly never
  matches a context that lacks the attribute, and the guard keeps that
  behavior. Negated `segmentMatch` converts directly to `NOT_IN_SEG`.
- **Regex (`matches`) patterns** — a pattern outside
  [Quonfig regex v1](../explanations/features/rules-and-segmentation.md#quonfig-regex-v1)
  is skipped and reported. A multi-pattern clause is joined into one
  alternation when the result stays inside regex v1; otherwise it is split
  into one rule per pattern, and a rule that would expand into more than 16
  rules is dropped and reported.
- **Bucketing** — as above, individual user-to-bucket assignments change
  post-cutover even though the rollout percentages are identical.
- **Experiment rollouts** — converted to plain `weighted_values`; the
  `kind: "experiment"` framing and `seed` are dropped and reported.
- **Mobile-key availability** — dropped and reported. Flags that were
  mobile-only become server-only; see item 4 under
  [Read the migration report](#read-the-migration-report).
- **Maintainer metadata, `customProperties`** — dropped and reported.
  Authorship lives in git history in Quonfig.

---

## Re-running

Each `qfg migrate` run overwrites `.qf/MIGRATION_REPORT.md` and re-asserts the
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
- `--source-api-key <token>` (env: `QUONFIG_MIGRATE_API_KEY`, with
  `LAUNCHDARKLY_API_KEY` as the fallback) — the LaunchDarkly account-level
  read token. See [Get a LaunchDarkly API token](#get-a-launchdarkly-api-token)
  for the full precedence. The older `--api-key` / `LAUNCH_API_KEY` pair is a
  deprecated alias meant for the `launch` source.
- `--project <ld-project-key>` (env: `LAUNCHDARKLY_PROJECT_KEY`, default
  `default`) — the LaunchDarkly project key to import.
- `--full-summary` — opt into the slow Phase-2 audit-log backfill. First-run
  imports only; can't be combined with `--recent`.

Run `qfg migrate --help` for live descriptions.

---

## Next steps

- [Troubleshooting common issues](./troubleshooting.md)
- Migrate your call sites. LaunchDarkly keys normally import unchanged. If
  any key had to be renamed (for example, a segment that shared a key with a
  flag gets a `-segment` suffix), the "Rewritten keys (ACTION REQUIRED)"
  section of `.qf/MIGRATION_REPORT.md` lists each old and new key, and
  `.qf/key-map.json` has the same map in machine-readable form (written only
  when a key was renamed). Point your coding agent at the report to rewrite
  your LaunchDarkly SDK call sites.
- Swap your SDK. Backend: [Node](../sdks/node/node.md), [Go](../sdks/go.md),
  [Python](../sdks/python/python.md), [Ruby](../sdks/ruby.md),
  [Java](../sdks/java.md), [.NET](../sdks/dotnet.md). Frontend and mobile:
  [JavaScript (browser)](../sdks/javascript.md), [React](../sdks/react.md),
  [React Native](../sdks/react-native.md), [Swift](../sdks/swift.md).
