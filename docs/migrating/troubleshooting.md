---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 99
---

# Migration troubleshooting

Common friction points when running `qfg migrate`. This page covers every
source (`--from launch`, `--from launchdarkly`, `--from flagsmith`); sections
that apply to only one source say so.

Every run writes a report to `.qf/MIGRATION_REPORT.md` inside the workspace
directory (not the directory root). `.qf/` is a hidden directory, so use
`ls -a` to see it. Re-running the migrator overwrites the report with the
results of that run.

If you hit something not listed here, file an issue on the `cli` repo with the
output of `qfg migrate status` and your `.qf/MIGRATION_REPORT.md`.

---

## "My push was rejected: the remote has changes we do not have locally"

**Symptom:** a `qfg migrate --from <source> ... --push` run fails with:

```
Push to origin/main was rejected: the remote has changes we do not have
locally. Re-run the migrator to pick up those changes, then push again.
Original git error:
...

Re-run `qfg migrate --from <source> --workspace <org-slug>/<workspace-slug> --push`
to pick up remote changes before retrying.
```

**Why this happens.** `qfg migrate --push` deliberately does **not** force
push or use `git push --mirror`. It fetches your cloud workspace, applies the
migrator's changes as new commits on top of the existing history, and does a
plain push. If the workspace changed on the remote after the migrator fetched
it (for example, someone saved a flag in the Quonfig UI while the run was in
progress), the push is rejected instead of overwriting that change.

This is working as intended. A silent clobber would destroy your UI changes.

**How to resolve.**

1. Re-run the exact command the error suggests. The migrator fetches the
   latest workspace, re-applies its changes on top, and pushes again.
2. To see what changed on the remote, run `git log` and `git diff` against
   `origin/main` in the migration directory.
3. Decide which version wins for any flag that was edited in both places:
   - **UI edit wins:** run with `--since` set to just after the UI edit, so
     the migrator does not re-process older source changes:
     ```bash
     qfg migrate --from launch --source-api-key $LAUNCH_API_KEY \
       --workspace acme/acme-prod --push --since 2026-04-18T12:00:00Z
     ```
   - **Source edit wins:** revert the UI edit, then re-run the migrator
     without `--since`.
4. If you are mid-cutover and the UI is not yet a source of truth, `--reset`
   ignores the delta cursor and re-imports everything from the source system.
   Re-imported flags overwrite UI edits to the same flags, so use it with care.

**Prevention.** While you are still syncing from the source system, freeze UI
edits on the flags being migrated, and re-run the migrator right before each
push.

---

## "My push was rejected by the remote validation hook"

**Symptom:** a `--push` run fails with:

```
Push to origin/main was rejected by the remote validation hook. Fix the
errors below and push again. Original git error:
...
```

**Why this happens.** Every Quonfig workspace validates incoming pushes. The
migrated files contain something the workspace does not accept, and the hook
output under "Original git error" names the file and the problem.

**How to resolve.** Fix each reported error, either in the source system
(then re-run the migrator) or by editing the local files in the migration
directory. Run `qfg verify <dir>` locally to confirm the fixes, then re-run
with `--push`.

---

## "My flag did not appear"

**Symptom:** a flag exists in the source system but is missing from the
migrated output directory or cloud workspace.

**First, check `.qf/MIGRATION_REPORT.md`.** A flag that was seen but not
translated exactly is listed with a reason in one of these sections: **Lossy
mapping list**, **Unsupported feature list**, **Skipped invalid configs**, or
**Conversion notes**. If the flag is listed there, that is the answer.

**If it is not in the report, walk through:**

