# E2E Testing Runbook: Full Telemetry Flow (Local)

This document describes how to run the full telemetry end-to-end test locally,
covering flag evaluation, telemetry collection, ClickHouse ingestion, materialized
view fan-out, and UI sparkline/evaluation chart rendering.

---

## Architecture overview

All services run locally:

| Port | Service          | Purpose                                                            |
|------|------------------|--------------------------------------------------------------------|
| 3000 | app-quonfig      | Next.js UI + internal APIs, reads ClickHouse for sparklines/charts |
| 6550 | api-delivery     | Go HTTP server, serves configs to SDKs via SSE/polling             |
| 6555 | api-telemetry    | Hono HTTP server, receives telemetry POSTs, writes to ClickHouse   |
| 8092 | test-node        | Next.js test app using @quonfig/node, generates telemetry          |
| 8091 | test-staging-go  | Go test app using sdk-go, validates flag propagation (no telemetry)|
| 6543 | Postgres         | app-quonfig database (Docker)                                      |
| 6560 | ClickHouse       | Telemetry storage (Docker)                                         |

---

## Data flow

1. **test-node** evaluates flags via **api-delivery** (`GET /api/v2/configs`).
2. **sdk-node** collects evaluation summaries in memory.
3. **sdk-node** POSTs telemetry to **api-telemetry** (`POST /api/v1/telemetry/`).
4. **api-telemetry** authenticates the SDK key via **app-quonfig** (`GET /api/internal/sdk-key-lookup/{hash}`).
5. **api-telemetry** INSERTs into the `telemetry_raw` table in **ClickHouse**.
6. ClickHouse materialized views fan out to `evaluation_summaries`, `sparkline_daily`, etc.
7. **app-quonfig** queries ClickHouse destination tables for sparklines and evaluation charts.

---

## Prerequisites

- Docker running (Postgres and ClickHouse containers)
- Node.js, Go, pnpm installed
- ClickHouse tables and materialized views created (should already exist from previous setup)

---

## Startup order

Start services in this order. Each service depends on the ones above it.

1. **Docker containers** -- Postgres (:6543), ClickHouse (:6560)
2. **app-quonfig** on :3000 -- needs Postgres; provides SDK key lookups
3. **api-delivery** on :6550 -- needs app-quonfig for key lookups; needs staging Gitea for configs
4. **api-telemetry** on :6555 -- needs app-quonfig for key lookups; needs ClickHouse
5. **test-node** on :8092 -- needs api-delivery and api-telemetry
6. **test-staging-go** on :8091 -- needs api-delivery

---

## Environment setup

### app-quonfig/.env

Must have:

```
CLICKHOUSE_URL=http://localhost:6560
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
```

(CLICKHOUSE_PASSWORD is empty for local development.)

### api-delivery/.env

```
PORT=6550
APP_QUONFIG_URL=http://localhost:3000
GITEA_URL=https://git.quonfig-staging.com
GITEA_TOKEN=<from app-quonfig/.env>
REPO_BASE_DIR=./data/repos
```

### api-telemetry

**api-telemetry does NOT use dotenv.** It reads `process.env` directly. The default
`CLICKHOUSE_URL` is `http://localhost:6560`, which is correct for local development.

If you need to override, set env vars explicitly when starting:

```bash
CLICKHOUSE_URL=http://localhost:6560 pnpm dev
```

### test-node/.env

```
QUONFIG_API_KEY=qf_sk_production_staging_test_e7a2b4c9d1f6
QUONFIG_API_URL=http://localhost:6550
QUONFIG_TELEMETRY_URL=http://localhost:6555
QUONFIG_FLAGS=enable-dark-mode,max-retry-count,string-list
```

### test-staging-go/.env

```
QUONFIG_API_KEY=qf_sk_production_staging_test_e7a2b4c9d1f6
QUONFIG_API_URL=http://localhost:6550
QUONFIG_FLAGS=enable-dark-mode,max-retry-count,string-list
```

Note: `source .env` may not work in all shells. Use explicit env vars instead:

```bash
QUONFIG_API_KEY=qf_sk_production_staging_test_e7a2b4c9d1f6 \
QUONFIG_API_URL=http://localhost:6550 \
QUONFIG_FLAGS=enable-dark-mode,max-retry-count,string-list \
go run .
```

