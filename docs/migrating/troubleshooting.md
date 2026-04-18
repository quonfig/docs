---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 99
---

# Migration troubleshooting

Common friction points when running `qfg migrate`. If you hit something not
listed here, file an issue on the `cli` repo with the output of
`qfg migrate status` and your `MIGRATION_REPORT.md`.

---

## "I ran it twice and got a merge conflict"

**Symptom:** the second `qfg migrate --from launch ... --push` run fails with a
git push rejection or a merge-conflict error from the clone-and-stack step.

**Why this happens.** `qfg migrate --push` deliberately does **not** use
`git push --mirror`. It clones your cloud workspace, applies the migrator's
delta as new commits on top of existing history, and fast-forward pushes. If
you (or someone on your team) edited the same file in the Quonfig UI between
migrator runs, the cloud history diverged — the fast-forward push cannot
proceed without overwriting the UI edit.

This is working as intended. A silent clobber would destroy your UI changes.

**How to resolve.**

1. Inspect the conflict. The migrator prints the conflicting file paths.
2. Decide which version wins:
   - **UI edit wins** — skip re-migrating that flag. Run with `--since` set to
     just after the UI edit so the migrator does not re-process the change:
     ```bash
     qfg migrate --from launch --api-key $LAUNCH_KEY --workspace acme-prod \
       --push --since 2026-04-18T12:00:00Z
     ```
   - **Launch edit wins** — manually revert the UI edit, then re-run the
     migrator without `--since`.
3. If you are mid-cutover and the UI is not yet a source of truth, `--reset`
   rebuilds the workspace from Launch. This discards UI edits; use with care.

**Prevention.** During active migration, either freeze UI edits on the flags
you are still syncing from Launch, or migrate Launch-managed flags into a
subdirectory the UI does not touch.

---

## "My flag did not appear"

**Symptom:** a flag exists in Launch but is missing from the migrated output
directory or cloud workspace.

**First, check `MIGRATION_REPORT.md`.** Any flag that was seen but not
translated will be in the "lossy" or "unsupported" lists with a reason (e.g.,
"uses prerequisite-flag operator — not yet supported in Quonfig schema").
If the flag is listed there, that is the answer.

**If it is not in the report, walk through:**

1. **Delta cursor.** If you are re-running, the migrator only fetches changes
   after `.qf/import-state.json`'s `lastProcessedAt`. A flag created *before*
   that timestamp that has not been modified since will not re-appear. Run
   with `--reset` to force a full reimport:
   ```bash
   qfg migrate --from launch --api-key $LAUNCH_KEY --dir ./quonfig-config --reset
   ```
2. **API-key scope.** Confirm the Launch API key has read access to the
   project and environment the flag lives in. `qfg migrate doctor` verifies
   this.
3. **Identifier collision.** On case-insensitive filesystems (macOS default,
   Windows), two Launch flags that differ only in case (`MyFlag` vs `myflag`)
   cannot coexist. The migrator fails loudly with both names printed — check
   stderr and `MIGRATION_REPORT.md` for a collision entry.
4. **Environment filter.** Flags scoped to an environment that is not in your
   workspace's environment list get skipped. Your environment mapping is in
   the report.

---

## "My context shape is different"

**Symptom:** the same flag evaluates differently in Quonfig than in Launch for
the same user. The flag exists and the rules look right, but the result is
wrong.

**Why this happens.** Quonfig and Launch pass context to evaluation rules using
different shapes. A Launch rule that keys on `user.email` does not match
against a Quonfig context with `email` at the top level. The migrator rewrites
rules into Quonfig's shape, but **your SDK call sites still pass the old
shape** until you update them.

**How to resolve.**

1. Run `qfg migrate my-code` to scan your codebase and rewrite call sites. The
   Claude skill reads `.qf/identifier-map.json` (written by the migrator) and
   knows which context keys to translate.
2. For anything the skill cannot auto-migrate — custom context adapters,
   unusual call patterns — it leaves a comment summary you can work through
   by hand.
3. Verify with a small test matrix: pick 3-5 flags across distinct rule shapes
   (segment match, boolean, percentage rollout), evaluate them against a fixed
   user in both systems, and diff the outputs.

**Gotcha: private attributes.** Launch's `privateAttributes` concept (attributes
evaluated client-side but never sent to the server) has no Quonfig equivalent.
If your Launch setup uses them, they show up in the "unsupported" section of
`MIGRATION_REPORT.md`. You will need a different approach — usually evaluating
those rules server-side in your app before calling the SDK.

---

## "The migrator says my working tree is dirty"

`qfg migrate` refuses to run against a `--dir` with uncommitted changes, to
protect the cursor file from getting clobbered.

- Commit or stash the pending changes, then re-run.
- Or pass a fresh `--dir` and merge the output into your workspace by hand.

---

## "I need to verify the migration actually worked"

1. Run `qfg migrate status` to see counts and the current cursor.
2. Read `MIGRATION_REPORT.md` top to bottom — the "must fix before cutover"
   checklist is not optional.
3. Pick 5-10 flags that cover your rule shapes and evaluate them against the
   same user in both systems. Any difference is a cutover blocker.

Shadow-evaluation tooling (`qfg diff --against launch`) is on the roadmap but
not in v1 — manual spot checks are the supported path today.

---

## Still stuck?

- `qfg migrate doctor` — runs preflight checks (API key, `qfg login`,
  workspace exists, SDK datadir support, clean git state) and emits a
  human-readable report. Add `--json` for machine-readable output.
- File an issue on the `cli` repo with doctor output + `MIGRATION_REPORT.md`.
