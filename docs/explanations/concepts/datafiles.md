---
title: DataFiles
sidebar_label: DataFiles
sidebar_position: 5
---

Quonfig supports offline mode and easy automated testing by using datafiles.

When specifying a datafile via `QUONFIG_DATAFILE` (or the `datafile` option), Quonfig will use the datafile for all configurations instead of contacting the server and will run in `local-only` mode.

The datafile is a JSON representation of all your configuration for an environment. It is human-readable, but we recommend using the Quonfig CLI to generate it rather than editing it by hand.

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

3. Set `QUONFIG_DIR=./my-config` and `QUONFIG_ENVIRONMENT=test` in your CI environment.

## Using Datafiles in Docker Builds

Datafiles can also be helpful in Docker builds or other environments where you want to avoid reaching out to Quonfig. A common pattern is to use this for `assets:precompile` in a Ruby on Rails application. That often looks like this:

`RUN RAILS_ENV=production QUONFIG_DATAFILE=quonfig.test.108.config.json bundle exec rake assets:precompile
`

If you don't want the test data there, you could also create another environment called 'docker-build' with any other configuration you want and point `QUONFIG_ENVIRONMENT` at it.

## Keeping The Config Up To Date

Re-run `qfg pull` to get the latest config files. Commit the updated files to keep your CI environment current.

[offline]: ../../how-tos/offline-mode