---

## SDK key setup

The test SDK key (`qf_sk_production_staging_test_e7a2b4c9d1f6`) must exist in
local Postgres. Its SHA512 hash is:

```
8f6e2017429502a0a659b211f270bc660a69ac050c861c8b1023bbddabc0cbc7f1c6bc743183529b02afcc18eb353f766bd198499e9d4c30ab51531001dacc3d
```

Insert if missing:

```sql
docker exec app-quonfig-postgres-1 psql -U quonfig -d quonfig -c "
INSERT INTO sdk_keys (workspace_id, environment_id, key_hash, key_type)
VALUES (
  'c0009b4e-b486-4d93-9534-3ef000a419be',
  'fa25a62a-c7e6-4b32-9c48-623fd0eb0b1b',
  '8f6e2017429502a0a659b211f270bc660a69ac050c861c8b1023bbddabc0cbc7f1c6bc743183529b02afcc18eb353f766bd198499e9d4c30ab51531001dacc3d',
  'backend'
) ON CONFLICT (key_hash) DO NOTHING;"
```

---

## Verification steps

### 1. Verify telemetry flow

Check that ClickHouse has received and materialized data:

```bash
curl -s "http://localhost:6560/" --data \
  "SELECT config_key, day, total_evals FROM sparkline_daily WHERE workspace_id = 'e2e-flags' ORDER BY day DESC FORMAT JSONEachRow"
```

### 2. Verify sparklines in UI

Open: http://localhost:3000/workspaces/c0009b4e-b486-4d93-9534-3ef000a419be/flags

Look for sparkline charts next to flag names.

### 3. Verify evaluation charts

Click on a flag (e.g., enable-dark-mode) to see the evaluation chart page.

### 4. Test flag change propagation

Change a flag value in the app-quonfig UI. Verify that test-staging-go (:8091)
shows the change within ~60s (git polling interval).

### 5. Verify new telemetry after flag change

After toggling a flag, test-node should start reporting the new value. Check
ClickHouse for updated evaluation summaries.

---

## Quick ClickHouse debugging

```bash
# Count telemetry rows
curl -s "http://localhost:6560/" --data \
  "SELECT count(*) FROM telemetry_raw FORMAT JSONEachRow"

# Recent evaluation summaries
curl -s "http://localhost:6560/" --data \
  "SELECT config_key, selected_value, count, received_at FROM evaluation_summaries WHERE workspace_id='e2e-flags' ORDER BY received_at DESC LIMIT 10 FORMAT JSONEachRow"

# Sparkline data
curl -s "http://localhost:6560/" --data \
  "SELECT * FROM sparkline_daily WHERE workspace_id='e2e-flags' FORMAT JSONEachRow"

# Check materialized views exist
curl -s "http://localhost:6560/" --data \
  "SELECT name, engine FROM system.tables WHERE database='default' FORMAT JSONEachRow"
```

---

## Known issues and snags

1. **Go SDK (sdk-go) has no telemetry.** Use test-node (sdk-node) for telemetry
   testing. sdk-go telemetry is a future task.

2. **Staging custom domains not in DNS.** The custom staging domains
   (api.quonfig-staging.com, app.quonfig-staging.com, telemetry.quonfig-staging.com)
   are not configured. Use Fly.io URLs (quonfig-api-delivery-staging.fly.dev)
   or run everything locally.

3. **api-telemetry does not load .env.** The api-telemetry service reads
   process.env directly without dotenv. The default CLICKHOUSE_URL
   (http://localhost:6560) works for local testing. For staging ClickHouse, set
   env vars explicitly.

4. **api-delivery does not serve environment-specific rules.** Configs are served
   with only default rules, not environment-specific overrides. Flags like
   enable-dark-mode show as OFF even though the production environment has them
   as true. This is a separate issue to fix.

5. **EMFILE errors with many services.** Running many Node.js services concurrently
   can hit the file descriptor limit on macOS. Kill unused services or increase
   ulimit.

6. **Telemetry reporter exponential backoff.** The sdk-node telemetry reporter
   starts at 8s delay and increases by 1.5x each sync. After a few minutes,
   syncs happen every 30-60s. For faster feedback during testing, you may want
   to reduce the initial delay.
