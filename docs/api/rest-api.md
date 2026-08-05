---
title: REST API
sidebar_label: REST API
sidebar_position: 1
---

# REST API

The Quonfig REST API lets scripts, CI jobs, and agents manage flags and
configs over plain HTTPS: list and inspect flags, read the git-backed audit
trail, update what an environment serves, and read or replace the raw stored
document — including any earlier version of it. It is the same control plane
the app and CLI use — a change made here shows up everywhere, with full
attribution in your workspace's git history.

```
Base URL: https://api.quonfig.com/v1
```

The API is described by an OpenAPI 3.1 spec at
[`https://api.quonfig.com/v1/openapi.json`](https://api.quonfig.com/v1/openapi.json)
— that spec is the published contract, and you can
[generate a typed client from it](#openapi-spec--client-generation). Prefer to
browse it? There's an
[interactive reference](https://api.quonfig.com/v1/docs) built from the same
spec.

A first call to check your key works:

```bash
curl https://api.quonfig.com/v1/whoami \
  -H "Authorization: Bearer $QUONFIG_API_KEY"
```

```json
{
  "workspaceId": "01J...",
  "keyId": "01J...",
  "principal": { "type": "user", "id": "user_...", "name": "Ada Lovelace" }
}
```

## Authentication

Every request needs a Bearer API key:

```
Authorization: Bearer <key>
```

Two kinds of key work, and they differ only in *who the change is attributed
to*:

| Key | Looks like | Acts as | Mint it in the app |
|---|---|---|---|
| Personal API key | `qf_uk_...` | You — changes are attributed to your user | Workspace → **Environments** → **CLI & API keys** tab |
| Service-account key | `qf_sa_...` | A bot identity with its own name and role | Workspace → **Settings** → **Service accounts** → **Mint key** |

Use a personal key for your own scripts; use a service account for anything
shared (CI, integrations, agents), so the audit trail says
`deploy-bot (service account)` instead of a person who left the team.
History and activity responses flag bot changes with
`isServiceAccount: true`.

Keys are **workspace-scoped**: the workspace every call acts on is inferred
from the key, so paths never contain a workspace id. To act on two
workspaces, mint two keys.

:::warning SDK keys don't work here
`qf_sk_...` / `qf_pk_...` SDK keys authenticate your *application* to the
delivery API — they cannot manage config. See
[Keys & Credentials](/docs/explanations/concepts/keys-and-credentials) for
how the credential kinds relate.
:::

## Endpoints

The v1 surface is deliberately small: read everything, one focused write for
the everyday case, and a raw document read/write for everything else. All
requests and responses are JSON.

| Method | Path | What it does |
|---|---|---|
| GET | `/v1/whoami` | Identify the calling key: principal + workspace |
| GET | `/v1/workspaces` | The workspace(s) this credential can act on |
| GET | `/v1/environments` | The workspace's environments: names, types, and which are protected |
| GET | `/v1/flags` | List feature flags (filter with `?tag=` and `?status=`) |
| GET | `/v1/flags/{key}` | Full flag detail: default rules, per-environment rules, rollouts, variants |
| GET | `/v1/flags/{key}/history` | Git commits that changed this flag, most recent first |
| PATCH | `/v1/flags/{key}/environments/{env}` | Update what one environment serves ([see below](#updating-a-flag)) |
| GET | `/v1/flags/{key}/document` | The raw stored JSON — any commit with `?at=` ([see below](#raw-documents)) |
| PUT | `/v1/flags/{key}/document` | Replace the raw stored JSON wholesale ([see below](#raw-documents)) |
| GET | `/v1/configs` | List configs |
| GET | `/v1/configs/{key}` | Full config detail |
| GET | `/v1/configs/{key}/history` | Git commits that changed this config |
| GET | `/v1/configs/{key}/document` | The raw stored JSON for a config |
| PUT | `/v1/configs/{key}/document` | Replace a config's raw stored JSON |
| GET | `/v1/log-levels/{key}/document` | The raw stored JSON for a log level |
| PUT | `/v1/log-levels/{key}/document` | Replace a log level's raw stored JSON |
| GET | `/v1/segments` | List segments — the reusable membership rule sets targeting rules point at |
| GET | `/v1/segments/{key}` | A segment's membership rules: who it actually matches |
| GET | `/v1/segments/{key}/history` | Git commits that changed this segment |
| GET | `/v1/activity` | Workspace-wide change feed, or one item's translated history |

List responses return the whole workspace by default (hundreds of items,
not millions). `/v1/flags` and `/v1/configs` additionally accept opt-in
[pagination](#pagination), and `/v1/activity` takes `?limit=` (1–100,
default 30).

Two asymmetries worth noticing in that table. **Log levels** appear only as
document endpoints — v1 has no log-level list or detail route, so the
document pair is the whole log-level surface. **Segments** are the reverse:
list, detail, and history, but no document endpoints, so they stay
read-only over the API.

### Reading flags and configs

`GET /v1/flags` summarizes each flag: identity and `tags`, the current
`commitSha`, when it last changed, and its derived lifecycle status.
Filter server-side with `?tag=` and `?status=`.

`GET /v1/flags/{key}` returns the flag in full: `default.rules`,
per-environment `environments[].rules` (including percentage rollouts),
`variants`, and the flag's current `commitSha` — the version handle you can
later pass as [`expectedCommitSha`](#concurrency-expectedcommitsha) when
writing. Configs have the same shape at `/v1/configs/{key}`.

This is a projection of the stored file, not the file: it drops `access`,
`$schema`, and `type`, so it can't be written back as-is. When you need the
stored JSON verbatim — or an earlier version of it — use
[the document endpoints](#raw-documents).

Two things to know about the values you'll see:

- **Open value sets.** Fields like `valueType` and rule `operator` are
  strings with documented values (for example `bool`, `string`, `int`,
  `double`, `json`, `string_list`, `duration`, `log_level`), not closed
  enums — Quonfig may add values over time, and generated clients should
  tolerate unknown ones.
- **Encrypted values stay encrypted.** For secrets, `value` is the stored
  ciphertext and `decryptWith` names the config holding the decryption key.
  Decryption happens in your runtime — Quonfig servers never decrypt.

### When something last changed

Flag and config rows — on both the list and the detail responses — carry
`lastModified`:

```json
{ "date": "2026-07-07T17:07:41-04:00", "author": "Jeff Dwyer" }
```

It describes the same commit `commitSha` names: `date` is the ISO 8601
commit author date, `author` the name on that commit. That makes "which of
these hasn't been touched in six months?" a single list call rather than
one history request per item.

Two caveats. A service-account write carries the service account's own
name, so use [history](#history-and-activity) — which has
`isServiceAccount` — when you need to tell a bot from a human. And the
field is **absent rather than fabricated** when git couldn't attribute the
file's last commit; a synthesized timestamp would read as "changed just
now", which is worse than a missing field.

### Flag lifecycle status

Flag list rows carry two status maps, both keyed by environment name:

| Field | Covers | Use it for |
|---|---|---|
| `statuses` | Production environments only | What `?status=` filters on |
| `environmentStatuses` | Every active environment | Telling an environment gate from a finished rollout |

`statuses` is a subset of `environmentStatuses`, so the two can never
disagree about an environment they share. The narrow one exists because
`?status=` has always matched against production, and widening it would
silently change what a shipped query returns. Read the wide one before
calling a flag fully rolled out: `live` in production and `pre_rollout` in
staging is an environment gate, not a finished rollout.

Status is a pure function of the **stored document** — never of traffic,
evaluations, or any other telemetry. For one boolean flag in one
environment, evaluated against that environment's own rules (or the flag's
`default.rules` when the environment has no entry of its own):

| Stored state | Status |
|---|---|
| `readyForCleanup` is true | `ready_for_cleanup` — short-circuits everything below |
| No rules at all | `pre_rollout` |
| Any rule serves a real split | `rollout` |
| No catch-all; every rule serves false | `pre_rollout` |
| No catch-all; some rule serves true | `rollout` |
| Catch-all present; every rule serves true | `live` |
| Catch-all present; every rule serves false | `pre_rollout` |
| Catch-all present; mixed | `rollout` |

A "catch-all" is a rule whose only criterion is `ALWAYS_TRUE` — without
one, unmatched contexts fall through, so the flag can't be `live` whatever
the rules serve. A rule serves true or false when its value is a plain
boolean, or a weighted rollout in which one boolean value carries all of
the non-zero weight; anything else counts as a split. Non-boolean flags
have no lifecycle: both maps come back empty.

`readyForCleanup` is the one manual input. An owner sets it by hand in the
Quonfig app to say "this flag's job is done, remove the references at your
convenience" — it is not derived from usage, evaluation counts, or age.
It's **always present** on both the list and detail flag responses (`false`
when nobody has marked the flag), and when true it forces every entry in
both maps to `ready_for_cleanup` regardless of what the rules say.

### Segments

Targeting rules reference segments by key instead of inlining them, so a
rule like

```json
{ "operator": "IN_SEG", "valueToMatch": { "type": "string", "value": "beta-users" } }
```

names a segment without saying a word about who's in it. The segment
endpoints resolve that: `valueToMatch.value` *is* the segment's key, so
pass it straight through as `{key}`.

`GET /v1/segments` lists each segment with `key`, `name`, `description`,
`ruleCount`, and `commitSha`. `GET /v1/segments/{key}` returns the
membership rules themselves:

```json
{
  "key": "beta-users",
  "name": "Beta users",
  "default": {
    "rules": [
      {
        "criteria": [{ "propertyName": "user.plan", "operator": "PROP_IS_ONE_OF", "valueToMatch": { "type": "string_list", "value": ["beta"] } }],
        "value": { "type": "bool", "value": true }
      }
    ]
  },
  "commitSha": "1a2b3c4..."
}
```

Segments are cross-environment: there's exactly one rule set, which is why
it lives under `default` and there's no `environments` array. The rule
shape is identical to a flag's or config's, so the same client code reads
it. A context is in the segment when the first matching rule serves true.

`GET /v1/segments/{key}/history` is the git audit trail, same shape as the
flag and config twins.

### Environments

`GET /v1/environments` lists the workspace's active environments:

```json
{
  "environments": [
    { "name": "development", "environmentType": "development", "protected": false },
    { "name": "staging", "environmentType": "staging", "protected": false },
    { "name": "production", "environmentType": "production", "protected": true }
  ]
}
```

`name` is the identifier every other endpoint uses — the `env` path segment
of [the PATCH](#updating-a-flag), and the `id` of an entry in a flag's or
config's `environments` array. Ask rather than guessing: `prod` and
`production` are both plausible names and only one of them is yours.

`protected` tells you up front whether writing to that environment needs an
elevated role, so you can check before a write comes back `403`.
`environmentType` is an open string set (`production`, `staging`, `test`,
`development` today) and is what decides whether an environment appears in
a flag's `statuses` map. Archived environments are omitted, and the list is
ordered development, test, staging, production — alphabetically within a
type.

### Pagination

`GET /v1/flags` and `GET /v1/configs` are unpaginated by default and that
isn't changing: omit both parameters and you get every row in one response,
exactly as before. There is no implicit page size.

Pass `limit` (1–100) to bound the response:

```bash
curl "https://api.quonfig.com/v1/flags?limit=50" \
  -H "Authorization: Bearer $QUONFIG_API_KEY"
```

A bounded response carries `nextCursor` while rows remain. Pass it back as
`cursor` for the next page, and stop when it's absent:

```bash
curl "https://api.quonfig.com/v1/flags?limit=50&cursor=v1_YWktc3VtbWFyaWVz" \
  -H "Authorization: Bearer $QUONFIG_API_KEY"
```

Three things to know:

- **Ordering applies only when you paginate.** A paginated result is
  ordered ascending by `key`. The default response is in no defined order
  and never has been, so don't try to page over it by hand.
- **The cursor is a position, not a saved query.** Resend the same
  `?tag=`/`?status=` with every page. Filters are applied before paging, so
  a page holds `limit` rows of the *filtered* set.
- **The cursor is opaque.** Round-trip it verbatim — anything else is a
  `400`. Because it keys on `key` rather than an offset, a flag created or
  deleted between two pages can't shift the window and make you skip a
  neighbor.

### History and activity

`GET /v1/flags/{key}/history` (and the configs twin) answers "who changed
this and when" straight from git: commit SHA, message, author, date, and
`isServiceAccount`.

`GET /v1/activity` is the workspace-wide feed with changes translated into
human-readable messages (`"production: enabled set to false"`). Pass
`?type=&key=` together (type is one of `feature_flag`, `config`,
`log_level`, `segment`, `schema`) to get one item's full translated history
instead.

Both are **metadata**: they tell you which commits touched an item and who
made them, never what the item looked like at those commits. To read the
document itself at one of those shas, pass it to
[`?at=`](#reading-an-earlier-version) on the document endpoint.

## Updating a flag

`PATCH /v1/flags/{key}/environments/{env}` is the everyday write. It's
deliberately narrow, and it stays that way — anything it can't express
(multi-rule targeting, variants, metadata, and undo) goes through
[the document endpoints](#raw-documents) instead.

It sets what one environment serves, expressed as **exactly one** of three
operations:

| Operation | Body | For |
|---|---|---|
| Toggle | `{"enabled": true}` | Boolean flags |
| Serve one value | `{"value": "gpt-5"}` | Any flag: everyone gets this value |
| Percentage rollout | `{"rollout": [{"value": true, "percent": 25}, {"value": false, "percent": 75}]}` | Splitting traffic across values |

```bash
curl -X PATCH \
  https://api.quonfig.com/v1/flags/checkout-redesign/environments/production \
  -H "Authorization: Bearer $QUONFIG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

```json
{
  "key": "checkout-redesign",
  "environment": "production",
  "changed": true,
  "commitSha": "8c1f2ab...",
  "previousCommitSha": "3d9e017...",
  "rules": [{ "criteria": [{ "operator": "ALWAYS_TRUE" }], "value": { "type": "bool", "value": false } }]
}
```

`previousCommitSha` is the version this write moved off — the one to name
in [the undo recipe](#undoing-a-write) if the change turns out to be wrong.
It's present whenever `changed` is true, and absent when `changed` is
false, because a [no-op write](#no-op-writes) commits nothing and so has no
version to revert to. If the server
[retried](#concurrency-expectedcommitsha) after losing a race, it names the
parent of the commit that actually landed, not the version the losing
attempt read.

Values are **bare JSON** (`true`, `"foo"`, `42`, arrays, objects) and are
checked against the flag's `valueType` — sending a string to a `bool` flag
is a `400` naming the expected shape. Rollout percents take up to 3 decimal
places and must sum to exactly 100; for non-boolean flags each rollout value
must match one of the flag's defined variants. Re-ramping a rollout keeps
user bucketing sticky — the same users stay in the same bucket as the
percentage moves.

The write is permission-checked exactly like the UI: the key's principal
needs edit permission for this flag in this environment, or the request
fails with `403` and `details.code: "PERMISSION_DENIED"`.

### The targeting-rule guard

The PATCH replaces the environment's rules with a single unconditional
rule. If the environment currently has **targeting rules** (anything beyond
serve-everyone), the write fails closed with `409` and
`details.code: "TARGETING_RULES_PRESENT"` rather than silently deleting
them. `details.ruleCount` says how many rules are at stake. The guard is
re-checked on every attempt, so a concurrent edit that *adds* targeting
turns an in-flight retry into this rejection instead of a silent delete.

To deliberately replace targeting, resend with:

```json
{ "enabled": false, "replaceTargeting": true }
```

:::danger `replaceTargeting` deletes rules this endpoint can't rewrite
This endpoint can only ever write **one unconditional rule**, so no PATCH —
not this one, not another — can reconstruct the targeting it replaced.
Treat `replaceTargeting: true` as a confirm-with-a-human step, not a retry
flag.

It is recoverable, though, and the response tells you exactly what you need:

- `replacedTargetingRuleCount` — how many rules the single unconditional
  rule replaced. Present *only* when real targeting was destroyed; a plain
  re-toggle over an existing catch-all doesn't count and omits it.
- `previousCommitSha` — the commit those rules were last stored in.

Feed that sha to [the undo recipe](#undoing-a-write): the document endpoint
reads the flag as it stood at that commit, and PUT puts it back, targeting
rules and all. Scripts and agents should still surface both fields to the
person who asked — the recipe is a deliberate step someone takes, not an
automatic rollback.
:::

### Concurrency: `expectedCommitSha`

On the PATCH, `expectedCommitSha` is optional. (On
[the document endpoints](#replacing-a-document) it is required — a full
replacement can't be safely re-applied to a state you never read.)

By default, concurrent writes are safe without any extra work: if another
change lands mid-write, the server re-applies your operation to the fresh
state and commits (your operation is absolute, so re-applying is always
correct).

For check-then-act flows — "disable this flag *only if* it's still the
version I just read" — pass the `commitSha` from a prior GET as
`expectedCommitSha`. That makes the write single-shot compare-and-set: if
the flag changed since, you get `409` with
`details.code: "STALE_COMMIT_SHA"` and nothing is written. Re-read and
decide again; the server never retries a pinned write.

### No-op writes

If the environment already matches the requested state, the response has
`changed: false`, the current `commitSha`, and **no commit is made** — no
audit noise, no metered config update. Retrying a timed-out PATCH is
therefore safe: the retry converges to a no-op instead of double-writing.

## Raw documents

Quonfig stores each flag, config, and log level as one JSON file in your
workspace's git repo. The document endpoints hand you that file — not a
projection of it — and take it back:

```
GET  /v1/flags/{key}/document         PUT  /v1/flags/{key}/document
GET  /v1/configs/{key}/document       PUT  /v1/configs/{key}/document
GET  /v1/log-levels/{key}/document    PUT  /v1/log-levels/{key}/document
```

Reach for them when [the PATCH](#updating-a-flag) can't express what you
want: multi-rule targeting, variants, tags and other metadata,
`readyForCleanup`, `access` — or when you need to put a previous version
back. For a plain toggle, value, or rollout, the PATCH is still the easier
call and the safer default.

### Reading a document

```bash
curl https://api.quonfig.com/v1/flags/checkout-redesign/document \
  -H "Authorization: Bearer $QUONFIG_API_KEY"
```

```json
{
  "commitSha": "8c1f2ab3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
  "document": {
    "$schema": "https://api.quonfig.com/schemas/v1/stored-config.json",
    "key": "checkout-redesign",
    "type": "feature_flag",
    "valueType": "bool",
    "name": "Checkout redesign",
    "access": "standard",
    "tags": ["checkout"],
    "readyForCleanup": false,
    "default": {
      "rules": [
        { "criteria": [{ "operator": "ALWAYS_TRUE" }], "value": { "type": "bool", "value": false } }
      ]
    },
    "environments": [
      {
        "id": "production",
        "rules": [
          {
            "criteria": [
              { "propertyName": "user.email", "operator": "PROP_ENDS_WITH_ONE_OF", "valueToMatch": { "type": "string_list", "value": ["@acme.com"] } }
            ],
            "value": { "type": "bool", "value": true }
          },
          { "criteria": [{ "operator": "ALWAYS_TRUE" }], "value": { "type": "bool", "value": false } }
        ]
      }
    ],
    "variants": []
  }
}
```

Three properties make this different from `GET /v1/flags/{key}`:

- **Verbatim.** `access`, `$schema`, `type`, and everything else the detail
  endpoints project away come back exactly as stored. Whatever you read is
  a valid body for the PUT.
- **Never validated.** Reads aren't checked against the current schema, so
  a version written long ago still reads even when it would no longer pass
  validation today. Seeing history is the point.
- **Nothing is resolved.** An encrypted value is the stored ciphertext with
  its `decryptWith` key name; an `ENV_VAR` value is the stored `source` and
  `lookup` pair. Quonfig servers never decrypt and never read an
  environment variable on your behalf — that happens in your runtime.

`commitSha` is the version handle: pass it straight back as the PUT's
`expectedCommitSha`.

### Reading an earlier version

Add `?at=<sha>` to read the document as of any commit instead of the
current one:

```bash
curl "https://api.quonfig.com/v1/flags/checkout-redesign/document?at=3d9e017" \
  -H "Authorization: Bearer $QUONFIG_API_KEY"
```

The sha is a full or abbreviated git SHA (4–40 hex characters) — from a
[history](#history-and-activity) response, from `/v1/activity`, or from the
`previousCommitSha` a write handed back. The response's `commitSha` echoes
the sha you asked for, and `document` is what was stored at that commit.

Because this reads git rather than the current state, it tells two 404s
apart: an unknown key ("Flag x not found") and a key that exists today but
didn't exist yet at that commit ("Flag x did not exist at commit 3d9e017").
If the file at that commit isn't parseable JSON — a hand-edited history, a
bad merge — you get `422`, not a `500`: the request was fine, the stored
bytes just aren't a document.

### Replacing a document

`PUT` writes a document back. Two rules do most of the work.

**It is a full replacement, not a merge.** What you send is what gets
stored, so a field you leave out is *deleted*. Always start from a GET of
the document and edit that — never hand-build the body. (Deletion being
expressible is the point: an undo has to be able to remove a field the bad
write added.)

**`expectedCommitSha` is required**, and must come from a fresh GET of the
same document. A full replacement built on a stale read would silently
discard whatever landed in between, so read-before-write is enforced by
contract here rather than left to you. If the document changed since, the
write fails with `409` and `details.code: "STALE_COMMIT_SHA"`, and nothing
is written — re-read, re-apply your edit, and send again. Never retry the
same body.

```bash
curl -X PUT \
  https://api.quonfig.com/v1/flags/checkout-redesign/document \
  -H "Authorization: Bearer $QUONFIG_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "expectedCommitSha": "8c1f2ab3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
  "document": { "...": "the document you read, with your edit applied" }
}
JSON
```

```json
{
  "key": "checkout-redesign",
  "changed": true,
  "commitSha": "5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
  "previousCommitSha": "8c1f2ab3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9"
}
```

The rest of the contract:

- **Identity is fixed by the path.** `document.key` must equal the key in
  the URL, and `document.type` must match the family — `feature_flag`,
  `config`, or `log_level`. A mismatch is a `400`: this endpoint replaces
  one document in place, it can't rename or move it.
- **`$schema` is server-stamped.** Send it, omit it, or send a stale one —
  the stored value is the same either way.
- **Writes are validated even though reads aren't.** The body has to pass
  the current stored-config schema, so restoring a *very* old version can
  come back `400` naming the field that no longer validates. Fix the JSON
  forward and PUT again.
- **Changing `access` is permission-checked**, exactly as in the app: you
  need edit permission for the tier the document is in today *and* for the
  tier you're moving it to. See
  [Authorization](/docs/explanations/features/authorization).
- **Update-only.** The endpoint never creates and never deletes — a PUT to
  an unknown key is a `404`. Creating and deleting items stays in the app
  and the CLI.
- **No-op writes cost nothing.** If your document is deep-equal to what's
  stored, the response is `changed: false` with the current `commitSha` and
  no commit is made. Key order and a re-stamped `$schema` don't count as
  changes, and `previousCommitSha` is absent because nothing was written.
- **No targeting guard.** Unlike the PATCH, there is no fail-closed check
  on targeting rules here. That's deliberate: this endpoint can write any
  valid document, which is exactly what lets it put replaced rules *back*.
  Its safety is git — `expectedCommitSha` forces read-before-write, every
  version is retained, and every write names the version it moved off.

### Undoing a write

Restore is a recipe, not an endpoint. Every write that changed something —
the PATCH and the PUT alike — returns `previousCommitSha`, the version it
moved off. Read that version, then put it back.

```bash
KEY=checkout-redesign
DOC="https://api.quonfig.com/v1/flags/$KEY/document"
AUTH="Authorization: Bearer $QUONFIG_API_KEY"

# The bad write's response named the version it replaced:
#   { "changed": true, "commitSha": "b0b0b0b...", "previousCommitSha": "a1b2c3d..." }
BAD_WRITE_REPLACED=a1b2c3d

# 1. The document as it stood before the bad write.
OLD=$(curl -s "$DOC?at=$BAD_WRITE_REPLACED" -H "$AUTH" | jq .document)

# 2. Where the flag is RIGHT NOW — this is what the PUT pins to.
NOW=$(curl -s "$DOC" -H "$AUTH" | jq -r .commitSha)

# 3. Put the old document back.
jq -n --argjson document "$OLD" --arg sha "$NOW" \
  '{document: $document, expectedCommitSha: $sha}' \
  | curl -s -X PUT "$DOC" -H "$AUTH" \
      -H "Content-Type: application/json" --data-binary @-
```

```json
{
  "key": "checkout-redesign",
  "changed": true,
  "commitSha": "cafe1234cafe1234cafe1234cafe1234cafe1234",
  "previousCommitSha": "b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0"
}
```

The one thing to get right is **step 3 pins to the current sha, not the
historical one**. `expectedCommitSha` means "I have read the version I am
about to overwrite" — that's the bad write, sitting at the top of the
branch. The old sha only ever appears in `?at=`.

Two consequences worth stating plainly:

- **Undo is a normal write.** It commits forward, attributed to your key,
  with the bad commit still in history. Nothing is rewritten or lost, and
  `qfg`, the app, and this API all agree on what happened.
- **It recovers what the PATCH can't.** Rules deleted by a
  `replaceTargeting: true` PATCH come back through this recipe, because the
  document endpoint can write the multi-rule document the PATCH could only
  overwrite. That's the reason the pair exists.

### Log levels

Log levels have no list or detail endpoint in v1 — the document pair is
their entire API surface. A log-level document is shaped like any other
stored config, with `type` `log_level` and `valueType` `log_level`:

```json
{
  "$schema": "https://api.quonfig.com/schemas/v1/stored-config.json",
  "key": "log-level.checkout-service",
  "type": "log_level",
  "valueType": "log_level",
  "default": {
    "rules": [
      { "criteria": [{ "operator": "ALWAYS_TRUE" }], "value": { "type": "log_level", "value": "INFO" } }
    ]
  },
  "environments": [
    {
      "id": "production",
      "rules": [
        { "criteria": [{ "operator": "ALWAYS_TRUE" }], "value": { "type": "log_level", "value": "WARN" } }
      ]
    }
  ],
  "variants": []
}
```

Everything above applies unchanged: `?at=` reads any past version, PUT is a
full replacement with a required `expectedCommitSha`, and the endpoint
updates only. There's no way to *discover* log-level keys over v1 — the
[activity feed](#history-and-activity) shows the ones that changed
recently, and the app lists them all.

## Errors

Every non-2xx response is a JSON envelope:

```json
{
  "error": "NOT_FOUND",
  "message": "Flag checkout-redesign not found",
  "details": { }
}
```

`error` is a stable machine-readable code, `message` is human-readable, and
`details` (present when useful) carries structured data — validation issues
on `400`, and a `details.code` discriminator where one status has several
causes. Match on `error` (and `details.code`), never on `message` text.

| HTTP | `error` | `details.code` | When |
|---|---|---|---|
| 400 | `BAD_REQUEST` | — | Malformed parameter or body; value doesn't match the flag's `valueType`; bad rollout; `limit` out of range or a `cursor` this server didn't mint; a malformed `?at` sha; a `document` whose `key` or `type` disagrees with the URL, or that fails the stored-config schema |
| 401 | `UNAUTHORIZED` | — | Missing, invalid, or revoked key; disabled service account |
| 402 | `BILLING_INACTIVE` | — | The organization's subscription is inactive |
| 403 | `FORBIDDEN` | `PERMISSION_DENIED` | The key's principal can't edit this flag in this environment, or can't move a document between `access` tiers |
| 404 | `NOT_FOUND` | — | Unknown flag/config/log-level key, environment, or path; a PUT to a key that doesn't exist; a key that didn't exist yet at the requested `?at` commit |
| 409 | `CONFLICT` | `TARGETING_RULES_PRESENT` | PATCH would replace targeting rules without `replaceTargeting: true` (the document endpoints have no such guard) |
| 409 | `CONFLICT` | `STALE_COMMIT_SHA` | `expectedCommitSha` no longer matches — the only 409 the document endpoints raise |
| 422 | `UNPROCESSABLE_CONTENT` | `VERIFY_REJECTION` | The change was rejected by config validation |
| 422 | `UNPROCESSABLE_CONTENT` | — | The content stored at the requested `?at` commit isn't a JSON object |
| 429 | — | — | [Rate limit exceeded](#rate-limits) — honor `Retry-After` |
| 503 | `SERVICE_UNAVAILABLE` | — | Workspace provisioning in progress, or a transient storage failure — safe to retry |

These responses are also declared per-operation in the
[OpenAPI spec](https://api.quonfig.com/v1/openapi.json), so generated
clients know the envelope shape.

## Rate limits

Each key gets a generous per-key rate limit — on the order of a few
requests per second sustained, with burst headroom well above that. It
exists to stop runaway retry loops, not to squeeze legitimate use: a
well-behaved script or agent should never see it. The exact numbers may be
tuned over time, so don't hard-code them.

Over the limit, requests fail with `429` and a `Retry-After` header giving
the number of seconds to wait. The contract is simple: **wait `Retry-After`
seconds, then retry.** Clients that back off correctly recover immediately;
clients that hammer through 429s stay throttled.

## Versioning

The API is versioned in the path, and `v1` is stable:

- **Within v1, changes are additive only** — new endpoints, new optional
  request fields, new response fields, new values in open string sets
  (`valueType`, `operator`, statuses). Your client should ignore fields and
  string values it doesn't recognize; generated clients from the spec below
  do this naturally.
- **Breaking changes mint `/v2`** — v1 keeps working. Removing or renaming
  a field, changing a type, or changing an endpoint's semantics never
  happens silently inside v1.

## OpenAPI spec & client generation

The machine-readable contract lives at:

```
https://api.quonfig.com/v1/openapi.json
```

Browse it as a rendered reference at
[`https://api.quonfig.com/v1/docs`](https://api.quonfig.com/v1/docs) — same
spec, no client generation required.

The raw spec declares every operation, schema, and error response, so
standard generators produce a complete typed client. For example:

```bash
# TypeScript (fetch-based)
npx @hey-api/openapi-ts \
  -i https://api.quonfig.com/v1/openapi.json \
  -o src/quonfig-client

# Any of openapi-generator's 50+ languages, e.g. Go
openapi-generator generate \
  -i https://api.quonfig.com/v1/openapi.json \
  -g go -o quonfig-client
```

Authentication is declared as the `apiKey` HTTP bearer scheme — supply your
`qf_uk_` / `qf_sa_` key wherever your generated client takes a bearer
token.

:::tip Agents and LLM tooling
The spec is also the right thing to hand to agent frameworks that consume
OpenAPI directly — point them at `/v1/openapi.json` and scope them with a
[service-account key](#authentication) so their changes are attributed to
the bot, not to you.

For MCP clients — Claude Code, Claude Tag, and anything else that speaks the
protocol — you don't need the spec at all: this surface is already exposed as
tools by the [Quonfig MCP server](/docs/api/mcp-server).
:::
