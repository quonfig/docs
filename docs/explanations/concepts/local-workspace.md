---
title: Local Workspace (datadir)
sidebar_label: Local Workspace (datadir)
sidebar_position: 5
---

Your Quonfig workspace is a git repo of JSON files: one file per flag, config, segment and log level. Any Quonfig SDK can read a local copy of that repo instead of connecting to Quonfig. That local copy is called a **datadir**.

A datadir is the complete workspace, not a snapshot of one environment. When you point an SDK at it you also choose which environment to evaluate, so the same checkout serves your `test`, `development` and `production` rules.

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

`./my-config` is a regular git checkout. Re-run `qfg pull` to update it. You can commit it into your app's repo (or your Docker build context) so CI uses exactly the configuration you checked in.

## Point an SDK at it

**Backend SDKs** read the datadir straight from disk. Set the SDK's `datadir` option (`WithDataDir` in Go; see your SDK's page for the exact spelling) and choose an environment. The Ruby and Python SDKs can also read both from environment variables:

```bash
QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=test bundle exec rspec
```

In datadir mode the SDK loads everything from the local files. It doesn't contact the Quonfig servers or open a streaming connection. [Open Source / Fully Local][local] has the setup for each SDK, including auto-reload when files change.

**Frontend SDKs** (browser, React, React Native) have no filesystem. Run [`qfg serve`][serve] to serve the datadir over HTTP, then point the SDK's `apiUrls` at it.

## Testing with a datadir

1. Create a `test` environment in the Quonfig UI and set the values your tests expect.
2. Pull the workspace: `qfg pull --dir ./my-config`.
3. Point your test setup at `./my-config` and evaluate the `test` environment.

Mock or stub individual values when a test needs a specific scenario. See [Testing][testing].

## Docker builds and asset precompilation

A datadir lets build steps evaluate config without an SDK key. A common case is `assets:precompile` in Rails:

```dockerfile
RUN RAILS_ENV=production QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=test bundle exec rake assets:precompile
```

If you don't want test values in the build, create a separate environment (for example `docker-build`) and set `QUONFIG_ENVIRONMENT` to that.

[offline]: ../../how-tos/offline-mode
[local]: ../../how-tos/open-source-local
[serve]: ../../how-tos/qfg-serve
[testing]: ./testing
