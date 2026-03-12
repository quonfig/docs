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
2. Generate a datafile for that environment using the Quonfig CLI

```bash
quonfig download --environment test
# writes Quonfig.test.108.config.json
```

3. Add the datafile to git `git add quonfig.test.108.config.json`.
4. Set `QUONFIG_DATAFILE=quonfig.test.108.config.json` in your CI environment.

## Using Datafiles in Docker Builds

Datafiles can also be helpful in Docker builds or other environments where you want to avoid reaching out to Quonfig. A common pattern is to use this for `assets:precompile` in a Ruby on Rails application. That often looks like this:

`RUN RAILS_ENV=production QUONFIG_DATAFILE=quonfig.test.108.config.json bundle exec rake assets:precompile
`

If you don't want the test data there, you could also create another environment called 'docker-build' with any other configuration you want and use the CLI to download that as well.

## Keeping The Datafile Up To Date

The CLI download will take a snapshot of the configuration at a given moment, but it won't keep it current. As you add configuration or feature flags that you need to test, you'll need to update the datafile by re-running the CLI command and committing the new datafile.

[offline]: ../../how-tos/offline-mode
