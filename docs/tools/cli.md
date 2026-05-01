---
title: CLI
sidebar_label: CLI
---

# CLI

The Quonfig CLI provides powerful tools for creating, modifying, and getting information about your configuration and flags. It also includes TypeScript code generation capabilities to provide type-safe access to your flags and configs.

## Installation

On a system with Node version 18+, run

```bash
npm install -g @quonfig/cli
```

## Authentication

First, authenticate with Quonfig:

```bash
qfg login
```

This will open your browser and authenticate you with Quonfig. You can also use profiles to manage multiple workspaces:

```bash
qfg login --profile my-company
```

For additional details about authentication, profiles, and troubleshooting, see the [`login` command documentation](#login) below.

## Usage

See `qfg --help` for all the available commands. `qfg [COMMAND] --help` will give you detailed information about a given command.

`qfg` is designed for humans first, but all commands support a `--json` flag to output JSON instead.

## Global Flags

These flags are available for all commands:

- `--verbose` - Enable verbose output for debugging and detailed logging
- `--no-color` - Disable colored output (useful for CI/CD or when piping output)
- `--interactive / --no-interactive` - Force interactive mode on/off (defaults to auto-detect)
- `--json` - Format output as JSON instead of human-readable text
- `--profile <name>` - Use a specific authentication profile (available on API commands)

Examples:
```bash
# Get detailed logging information
qfg list --verbose

# Generate clean output for scripts
qfg get my.config --no-color --json

# Force non-interactive mode for automation
qfg create my.flag --type boolean-flag --value=true --no-interactive

# Use a specific profile
qfg list --profile production
```

## TypeScript Code Generation

**⭐ Recommended**: The `generate` command creates TypeScript definitions and type-safe clients for your Quonfig configuration, providing autocomplete and type safety in your IDE.

`generate` can read from either a local copy of your workspace (paired with `qfg pull`) or directly from the API in one shot — see [the `generate` reference](#generate) for the in-memory mode.

### Quick Start

```bash
# Step 1: clone or update your workspace config files locally
qfg pull --dir ./my-config

# Step 2: generate TypeScript definitions from the local files
qfg generate --dir ./my-config
```

To avoid repeating `--dir` in every command, set the `QUONFIG_DIR` environment variable:

```bash
export QUONFIG_DIR=./my-config
qfg pull
qfg generate
```

This generates TypeScript files in the `generated/` directory:
- `quonfig-client-types.d.ts` - Type definitions for React/JavaScript
- `quonfig-client.ts` - Type-safe React/JavaScript client

**Filter**: The `react-ts` target only includes configs with "Send to Client SDKs" enabled or configs of type `FEATURE_FLAG`. If a config is missing from generated types, check that setting in the Quonfig dashboard.

### Generate for Node.js

```bash
qfg pull --dir ./my-config
qfg generate --dir ./my-config --targets node-ts
```

This generates:
- `quonfig-server-types.d.ts` - Type definitions for Node.js
- `quonfig-server.ts` - Type-safe Node.js client

The `node-ts` target includes **all** configs regardless of client SDK settings.

### Generate for Both Platforms

```bash
qfg pull --dir ./my-config
qfg generate --dir ./my-config --targets react-ts,node-ts
```

### CI/CD Integration

Run both steps in your pipeline to keep generated types in sync with your workspace:

```bash
qfg pull --dir ./my-config
qfg generate --dir ./my-config --output-directory ./src/generated
```

### Configuration File

Create a `quonfig.config.json` file in your project root to customize output:

```json
{
  "outputDirectory": "src/generated",
  "targets": {
    "react-ts": {
      "outputDirectory": "src/client/generated",
      "declarationFileName": "quonfig-types.d.ts",
      "clientFileName": "quonfig-client.ts"
    },
    "node-ts": {
      "outputDirectory": "src/server/generated",
      "declarationFileName": "quonfig-server-types.d.ts",
      "clientFileName": "quonfig-server.ts"
    }
  }
}
```

### Using Generated Types

Once generated, import and use the type-safe clients:

```typescript
// For React — the generator emits both a QuonfigTypesafeReact class
// and a ready-to-use hook bound to it.
import { useQuonfig, QuonfigTypesafeReact } from './generated/quonfig-client';

function Nav() {
  const q = useQuonfig();
  return q.buildDarkMode() ? <DarkNav /> : <LightNav />;
}

// For Node.js — wrap a Quonfig instance to get typed accessors.
import { Quonfig } from '@quonfig/node';
import { QuonfigTypesafeNode } from './generated/quonfig-server';

const quonfig = new Quonfig({ sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY! });
await quonfig.init();
const typed = new QuonfigTypesafeNode(quonfig);

typed.buildDarkMode();                    // boolean, no string keys
typed.get('build.dark-mode');             // same value, key autocompleted
```

## Commands

### generate-new-hex-key

`qfg generate-new-hex-key` generates a cryptographically secure hex key suitable for encrypting config values with the `--secret` flag.

Example:
```bash
qfg generate-new-hex-key
```

This outputs a 64-character hex key like:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

Use this key when creating or updating configs with encryption:
```bash
# Create an encrypted config using the generated key
qfg create my.secret --type string --value "sensitive data" --secret --secret-key-name "my-encryption-key"
```

**Use cases:**
- Encrypting sensitive configuration values
- Setting up encryption keys for different environments
- Generating keys for config value protection

### pull

`qfg pull` clones or updates a local copy of your workspace config files. This is required before running `generate`, and it is also how you edit flag JSON directly for anything beyond the `set-default` / `set-rollout` shortcuts.

Options:
- `--dir <path>` - Local directory to clone/update (defaults to `QUONFIG_DIR` env var)
- `--workspace <id>` - Workspace ID (defaults to active profile)

Examples:
```bash
# Clone or update into a local directory
qfg pull --dir ./my-config

# Use QUONFIG_DIR env var instead of --dir
export QUONFIG_DIR=./my-config
qfg pull
```

#### Editing JSON for targeting rules

Once you have a local copy, editing the JSON file is how you express rules that go beyond a catch-all default or a simple percentage rollout — for example "`user.email == jdwyah@gmail.com` → `true`, everyone else → `false`", segment membership, or custom properties. See the [Targeting rules](#targeting-rules) section below for the full workflow and a sample rule.

After editing files:
```bash
qfg verify ./my-config                           # validate JSON before pushing
git -C ./my-config add -A
git -C ./my-config commit -m "feat: target beta cohort"
git -C ./my-config push
```

### generate

`qfg generate` creates TypeScript definitions and type-safe clients for your Quonfig configuration.

It can read from either:

- **A local directory** (default when `--dir`/`QUONFIG_DIR` is set) — pair with `qfg pull` to keep a checked-in copy of the workspace files.
- **The API** (when no local directory is given) — `generate` mints a Gitea read token, clones the workspace into a temp dir, generates from it, and cleans up. Use this in CI or one-shot scripts where you don't want to keep a working copy on disk.

Options:
- `--dir <path>` - Path to local config directory (defaults to `QUONFIG_DIR` env var). When unset, `generate` fetches the workspace in-memory.
- `--workspace <slug-or-id>` - Workspace to fetch when running without `--dir`. Required if `QUONFIG_API_KEY` is set without `QUONFIG_WORKSPACE`.
- `--targets <targets>` - Specify target platforms: `react-ts` (default) or `node-ts`
- `--output-directory <dir>` - Custom output directory

Examples:
```bash
# Pull-then-generate (keeps a local copy)
qfg pull --dir ./my-config
qfg generate --dir ./my-config

# One-shot generate from the API (CI / no local copy)
qfg generate --workspace acme-prod --targets node-ts

# Generate for Node.js from a local dir
qfg generate --dir ./my-config --targets node-ts

# Generate for both platforms
qfg generate --dir ./my-config --targets react-ts,node-ts

# Custom output directory
qfg generate --dir ./my-config --output-directory src/generated
```

This generates:
- Type definitions (`.d.ts` files) with full TypeScript support
- Type-safe client classes with camelCase method names
- IntelliSense autocomplete for all configs and feature flags
- Context-aware typing for better developer experience

:::info
For detailed setup instructions, configuration options, and usage examples, see the [TypeScript Code Generation](#typescript-code-generation) section above.
:::

### login

`qfg login` authenticates you with Quonfig using OAuth. This opens your browser to complete the authentication flow and stores tokens locally for subsequent CLI commands.

Options:
- `--profile <name>` - Profile name to create or update (defaults to "default")
- `--json` - Format output as JSON

Example:
```bash
qfg login
qfg login --profile production
```

Profiles allow you to manage multiple Quonfig accounts or environments. Use the `QUONFIG_PROFILE` environment variable or `--profile` flag to specify which profile to use.

### logout

`qfg logout` clears all stored authentication tokens from your local machine. After logging out, you'll need to run `qfg login` again to authenticate.

Example:
```bash
qfg logout
```

This affects all profiles and is useful for security, troubleshooting authentication issues, or switching accounts.

### list

`qfg list` shows keys for your configurations, feature flags, log levels, schemas, and segments. By default, all types are shown, but you can filter to specific types.

Options:
- `--configs` - Include only configs
- `--feature-flags` - Include only feature flags  
- `--log-levels` - Include only log levels
- `--schemas` - Include only schemas
- `--segments` - Include only segments
- `--json` - Format output as JSON
- `--profile <name>` - Use specific profile

Examples:
```bash
qfg list
qfg list --feature-flags
qfg list --configs --feature-flags
qfg list --json
```

When you specify one or more type flags, only those types are included in the output.

### info

`qfg info NAME` shows detailed information about a specific config, feature flag, or other resource, including current values across environments and recent evaluation statistics.

Example:
```bash
qfg info my.config.name
```

This displays:
- Current values per environment
- Links to the web console
- Usage statistics over the last 24 hours
- Evaluation breakdowns by value

### interactive

`qfg interactive` (or just `qfg`) launches an interactive CLI mode where you can browse and manage your resources through a menu-driven interface.

Example:
```bash
qfg
qfg interactive
```

This provides an easier way to explore your configs and flags without remembering specific command syntax.

### override

`qfg override` writes a top-priority rule on a flag, keyed on the dev-only `quonfig-user.email` property, that fires only for SDK clients which set your email in their context. This lets you test a value locally without affecting anyone else. You must `qfg login` first — the user identity comes from your saved tokens.

Surface:
- `qfg override` — list flags where you have an override (in the current env).
- `qfg override <key> <value>` — set an override. The value's type is inferred: `true`/`false` → bool, integer → int, decimal → double, JSON-shaped (`{...}`/`[...]`) → json, anything else → string.
- `qfg override <key> --remove` — remove your override on `<key>`.
- `qfg override --clear` — remove all of your overrides in the current env.

Flags:
- `--env <env>` — environment to operate in. Defaults to `$QUONFIG_ENVIRONMENT`. Required if neither is set.
- `--remove` — remove your override on the given key.
- `--clear` — remove every override you have in this env.

Examples:
```bash
qfg override                                  # list your overrides
qfg override my.flag true                     # bool
qfg override my.flag 42                       # int
qfg override my.flag '{"a":1}'                # json
qfg override my.flag --remove                 # remove just this one
qfg override --clear                          # remove all of yours
qfg override my.flag true --env=staging       # operate in a specific env
```

Overrides on `production` are accepted but inert for SDK clients that don't set `quonfig-user.email` in their context (most production SDKs don't), so the CLI prints a soft warning when you target `production`.

### Targeting rules

Quonfig evaluates a flag by walking its rules in order. The CLI gives you three ways to change what those rules return:

| You want to…                                    | Use                 |
|-------------------------------------------------|---------------------|
| Set the catch-all fallback (what everyone else gets) | `qfg set-default`   |
| Run a percentage rollout / A-B test / canary    | `qfg set-rollout`   |
| Target by user email, plan, segment, or any custom property | Edit the JSON config directly |

`override` is deliberately NOT on this list — it only affects *your* SDK key. For production targeting, reach for one of the three above.

#### Editing JSON directly

The local JSON config supports every targeting operator the dashboard UI supports (`PROP_IS_ONE_OF`, `IN_SEG`, `PROP_MATCHES`, etc.). Two commands print the operator reference:

```bash
qfg config-schema                # human-readable operator reference + worked example
qfg config-schema --json-schema  # machine-readable JSON Schema (e.g. for IDE completion)
```

For IDE autocomplete while editing, point your editor at `our-config/quonfig.schema.json` (or the equivalent file in your workspace clone).

#### Sample rule — target a single user

To express "`user.email == jdwyah@gmail.com` → `true`, everyone else → `false`" for `forcerank.my.flag`:

```json
{
  "key": "forcerank.my.flag",
  "type": "feature_flag",
  "valueType": "bool",
  "default": {
    "rules": [
      {
        "criteria": [
          {
            "operator": "PROP_IS_ONE_OF",
            "propertyName": "user.email",
            "valueToMatch": { "type": "string_list", "value": ["jdwyah@gmail.com"] }
          }
        ],
        "value": { "type": "bool", "value": true }
      },
      {
        "criteria": [{ "operator": "ALWAYS_TRUE" }],
        "value": { "type": "bool", "value": false }
      }
    ]
  },
  "environments": [],
  "variants": []
}
```

End-to-end workflow:

```bash
qfg pull --dir ./my-config                       # clone or refresh local copy
$EDITOR ./my-config/feature-flags/forcerank.my.flag.json
qfg verify ./my-config                           # catch typos: unknown operators, missing propertyName, etc.
git -C ./my-config add -A
git -C ./my-config commit -m "feat: target jdwyah for forcerank.my.flag"
git -C ./my-config push
```

`qfg verify` validates against the same schema the SDK uses, so a passing verify is a strong signal the rule will evaluate correctly.

### profile

`qfg profile` manages authentication profiles and allows you to set the default profile for CLI operations.

Example:
```bash
qfg profile
```

This command helps you switch between different Quonfig accounts or workspace configurations.

### schema

`qfg schema NAME` manages Zod schema definitions for your configs, providing type safety and validation.

Options:
- `--get` - Get the current schema definition
- `--set-zod <schema>` - Set a new Zod schema definition
- `--profile <name>` - Use specific profile

Examples:
```bash
qfg schema my-schema --set-zod="z.object({url: z.string()})"
qfg schema my-schema --get
```

Schemas enable runtime validation and better TypeScript integration when using generated types.

### workspace

`qfg workspace` allows you to switch between different Quonfig workspaces or display your current active workspace.

Example:
```bash
qfg workspace
```

This helps when you have access to multiple Quonfig workspaces and need to switch contexts.

#### workspace create

`qfg workspace create <slug>` provisions a new workspace under one of your organizations. Useful for agent-driven setups and scripted environments where you don't want to click through the UI.

Options:
- `--name <name>` - Display name (defaults to the slug)
- `--org <slug-or-id>` - Organization slug or UUID. Required if your account has more than one org.

Examples:
```bash
qfg workspace create my-new-workspace
qfg workspace create acme-prod --name "Acme Production" --org acme-corp
```

On success, prints the workspace ID, slug, Gitea repo URL, and the default environments (`development`, `production`, `staging`). Returns a non-zero exit code with a clear message on slug collisions, missing org membership, or auth failure.

### set-default

`qfg set-default NAME` allows you to change the default value for an environment. Any rules defined for that environment will still apply; only the default is changed.

This can be particularly helpful for flipping a flag on or off for everyone.

Example:

```bash
qfg set-default my.flag.name --value=true --environment=staging
```

### create

`qfg create NAME` creates a new flag or config in Quonfig. You can use this to create basic values, encrypted secrets, or values provided by ENV vars.

Supported types: `boolean-flag`, `boolean`, `string`, `double`, `int`, `string-list`, `json`, `duration`, `int-range`, `bytes`, `log_level`

Examples:

```bash
# Basic types
qfg create my.new.string --type string --value="hello world"
qfg create my.feature --type boolean-flag --value=true
qfg create my.timeout --type int --value=30
qfg create my.price --type double --value=19.99

# Complex types
qfg create my.tags --type string-list --value="tag1,tag2,tag3"
qfg create my.config --type json --value='{"key": "value"}'
qfg create my.duration --type duration --value="30s"
qfg create my.range --type int-range --value="1-100"
qfg create my.size --type bytes --value="1GB"

# Encrypted values (requires string type)
qfg create my.secret --type string --value="sensitive data" --secret

# Environment variable sourced
qfg create my.db.url --type string --env-var=DATABASE_URL

# Confidential (non-encrypted) values
qfg create my.api.key --type string --value="key123" --confidential

# Log level (key must start with `log-level.`; value is one of TRACE/DEBUG/INFO/WARN/ERROR/FATAL)
qfg create log-level.my-app --type log_level --value=INFO
```

**Encryption vs Confidential:**
- `--secret`: Encrypts the value, requires decryption key
- `--confidential`: Marks value as sensitive but doesn't encrypt (useful for display purposes)
- `--secret` implies `--confidential`, so you don't need both

**Log levels:** `--type log_level` requires the key to start with `log-level.` and the value to be a recognized level name (case-insensitive). `--secret`, `--env-var`, and `--confidential` are rejected on this type. To target individual loggers without creating one config per logger, write rules on the `quonfig-sdk-logging.key` context property — see the SDK docs for details.

### log-level

`qfg log-level NAME` is a thin alias for `qfg create --type log_level NAME`. It exists for discoverability — running `qfg log-level --help` surfaces the `log-level.` prefix rule and the `quonfig-sdk-logging.key` per-logger targeting pattern in one place.

Example:
```bash
qfg log-level log-level.my-app --value=WARN
```

### get

`qfg get NAME` will give you the value for a config in the environment tied to your SDK key.

Example: 

```bash
qfg get aws.bucket
```

#### Interpolating a value from Quonfig

Since the CLI is a well-behaved citizen of the command line, you can use it to compose other commands.

Here's an example command to download a file from s3 using the [aws cli](https://aws.amazon.com/cli/). Quonfig values are interpolated for the aws key and bucket name.

```bash
aws s3api get-object \
  --bucket $(qfg get aws.bucket) \
  --key $(qfg get aws.db.backup.filename) \
  db.tgz
```

As you'd expect, you can similarly use `qfg` in a pipeline with `xargs` and similar.

### info

`qfg info NAME` will show details about an item in Quonfig. Example output:

```
qfg info aws.bucket

https://app.cloud/account/projects/XYZ/configs/aws.bucket

- Default: false
- Staging: true
- Production: [see rules] https://app.cloud/account/projects/XYZ/configs/aws.bucket?environment=588

Evaluations over the last 24 hours:

Production: 34,789
- 33% - false
- 67% - true

Staging: 17,138
- 100% - true

Development: 7
- 100% - false
```

### list

`qfg list` will show the names of items in your Quonfig account. You can pass flags to filter this to only show items of a specific type (e.g. segments).

### override

`qfg override` lets you override the value for a config or feature flag for your quonfig.com user. This is especially helpful for testing both sides of a feature flag.

Are you using a backend key for your server code and a frontend key for your UI? No problem; this override will apply to any environment using an SDK key created by your quonfig.com user.

Example:

```bash
qfg override my.flag.name --value=true
```

## Troubleshooting

### Common Issues

**Authentication Problems:**
```bash
# Clear authentication and re-login
qfg logout
qfg login

# Use specific profile
qfg login --profile production
```

**Configuration Generation Issues:**
```bash
# Generate with verbose output to see detailed logs
qfg generate --verbose

# Check if config file exists and is valid JSON
cat quonfig.config.json | jq .
```

**Network/API Issues:**
```bash
# Test connectivity with verbose output
qfg list --verbose

# Check API endpoint override
echo $QUONFIG_API_URL_OVERRIDE
```

### Environment Variables

- `QUONFIG_API_URL_OVERRIDE` - Override the default API URL
- `QUONFIG_DIR` - Default local directory for `pull` and `generate` (avoids repeating `--dir`)
- `QUONFIG_PROFILE` - Set default profile to use
- `NO_COLOR` - Disable colored output
