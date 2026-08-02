---
title: REST API
sidebar_label: REST API
sidebar_position: 1
---

# REST API

The Quonfig REST API lets scripts, CI jobs, and agents manage flags and
configs over plain HTTPS: list and inspect flags, read the git-backed audit
trail, and update what an environment serves. It is the same control plane
the app and CLI use — a change made here shows up everywhere, with full
attribution in your workspace's git history.

```
Base URL: https://api.quonfig.com/v1
```

The API is described by an OpenAPI 3.1 spec at
[`https://api.quonfig.com/v1/openapi.json`](https://api.quonfig.com/v1/openapi.json)
— that spec is the published contract, and you can
[generate a typed client from it](#openapi-spec--client-generation).

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

The v1 surface is deliberately small — read everything, plus one focused
write. All requests and responses are JSON.

| Method | Path | What it does |
|---|---|---|
| GET | `/v1/whoami` | Identify the calling key: principal + workspace |
| GET | `/v1/workspaces` | The workspace(s) this credential can act on |
| GET | `/v1/flags` | List feature flags (filter with `?tag=` and `?status=`) |
| GET | `/v1/flags/{key}` | Full flag detail: default rules, per-environment rules, rollouts, variants |
| GET | `/v1/flags/{key}/history` | Git commits that changed this flag, most recent first |
| PATCH | `/v1/flags/{key}/environments/{env}` | Update what one environment serves ([see below](#updating-a-flag)) |
| GET | `/v1/configs` | List configs |
| GET | `/v1/configs/{key}` | Full config detail |
| GET | `/v1/configs/{key}/history` | Git commits that changed this config |
| GET | `/v1/activity` | Workspace-wide change feed, or one item's translated history |

There is no pagination in v1: list responses return the whole workspace
(hundreds of items, not millions), and `/v1/activity` takes
`?limit=` (1–100, default 30).

### Reading flags and configs

`GET /v1/flags` summarizes each flag, including its derived lifecycle
`statuses` per production environment. Filter server-side with `?tag=` and
`?status=` — status is one of `pre_rollout`, `rollout`, `live`, or
`ready_for_cleanup`.

`GET /v1/flags/{key}` returns the full stored document: `default.rules`,
per-environment `environments[].rules` (including percentage rollouts),
`variants`, and the flag's current `commitSha` — the version handle you can
later pass as [`expectedCommitSha`](#concurrency-expectedcommitsha) when
writing. Configs have the same shape at `/v1/configs/{key}`.

Two things to know about the values you'll see:

- **Open value sets.** Fields like `valueType` and rule `operator` are
  strings with documented values (for example `bool`, `string`, `int`,
  `double`, `json`, `string_list`, `duration`, `log_level`), not closed
  enums — Quonfig may add values over time, and generated clients should
  tolerate unknown ones.
- **Encrypted values stay encrypted.** For secrets, `value` is the stored
  ciphertext and `decryptWith` names the config holding the decryption key.
  Decryption happens in your runtime — Quonfig servers never decrypt.

### History and activity

`GET /v1/flags/{key}/history` (and the configs twin) answers "who changed
this and when" straight from git: commit SHA, message, author, date, and
`isServiceAccount`.

`GET /v1/activity` is the workspace-wide feed with changes translated into
human-readable messages (`"production: enabled set to false"`). Pass
`?type=&key=` together (type is one of `feature_flag`, `config`,
`log_level`, `segment`, `schema`) to get one item's full translated history
instead.

## Updating a flag

`PATCH /v1/flags/{key}/environments/{env}` is the only write in v1. It sets
what one environment serves, expressed as **exactly one** of three
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
  "rules": [{ "criteria": [{ "operator": "ALWAYS_TRUE" }], "value": { "type": "bool", "value": false } }]
}
```

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
them. To deliberately replace targeting, resend with:

```json
{ "enabled": false, "replaceTargeting": true }
```

### Concurrency: `expectedCommitSha`

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
| 400 | `BAD_REQUEST` | — | Malformed parameter or body; value doesn't match the flag's `valueType`; bad rollout |
| 401 | `UNAUTHORIZED` | — | Missing, invalid, or revoked key; disabled service account |
| 402 | `BILLING_INACTIVE` | — | The organization's subscription is inactive |
| 403 | `FORBIDDEN` | `PERMISSION_DENIED` | The key's principal can't edit this flag in this environment |
| 404 | `NOT_FOUND` | — | Unknown flag/config key, environment, or path |
| 409 | `CONFLICT` | `TARGETING_RULES_PRESENT` | Write would replace targeting rules without `replaceTargeting: true` |
| 409 | `CONFLICT` | `STALE_COMMIT_SHA` | `expectedCommitSha` no longer matches |
| 422 | `UNPROCESSABLE_CONTENT` | `VERIFY_REJECTION` | The change was rejected by config validation |
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

It declares every operation, schema, and error response, so standard
generators produce a complete typed client. For example:

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
