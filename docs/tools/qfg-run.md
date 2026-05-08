---
title: Running commands with injected env (`qfg run`)
sidebar_label: qfg run
---

# `qfg run` — inject Quonfig values as env vars

`qfg run` resolves Quonfig configs into environment variables and `exec`s a child process. Use it for anything that reads its config from `process.env` *before* user code runs and therefore can't call the SDK directly.

Concrete examples:

- `drizzle-kit migrate` reads `DATABASE_URL` at module import.
- `next build` and other build steps consume env vars during the build pipeline.
- `next-auth` resolves `AUTH_SECRET` at boot, before your application code initializes.
- One-shot scripts that you don't want to wrap in an SDK lifecycle.

For long-running services (Next.js servers, API workers, etc.) prefer initializing the SDK directly — see [`qfg run` vs SDK init](#qfg-run-vs-sdk-init) below.

## Syntax

Two ways to specify the env-var-to-config mapping. Both forms require the `--` separator between `qfg run` flags and the child command.

### Inline `--env`

```bash
qfg run --env DATABASE_URL=db.url -- drizzle-kit migrate
```

`--env` is repeatable. Each value takes the form `VAR=key.path`, where `VAR` is the environment variable name the child will see and `key.path` is the Quonfig config key.

### `--env-file`

```bash
qfg run --env-file=.qfg.env -- next build
```

The file holds one `VAR=key.path` per line. Blank lines and `#` comments are skipped.

```bash
# .qfg.env
AUTH_SECRET=auth.secret
DATABASE_URL=db.url
STRIPE_API_KEY=stripe.api.key
```

### The `--` separator

The `--` between Quonfig flags and the child command is **required**. Without it, oclif eats child flags that look like Quonfig flags (e.g. `--silent`).

```bash
qfg run --env DATABASE_URL=db.url -- drizzle-kit migrate    # OK
qfg run --env DATABASE_URL=db.url drizzle-kit migrate       # not parsed as a child command
```

## `package.json` examples

This is what most users will copy/paste:

```json
{
  "scripts": {
    "db:migrate": "qfg run --env DATABASE_URL=db.url -- drizzle-kit migrate",
    "build": "qfg run --env-file=.qfg.env -- next build"
  }
}
```

### Chaining commands

`qfg run` resolves once per invocation. To amortize one resolve across multiple steps, run them under a single shell:

```bash
qfg run --env-file=.qfg.env -- bash -c "npm run db:migrate && npm run build"
```

## Auth and environment — pick exactly one mode

`qfg run` uses one of two **mutually exclusive** auth/env modes. The rule is binary on purpose: tolerating "they happen to agree" lets a stale env var quietly drift past you until the day it disagrees in CI.

### Mode A — SDK key

Set `QUONFIG_BACKEND_SDK_KEY`. The SDK key encodes both the workspace and the environment, so do **not** also set `QUONFIG_ENVIRONMENT` or pass `--environment`.

```bash
export QUONFIG_BACKEND_SDK_KEY=qfg_sk_…
qfg run --env DATABASE_URL=db.url -- drizzle-kit migrate
```

This is the typical CI / Docker mode: the deploy pipeline injects `QUONFIG_BACKEND_SDK_KEY`, and `qfg run` evaluates against the environment that key was minted for.

### Mode B — User auth

After `qfg login`, set exactly one of `QUONFIG_ENVIRONMENT` (env var) or `--environment` (flag). Use this for local development against your own account.

```bash
qfg login
qfg run --env DATABASE_URL=db.url --environment=staging -- drizzle-kit migrate
```

or

```bash
qfg login
export QUONFIG_ENVIRONMENT=staging
qfg run --env DATABASE_URL=db.url -- drizzle-kit migrate
```

### Errors you'll see when you cross the streams

If you set `QUONFIG_BACKEND_SDK_KEY` **and** also pass `--environment` or set `QUONFIG_ENVIRONMENT`:

```
qfg run: QUONFIG_BACKEND_SDK_KEY is set, which encodes the environment.
Remove --environment and unset QUONFIG_ENVIRONMENT, or remove the SDK key.
```

If you have no SDK key and have set both `--environment` and `QUONFIG_ENVIRONMENT`:

```
qfg run: pass exactly one of --environment or QUONFIG_ENVIRONMENT (both are set).
```

If you have no SDK key and have set neither:

```
qfg run: no environment specified.
Either set QUONFIG_BACKEND_SDK_KEY (which encodes env) or
set QUONFIG_ENVIRONMENT / pass --environment after `qfg login`.
```

### `package.json` portability gotcha

If your repo's `package.json` has `qfg run` baked into a script, the script must work in every environment that runs it — laptop, CI, Docker. The trap: most monorepos set `QUONFIG_ENVIRONMENT` for long-running services so the SDK knows which environment to evaluate. **A CI Dockerfile that uses an SDK key for `qfg run` must NOT also set `QUONFIG_ENVIRONMENT`** — `qfg run` will fail with the ambiguous-mode error above, even though the same env var is correct for the running app.

The cleanest pattern is to leave `QUONFIG_ENVIRONMENT` unset in build/migrate steps and let the SDK key carry the environment.

## `qfg run` vs SDK init {#qfg-run-vs-sdk-init}

Use `qfg run` for one-shot work where there's no long-running process:

- Build steps (`next build`, `vite build`, …)
- Migrations (`drizzle-kit migrate`, `prisma migrate deploy`, `rails db:migrate`)
- One-off scripts and admin commands

Use SDK init (Next.js `instrumentation.ts`, an explicit `Quonfig` client in your server bootstrap, etc.) for long-running services. The SDK keeps an SSE connection open and applies live config updates without a restart, which `qfg run` cannot do — it resolves once at process start.

Some apps will use both: `qfg run` for the build/migrate steps in CI, SDK init for the running server.

## Override behavior

By default, values resolved by `qfg run` **override** matching env vars in the parent shell. The child process sees the Quonfig-resolved value even if `DATABASE_URL` was already exported.

This default is deliberate: most users invoke `qfg run` because they want Quonfig to be the source of truth. Falling back to the parent env silently would mean a half-set local shell could mask production values without warning.

If you want the opposite — keep parent env where set, only fill in the gaps — pass `--preserve-env`:

```bash
qfg run --env DATABASE_URL=db.url --preserve-env --environment=staging -- npm test
```

## Security note

Values resolved by `qfg run` end up in the child's environment. They're visible to that process via `process.env` and to anything inside the process via `printenv`/`/proc/self/environ`. This is the same threat model as any env-var-based secret injection — `qfg run` doesn't change it.

Practical rules:

- Don't pipe `qfg run` output into chat, logs, or CI artifacts in ways that would reveal resolved values.
- The child process can leak its env in stack traces, crash dumps, and debug endpoints. Treat it as such.
- For the most sensitive secrets, prefer the encrypted-secret pattern documented in [Secret Management](/docs/explanations/features/secret-management) — Quonfig stores ciphertext, the SDK decrypts in-process, and the plaintext never lands in `printenv`-visible env vars.
