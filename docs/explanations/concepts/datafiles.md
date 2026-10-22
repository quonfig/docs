---
title: DataFiles
sidebar_label: DataFiles
sidebar_position: 5
---

Quonfig supports offline mode and easy automated testing by using datafiles.

Backend SDKs read a local copy of your workspace: point the SDK's `datadir` option (`WithDataDir` in Go; see your SDK's page for the exact spelling) at a directory pulled with `qfg pull`, and pick the environment to evaluate. The Ruby and Python SDKs also read the directory from `QUONFIG_DIR`. In datadir mode the SDK uses those files for all configuration instead of contacting the server.

Frontend SDKs use a datafile: a JSON representation of all your configuration for an environment. It is human-readable, but we recommend using the Quonfig CLI to generate it rather than editing it by hand.

## Using Datafiles for offline mode

Datafiles can enable Quonfig usage in completely offline or on-premises feature flag and config evaluations. For full details, see the [offline mode][offline] docs.

## Testing with Datafiles

To get started with a datafile:

1. Create an Environment in the Quonfig UI
2. Pull your workspace config files locally using the Quonfig CLI

```bash
qfg pull --dir ./my-config
# clones your workspace config files to ./my-config
```

3. Point your SDK's `datadir` option at `./my-config` and evaluate the `test` environment. With the Ruby or Python SDK you can set `QUONFIG_DIR=./my-config` and `QUONFIG_ENVIRONMENT=test` in your CI environment instead.

## Using Datafiles in Docker Builds

Datafiles can also be helpful in Docker builds or other environments where you want to avoid reaching out to Quonfig. A common pattern is to use this for `assets:precompile` in a Ruby on Rails application. That often looks like this:

```dockerfile
RUN RAILS_ENV=production QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=test bundle exec rake assets:precompile
```

If you don't want the test data there, you could also create another environment called 'docker-build' with any other configuration you want and point `QUONFIG_ENVIRONMENT` at it.

## Keeping The Config Up To Date

Re-run `qfg pull` to get the latest config files. Commit the updated files to keep your CI environment current.

[offline]: ../../how-tos/offline-mode
