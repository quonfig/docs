---
title: CLI
sidebar_label: CLI
---

# CLI

The Quonfig CLI provides powerful tools for creating, modifying, and getting information about your configuration and flags. It also includes TypeScript code generation capabilities to provide type-safe access to your flags and configs.

## Installation

On a system with Node version 18+, run

```bash
npm install -g @quonfig-com/cli
```

## Authentication

First, authenticate with Quonfig:

```bash
quonfig login
```

This will open your browser and authenticate you with Quonfig. You can also use profiles to manage multiple workspaces:

```bash
quonfig login --profile my-company
```

For additional details about authentication, profiles, and troubleshooting, see the [`login` command documentation](#login) below.

## Usage

See `quonfig --help` for all the available commands. `quonfig [COMMAND] --help` will give you detailed information about a given command.

`quonfig` is designed for humans first, but all commands support a `--json` flag to output JSON instead.

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
quonfig list --verbose

# Generate clean output for scripts
quonfig get my.config --no-color --json

# Force non-interactive mode for automation
quonfig create my.flag --type boolean-flag --value=true --no-interactive

# Use a specific profile
quonfig list --profile production
```

## TypeScript Code Generation

**⭐ Recommended**: The `generate` command creates TypeScript definitions and type-safe clients for your Quonfig configuration, providing autocomplete and type safety in your IDE.

### Quick Start

```bash
quonfig generate
```

This generates TypeScript files in the `generated/` directory:
- `quonfig-client-types.d.ts` - Type definitions for React/JavaScript
- `quonfig-client.ts` - Type-safe React/JavaScript client

### Generate for Node.js

```bash
quonfig generate --targets node-ts
```

This generates:
- `quonfig-server-types.d.ts` - Type definitions for Node.js
- `quonfig-server.ts` - Type-safe Node.js client

### Generate for Both Platforms

```bash
quonfig generate --targets react-ts,node-ts
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
// For React
import { useTypedQuonfig } from './generated/quonfig-client';

// For Node.js
import { createTypedQuonfig } from './generated/quonfig-server';
```

## Commands

### generate-new-hex-key

`quonfig generate-new-hex-key` generates a cryptographically secure hex key suitable for encrypting config values with the `--secret` flag.

Example:
```bash
quonfig generate-new-hex-key
```

This outputs a 64-character hex key like:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

Use this key when creating or updating configs with encryption:
```bash
# Create an encrypted config using the generated key
quonfig create my.secret --type string --value "sensitive data" --secret --secret-key-name "my-encryption-key"
```

**Use cases:**
- Encrypting sensitive configuration values
- Setting up encryption keys for different environments
- Generating keys for config value protection

### generate

`quonfig generate` creates TypeScript definitions and type-safe clients for your Quonfig configuration, providing autocomplete and type safety in your IDE.

Options:
- `--targets <targets>` - Specify target platforms (react-ts, node-ts)
- `--output-directory <dir>` - Custom output directory
- `--profile <name>` - Use specific profile

Examples:
```bash
# Generate for React/JavaScript (default)
quonfig generate

# Generate for Node.js
quonfig generate --targets node-ts

# Generate for both platforms
quonfig generate --targets react-ts,node-ts

# Custom output directory
quonfig generate --output-directory src/generated
```

This generates:
- Type definitions (`.d.ts` files) with full TypeScript support
- Type-safe client classes with camelCase method names
- IntelliSense autocomplete for all configs and feature flags
- Context-aware typing for better developer experience

:::info
💡 **For detailed setup instructions, configuration options, and usage examples**, see the [TypeScript Code Generation](#typescript-code-generation) section above. This includes information about configuration files, generated client usage, and integration with React and Node.js SDKs.
:::

### login

`quonfig login` authenticates you with Quonfig using OAuth. This opens your browser to complete the authentication flow and stores tokens locally for subsequent CLI commands.

Options:
- `--profile <name>` - Profile name to create or update (defaults to "default")
- `--json` - Format output as JSON

Example:
```bash
quonfig login
quonfig login --profile production
```

Profiles allow you to manage multiple Quonfig accounts or environments. Use the `QUONFIG_PROFILE` environment variable or `--profile` flag to specify which profile to use.

### logout

`quonfig logout` clears all stored authentication tokens from your local machine. After logging out, you'll need to run `quonfig login` again to authenticate.

Example:
```bash
quonfig logout
```

This affects all profiles and is useful for security, troubleshooting authentication issues, or switching accounts.

### list

`quonfig list` shows keys for your configurations, feature flags, log levels, schemas, and segments. By default, all types are shown, but you can filter to specific types.

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
quonfig list
quonfig list --feature-flags
quonfig list --configs --feature-flags
quonfig list --json
```

When you specify one or more type flags, only those types are included in the output.

### info

`quonfig info NAME` shows detailed information about a specific config, feature flag, or other resource, including current values across environments and recent evaluation statistics.

Example:
```bash
quonfig info my.config.name
```

This displays:
- Current values per environment
- Links to the web console
- Usage statistics over the last 24 hours
- Evaluation breakdowns by value

### interactive

`quonfig interactive` (or just `quonfig`) launches an interactive CLI mode where you can browse and manage your resources through a menu-driven interface.

Example:
```bash
quonfig
quonfig interactive
```

This provides an easier way to explore your configs and flags without remembering specific command syntax.

### override

`quonfig override NAME` allows you to override the value of a config or feature flag for your specific user/SDK key combination. This is especially helpful for testing different values without affecting other users.

Options:
- `--value <value>` - Value to use for your override
- `--environment <env>` - Environment to override in
- `--remove` - Remove your existing override
- `--profile <name>` - Use specific profile

Examples:
```bash
quonfig override my.flag.name --value=true
quonfig override my.config.name --value=42 --environment=staging
quonfig override my.flag.name --remove
```

Overrides apply to any environment using an SDK key created by your Quonfig user.

### profile

`quonfig profile` manages authentication profiles and allows you to set the default profile for CLI operations.

Example:
```bash
quonfig profile
```

This command helps you switch between different Quonfig accounts or workspace configurations.

### schema

`quonfig schema NAME` manages Zod schema definitions for your configs, providing type safety and validation.

Options:
- `--get` - Get the current schema definition
- `--set-zod <schema>` - Set a new Zod schema definition
- `--profile <name>` - Use specific profile

Examples:
```bash
quonfig schema my-schema --set-zod="z.object({url: z.string()})"
quonfig schema my-schema --get
```

Schemas enable runtime validation and better TypeScript integration when using generated types.

### serve

`quonfig serve DATA-FILE` starts a local server to serve a datafile, enabling offline development and testing with React/JavaScript clients.

Options:
- `--port <number>` - Port to serve on (default: 3099)

Example:
```bash
quonfig serve ./quonfig.test.588.config.json --port=3099
```

This is useful for:
- Local development without network connectivity
- CI/CD pipelines that need consistent config data
- Testing with specific datafile snapshots

Update your client to point to the local server:
```javascript
endpoints: ["http://localhost:3099"]
```

### workspace

`quonfig workspace` allows you to switch between different Quonfig workspaces or display your current active workspace.

Example:
```bash
quonfig workspace
```

This helps when you have access to multiple Quonfig workspaces and need to switch contexts.

### mcp

`quonfig mcp` configures the Quonfig MCP (Model Context Protocol) server for AI assistants like Claude, Cursor, or other compatible editors.

Options:
- `--editor <type>` - Editor to configure (claude-code, codeium)
- `--url <url>` - Internal URL for testing

Examples:
```bash
quonfig mcp
quonfig mcp --editor cursor
```

This enables AI assistants to access your Quonfig configuration data directly for better code assistance.

### set-default

`quonfig set-default NAME` allows you to change the default value for an environment. Any rules defined for that environment will still apply; only the default is changed.

This can be particularly helpful for flipping a flag on or off for everyone.

Example:

```bash
quonfig set-default my.flag.name --value=true --environment=staging
```

### create

`quonfig create NAME` creates a new flag or config in Quonfig. You can use this to create basic values, encrypted secrets, or values provided by ENV vars.

Supported types: `boolean-flag`, `boolean`, `string`, `double`, `int`, `string-list`, `json`, `duration`, `int-range`, `bytes`

Examples:

```bash
# Basic types
quonfig create my.new.string --type string --value="hello world"
quonfig create my.feature --type boolean-flag --value=true
quonfig create my.timeout --type int --value=30
quonfig create my.price --type double --value=19.99

# Complex types
quonfig create my.tags --type string-list --value="tag1,tag2,tag3"
quonfig create my.config --type json --value='{"key": "value"}'
quonfig create my.duration --type duration --value="30s"
quonfig create my.range --type int-range --value="1-100"
quonfig create my.size --type bytes --value="1GB"

# Encrypted values (requires string type)
quonfig create my.secret --type string --value="sensitive data" --secret

# Environment variable sourced
quonfig create my.db.url --type string --env-var=DATABASE_URL

# Confidential (non-encrypted) values
quonfig create my.api.key --type string --value="key123" --confidential
```

**Encryption vs Confidential:**
- `--secret`: Encrypts the value, requires decryption key
- `--confidential`: Marks value as sensitive but doesn't encrypt (useful for display purposes)
- `--secret` implies `--confidential`, so you don't need both

### download

`quonfig download` downloads a datafile for a given environment. [Datafiles](/docs/explanations/concepts/testing) are helpful for offline testing, CI/CD pipelines, and running your own JS/React endpoint with the [`serve`](#serve) command.

Options:
- `--environment <env>` - Environment to download (required)
- `--json` - Output JSON format

Examples:

```bash
# Basic download
quonfig download --environment=test

# Download for different environments
quonfig download --environment=production
quonfig download --environment=staging
```

**CI/CD Integration:**
```bash
# In your CI pipeline, download configs for testing
quonfig download --environment=test

# Use with serve for integration tests
quonfig serve quonfig.test.588.config.json --port=3099 &
PID=$!
npm run test:integration
kill $PID
```

**Offline Development Setup:**
```bash
# Download configs for offline work
quonfig download --environment=development

# Start local server for offline development
quonfig serve quonfig.development.589.config.json
```

The downloaded file can be used with the `serve` command or for snapshot testing in your application.

### get

`quonfig get NAME` will give you the value for a config in the environment tied to your SDK key.

Example: 

```bash
quonfig get aws.bucket
```

#### Interpolating a value from Quonfig

Since the CLI is a well-behaved citizen of the command line, you can use it to compose other commands.

Here's an example command to download a file from s3 using the [aws cli](https://aws.amazon.com/cli/). Quonfig values are interpolated for the aws key and bucket name.

```bash
aws s3api get-object \
  --bucket $(quonfig get aws.bucket) \
  --key $(quonfig get aws.db.backup.filename) \
  db.tgz
```

As you'd expect, you can similarly use `quonfig` in a pipeline with `xargs` and similar.

### info

`quonfig info NAME` will show details about an item in Quonfig. Example output:

```
quonfig info aws.bucket

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

`quonfig list` will show the names of items in your Quonfig account. You can pass flags to filter this to only show items of a specific type (e.g. segments).

### override

`quonfig override` lets you override the value for a config or feature flag for your quonfig.com user. This is especially helpful for testing both sides of a feature flag.

Are you using a backend key for your server code and a frontend key for your UI? No problem; this override will apply to any environment using an SDK key created by your quonfig.com user.

Example:

```bash
quonfig override my.flag.name --value=true
```

### serve

`quonfig serve` will start a local server to serve up a local datafile that React and JS clients can talk to. See `quonfig download` for more.

```bash
quonfig serve quonfig.test.588.config.json
# Server is listening on 3099. Press ctrl-c to stop.
```

Example Dockerfile

```dockerfile
FROM node:20
WORKDIR /app
RUN npm i -g @quonfig-com/cli
COPY quonfig.Production.589.config.json /app
ENV QUONFIG_LOCAL_ONLY=true
EXPOSE 9898
CMD quonfig serve quonfig.Production.589.config.json --port=9898
```

## Troubleshooting

### Common Issues

**Authentication Problems:**
```bash
# Clear authentication and re-login
quonfig logout
quonfig login

# Use specific profile
quonfig login --profile production
```

**Configuration Generation Issues:**
```bash
# Generate with verbose output to see detailed logs
quonfig generate --verbose

# Check if config file exists and is valid JSON
cat quonfig.config.json | jq .
```

**MCP Configuration Issues:**
```bash
# Verify editor configuration was created
# For VS Code/Cursor:
cat ~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json

# For Claude Desktop:
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Network/API Issues:**
```bash
# Test connectivity with verbose output
quonfig list --verbose

# Check API endpoint override
echo $QUONFIG_API_URL_OVERRIDE
```

### Environment Variables

- `QUONFIG_API_URL_OVERRIDE` - Override the default API URL
- `QUONFIG_PROFILE` - Set default profile to use
- `NO_COLOR` - Disable colored output
- `QUONFIG_LOCAL_ONLY` - Use only local datafiles (for serve command)