1. **Renamed key.** The flag may be there under a different key. See
   [My code can't find a migrated flag](#my-code-cant-find-a-migrated-flag).
2. **Delta cursor.** If you are re-running, the migrator only fetches changes
   after `lastProcessedAt` in `.qf/import-state.json`. A flag created *before*
   that timestamp and not modified since does not re-appear. Run with
   `--reset` to force a full reimport:
   ```bash
   qfg migrate --from launch --source-api-key $LAUNCH_API_KEY \
     --dir ./quonfig-config --reset
   ```
3. **API-key scope.** Confirm the source API key has read access to the
   project and environments the flag lives in. For `--from launch`,
   `qfg migrate doctor --api-key $LAUNCH_API_KEY` validates the key.
4. **Environment mapping.** Overrides that point at an environment the source
   system no longer lists are dropped (see
   [dropped override sections](#i-got-a-warning-about-dropped-override-sections)).
   The **Environment mapping table** in the report shows how each source
   environment maps to a Quonfig environment.

---

## "My code can't find a migrated flag"

**Symptom:** after cutover, an SDK lookup returns your code default (or
reports a missing key) for a flag that the report says was migrated.

**Why this happens.** Quonfig keys must use only letters, numbers, `.`, `-`
and `_`, be at most 200 characters, not start with a dot, and be unique
case-insensitively. When a source key breaks one of those rules, or collides
with another key (`MyFlag` and `myflag`, say), the migrator rewrites it
(sanitizing invalid characters, or adding a `-2` suffix to one side of a
collision) instead of dropping it. Your code still looks up
the old name.

**How to resolve.**

1. Open the **Rewritten keys (ACTION REQUIRED)** section of
   `.qf/MIGRATION_REPORT.md`. It lists each source key, the Quonfig key it
   became, and why. The same mapping is written to `.qf/key-map.json` if you
   want to script the change.
2. Update every SDK call site that uses an old key to use the new one.
3. If you need byte-identical keys, re-run with `--strict-keys`. The migrator
   then refuses to run while any key needs rewriting, so you can rename the
   keys in the source system first.
4. Verify with a small test matrix: pick 3-5 flags across distinct rule shapes
   (segment match, boolean, percentage rollout), evaluate them against a fixed
   user in both systems, and diff the outputs.

---

## "Should my migration directory have uncommitted changes?"

No. `qfg migrate` does not check for a clean working tree. It stages
everything in `--dir` (`git add --all`) and commits it together with the
migrated files, so any pending changes get swept into the migration commit.

- Commit or stash pending changes before you migrate.
- For `--from launch`, run `qfg migrate doctor --dir <dir>` first. Its
  `git-working-tree-clean` check reports uncommitted changes.
- Or pass a fresh `--dir` and merge the output into your workspace by hand.

---

## "I got a warning about dropped override sections"

**Symptom:** the migrator prints something like:

```
Warning: Dropped N override section(s) referencing M env ID(s) not present in
the source's env list (likely archived/deleted):
Warning:   env-<id>: N dropped from N flag(s)
Warning:     - <flag> (N)
```

**Why this happens.** The source system had rule overrides pointing at
environments that have since been archived or deleted there. The
migrator will not forge a mapping to an environment that no longer
exists, so it drops those override sections and moves on.

**How to resolve.** Review the per-env breakdown the warning prints. It is
also in the **Dropped override sections** part of the report.

- If any of the listed envs is still in use in the source system, restore
  it there and re-run `qfg migrate`.
- If the envs are genuinely dead (long-archived, renamed years ago), the
  warning is advisory and the migrated workspace is correct. The only
  data you lost was the override section that pointed nowhere.

---

## "I got a warning about skipped invalid configs"

**Symptom:**

```
Warning: Skipped N invalid config(s) from the source system — these were not
written to the workspace. Fix each in the source system and re-run:
Warning:   <key>: <reason>
```

There is one `<key>: <reason>` line per skipped config. For a Reforge Launch
migration, common reasons start with:

- `Variant type mismatch for "<key>" ...`
- `Schema conversion failed for "<key>": ...`, followed by the Zod source
- `Unsupported schema payload for "<key>"`
- `Unsupported operator(s) for "<key>": ...`

**Why this happens.** A source config is structurally invalid in a way
that the migrator refuses to translate. For Reforge Launch:

- **Variant/valueType mismatch.** A variant whose `value.type` does not
  match the config's `valueType` (for example, `valueType: "double"` but
  `value.type: "string"`). The source allowed this through schema drift;
  Quonfig does not, because a `double` config that returns a string
  would break SDK callers.
- **Schema conversion failed.** The Zod source for a schema-typed config
  uses syntax the migrator cannot translate to JSON Schema (for example, a
  hand-written value that isn't a real Zod expression, or an exotic
  `refine()` predicate). See
  [Schema-typed configs](#schema-typed-configs-are-auto-converted-to-json-schema)
  for the supported surface.
- **Unsupported schema payload.** A schema config whose `schemaType` is
  something other than `ZOD` (for example, `OPENAPI`). The migrator only
  ingests Zod-typed schemas.
- **Unsupported operator.** A rule uses an operator the migrator cannot
  translate yet.

The migrator skips just the bad config, lists it in `.qf/MIGRATION_REPORT.md`
under **Skipped invalid configs**, and continues, so the rest of your
workspace still migrates.

**How to resolve.** Fix the offending config in the source system (correct
the type, fix the Zod source, convert the schema to Zod, or use a supported
operator) and re-run. The rest of the workspace is unaffected; only the
listed configs are missing.

---

## "I got a warning about resolved cross-type duplicates"

**Symptom:**

```
Warning: Resolved N cross-type key collision(s) in the source data by keeping
the config side and deleting the other type(s). Review each and clean up the
source system so the collision stops recurring:
Warning:   <key> (<types>): kept config, deleted feature_flag
```

**Why this happens.** A key existed in the source as **both** a config
**and** a feature flag at the same time. The source allowed the
collision, but Quonfig keys are unique across flags, configs, log levels
and segments, compared case-insensitively. The migrator's tiebreaker is
config-wins, because configs are strictly more expressive than boolean
flags: a flag's behavior can always be expressed as a config, but not
vice versa.

**How to resolve.** The deleted sides are listed under **Resolved cross-type
duplicates** in `.qf/MIGRATION_REPORT.md` so you can review what was lost.
If the feature-flag side was actually the live one:

1. In the source system, delete whichever side should not have existed.
2. Re-run `qfg migrate`.

If the warning was benign (for example, a renamed key where both sides
happened to linger), no action is needed.

---

## Schema-typed configs are auto-converted to JSON Schema

This applies to Reforge Launch migrations. Configs whose `valueType` is
`schema` (Reforge's Zod-schema storage) are converted to
[JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
automatically during `qfg migrate`. You do not need to do anything
special; schema configs migrate like any other config.

**Object schemas are emitted strict.** The Quonfig authoring validator
requires `additionalProperties: false` on every object that declares
`properties`, so the converter always emits strict object schemas,
even when the original Zod source was open (the default `z.object({…})`
shape). If you intentionally want an open schema, edit the emitted JSON
Schema by hand after the migration; otherwise no action is needed.

The supported Zod surface area covers the common cases:

- Primitives: `string` (with `.email()`, `.uuid()`, `.datetime()`,
  `.min()`, `.max()`, `.regex()`), `number` / `int` (with `.min()` /
  `.max()`), `boolean`, `null`, `undefined`
- `.optional()`, `.nullable()`, `.default()`, `.describe()`
- `object`, `object().partial()`, `object().strict()` / `.strip()` /
  `.passthrough()`
- `array` (with `.min()` / `.max()` / `.length()`), `tuple`
- `enum`, `nativeEnum`, `literal`
- `union`, `discriminatedUnion`, `intersection`
- `record`, `map`, `set`

If your schemas reach for the exotic end of Zod (`z.function()`,
`z.promise()`, `z.lazy()` with recursive references, custom
`refine()` / `superRefine()` predicates that cannot be expressed as
JSON Schema constraints), the migrator skips that config and prints the
offending Zod source in the
[skipped invalid configs](#i-got-a-warning-about-skipped-invalid-configs)
warning. File an issue on the `cli` repo (or contact support@quonfig.com)
with that Zod source so we can either add the surface or document a
workaround.

---

## "I need to verify the migration actually worked"

1. Run `qfg migrate status` to see counts and the current cursor.
2. Read `.qf/MIGRATION_REPORT.md` top to bottom. The **Before you cut over**
   list and the **Must fix before cutover** checklist are not optional.
3. Pick 5-10 flags that cover your rule shapes and evaluate them against the
   same user in both systems. Any difference is a cutover blocker.

Manual spot checks are the supported verification path today.

---

## Still stuck?

- `qfg migrate doctor` (Reforge Launch only today) runs preflight checks: the
  source API key (pass it with `--api-key`), `qfg login`, workspace
  provisioning, SDK datadir support, a clean git working tree, and identifier
  collisions. Add `--json` for machine-readable output.
- File an issue on the `cli` repo with the doctor output (if you ran it) and
  your `.qf/MIGRATION_REPORT.md`.
