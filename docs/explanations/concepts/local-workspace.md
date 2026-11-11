---
title: Local Workspace (datadir)
sidebar_label: Local Workspace (datadir)
sidebar_position: 5
---

Your Quonfig workspace is a git repo of JSON files: one file per flag, config, segment and log level. Any Quonfig SDK can read a local copy of that repo instead of connecting to Quonfig. That local copy is called a **datadir**.

A datadir is the complete workspace, not a snapshot of one environment. When you point an SDK at it you also choose which environment to evaluate, so the same checkout serves your `development`, `staging` and `production` rules.

Use a datadir when you want:

- **Offline development**: work without a network connection. See [Offline Mode][offline].
- **Reproducible tests and CI**: run against a known, committed configuration instead of whatever is live today.
- **Builds that shouldn't call Quonfig**: Docker builds, `assets:precompile`, and other steps where you don't want an SDK key in the build.

## Get a local copy

Pull your workspace with the Quonfig CLI:

```bash
qfg pull --dir ./my-config
# clones your workspace config files to ./my-config
```

`./my-config` is a regular git checkout with its own `.git` directory. Re-run `qfg pull` to update it.

To give CI or a Docker build exactly the configuration you checked, either run `qfg pull` as a build step, or copy the files into your app's repo without the `.git` directory:

```bash
rsync -a --exclude .git ./my-config/ ./vendored-config/
```

Don't `git add` the checkout itself from your app's repo: git records a nested repository as a pointer (a gitlink), not as its files, so CI would check out an empty directory.

## Point an SDK at it

**Backend SDKs** read the datadir straight from disk. Set the SDK's `datadir` option (`WithDataDir` in Go; see your SDK's page for the exact spelling) and choose an environment. The Ruby and Python SDKs can also read both from environment variables:

```bash
QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=development bundle exec rspec
```

When the workspace's `quonfig.json` lists environments (a workspace created in the app starts with `development`, `staging` and `production`), the environment you choose must be one of them, spelled exactly the same: names are case-sensitive, and the SDK fails to start if the name isn't in the list.

In datadir mode the SDK loads config from the local files. It doesn't fetch config from Quonfig or open a streaming connection. If you also set an SDK key, the SDK still sends usage telemetry to Quonfig; without a key it makes no network calls. [Open Source / Fully Local][local] has the setup for each SDK, including auto-reload when files change.

**Frontend SDKs** (browser, React, React Native) have no filesystem. Run [`qfg serve`][serve] to serve the datadir over HTTP, then point the SDK's `apiUrls` at it.

## Testing with a datadir

1. Pick the environment your tests evaluate. A workspace created in the app already has `development`; if you want test-only values, create a dedicated environment (for example `test`) in Quonfig first and set the values your tests expect.
2. Pull the workspace: `qfg pull --dir ./my-config`.
3. Point your test setup at `./my-config` and evaluate that environment, for example `QUONFIG_ENVIRONMENT=development`.

Mock or stub individual values when a test needs a specific scenario. See [Testing][testing].

## Docker builds and asset precompilation

A datadir lets build steps evaluate config without an SDK key. A common case is `assets:precompile` in Rails:

```dockerfile
RUN RAILS_ENV=production QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=production bundle exec rake assets:precompile
```

`QUONFIG_ENVIRONMENT` must name an environment the workspace defines. If you want build-specific values, create a separate environment (for example `docker-build`) and set `QUONFIG_ENVIRONMENT` to that.

[offline]: ../../how-tos/offline-mode
[local]: ../../how-tos/open-source-local
[serve]: ../../how-tos/qfg-serve
[testing]: ./testing
