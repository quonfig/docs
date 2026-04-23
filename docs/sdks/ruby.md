---
title: Ruby
---

## Install the latest version
[Github](https://github.com/QuonfigHQ/sdk-ruby) | [Ruby Gems](https://rubygems.org/gems/sdk-quonfig)


```ruby
Quonfig.init

context = {
  user: {
    key: 123,
    email: "alice@example.com"
  }
  team: {
    key: 456,
    name: "AliceCorp"
  }
}

result = Quonfig.enabled? "my-first-feature-flag", context

puts "my-first-feature-flag is: #{result}"
```

## Initialize Client

If you set `QUONFIG_BACKEND_SDK_KEY` as an environment variable, initializing the client is as easy as

```ruby
Quonfig.init # reads QUONFIG_BACKEND_SDK_KEY env var by default
```

### API URLs

By default the SDK connects to `https://primary.quonfig.com` for config fetches
and automatically connects to `https://stream.primary.quonfig.com` for live SSE
updates. The stream URL is derived from each API URL by prepending `stream.` to
the hostname, so you don't configure it separately. A fallback
`secondary.quonfig.com` will be added to the default list once the fallback app
exists. Override the list with the `api_urls` option (or the
`QUONFIG_API_URLS` env var — comma-separated):

```ruby
Quonfig.init(
  Quonfig::Options.new(
    api_urls: ["https://primary.quonfig.com"],
  )
)
```

### Rails Applications

Initializing Quonfig in your `application.rb` will allow you to reference dynamic configuration in your environment (e.g. `staging.rb`) and initializers. This is useful for setting environment-specific config like your redis connection URL.

```ruby
#application.rb
module MyApplication
  class Application < Rails::Application
    #...

    Quonfig.init
  end
end
```

<details className="alert--warning">
<summary>

#### Special Considerations with Forking servers like Puma & Unicorn that use workers

</summary>

Many ruby web servers fork. In order to work properly we should have a Quonfig Client running independently in each fork. You do not need to do this if you are only using threads and not workers.
If using SemanticLogger, you will also need to reopen the logger in each fork.

<Tabs groupId="lang">
<TabItem value="puma" label="Puma">

If using workers in Puma, you can initialize inside an on_worker_boot hook in your puma.rb config file.

```ruby
# puma.rb
on_worker_boot do
  Quonfig.fork
  SemanticLogger.reopen # if you are using SemanticLogger
end
```

</TabItem>

<TabItem value="unicorn" label="Unicorn">

If using workers in Unicorn, you can initialize inside an after_fork hook in your unicorn.rb config file:

```ruby
# unicorn.rb
after_fork do |server, worker|
  Quonfig.fork
  SemanticLogger.reopen # if you are using SemanticLogger
end
```

</TabItem>
</Tabs>

</details>

## Feature Flags

For boolean flags, you can use the `enabled?` convenience method:

```ruby
if Quonfig.enabled?("my-first-feature-flag")
  # ...
else
  # ...
end
```

<details className="alert--info">
<summary>
Feature flags don't have to return just true or false.
</summary>

You can get other data types using `get`:

```ruby
Quonfig.get("ff-with-string")
Quonfig.get("ff-with-int")
```

</details>

## Context

Feature flags become more powerful when we give the flag evaluation rules more information to work with. We do this by providing [context](/docs/explanations/concepts/context) of the current user (and/or team, request, etc.)

### Global Context

When initializing the client, you can set a global context that will be used for all evaluations.

```ruby
Quonfig.init(
  global_context: {
    application: {key: "my.corp.web"},
    cpu: {count: 4},
    clock: {timezone: "UTC"}
  }
)
```

Global context is the least specific context and will be overridden by more specific context passed in at the time of evaluation.

### Thread-local (Request-scoped)

To make the best use of Quonfig, we recommend setting [context](/docs/explanations/concepts/context) in an `around_action` in your `ApplicationController`. Setting this context for the life-cycle of the request means the Quonfig logger can be aware of your user/etc and you won't have to explicitly pass context into your `.enabled?` and `.get` calls.

```ruby
# application_controller.rb
class ApplicationController < ActionController::Base
  around_action do |_, block|
    Quonfig.with_context(quonfig_context, &block)
  end

  def quonfig_context
    {
      device: {
        mobile: mobile?
        # ...
      },
    }.merge(quonfig_user_context)
  end

  def quonfig_user_context
    return {} unless current_user

    {
      key: current_user.tracking_id,
      id: current_user.id,
      email: current_user.email,
      country: current_user.country,
      # ...
    }
  end
end
```

<details>
<summary>
Just-in-time Context
</summary>

You can also pass context when evaluating individual flags or config values.

```ruby
context = {
  user: {
    id: 123,
    key: 'user-123',
    subscription_level: 'pro',
    email: "alice@example.com"
  },
  team: {
    id: 432,
    key: 'team-abc',
  },
  device: {
    key: "abcdef",
    mobile: true,
  }
}
result = Quonfig.enabled?("my-first-feature-flag", context)

puts "my-first-feature-flag is: #{result} for #{context.inspect}"
```

</details>

## Dynamic Config

Config values are accessed the same way as feature flag values. You can use `enabled?` as a convenience for boolean values, and `get` works for all data types

```ruby
config_key = "my-first-int-config"
puts "#{config_key} is: #{Quonfig.get(config_key)}"
```

<details>
<summary>

#### Default Values for Configs

</summary>

Here we ask for the value of a config named `max-jobs-per-second`, and we specify `10` as a default value if no value is available.

```ruby
Quonfig.get("max-jobs-per-second", 10) # => returns `10` if no value is available
```

If we don't provide a default and no value is available, a `Quonfig::Errors::MissingDefaultError` error will be raised.

```ruby
Quonfig.get("max-jobs-per-second") # => raises if no value is available
```

:::note

You can modify this behavior by setting the option `on_no_default` to `Quonfig::Options::ON_NO_DEFAULT::RETURN_NIL`

:::

</details>

## Dynamic Log Levels

Log levels in Quonfig are stored as a `log_level` config (e.g. `log-level.my-app`). The SDK consults that config on every log call, so changes made in Quonfig take effect live via SSE without redeploying.

### Concept

- One `log_level` config per app, keyed like `log-level.my-app`. Value is one of `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`.
- Tell the client which config to consult via `Quonfig::Options.new(logger_key: ...)`.
- `should_log?(logger_path:, desired_level:)` pushes `logger_path` into the evaluation context as `quonfig-sdk-logging.key` (verbatim — no normalization) so a single config can drive per-class rules.
- Logger names flowing through `quonfig-sdk-logging.key` are auto-captured by example-context telemetry, so the dashboard can auto-suggest rule targets.

### Basic usage

```ruby
require "quonfig"

options = Quonfig::Options.new(
  sdk_key: ENV.fetch("QUONFIG_BACKEND_SDK_KEY"),
  logger_key: "log-level.my-app",
)
Quonfig.init(options)

if Quonfig.instance.should_log?(
  logger_path: "MyApp::Services::Auth",
  desired_level: :debug,
)
  # ...
end
```

### Rule example

Create a `log_level` config with key `log-level.my-app` and target individual loggers via `quonfig-sdk-logging.key`:

```yaml
# Default to INFO for every logger in this app
default: INFO

rules:
  # Bump one namespace to DEBUG
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "MyApp::Services::Auth"
    value: DEBUG

  # Silence a chatty gem
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "SomeGem"
    value: ERROR

  # Turn DEBUG on for one developer, everywhere
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG
```

Because the evaluator sees your full context — global context, per-request thread-local context, and `quonfig-sdk-logging.key` — you can combine logger rules with user, environment, or request context for targeted debugging.

### SemanticLogger integration

[SemanticLogger](https://github.com/reidmorrison/semantic_logger) is a popular structured logging framework. Attach a filter built by `semantic_logger_filter(config_key:)` and SemanticLogger will gate each record through Quonfig:

<Tabs groupId="ruby-usage">
<TabItem value="ruby" label="Ruby">

```ruby
# Gemfile
gem "semantic_logger"
```

```ruby
require "semantic_logger"
require "quonfig"

Quonfig.init(Quonfig::Options.new(logger_key: "log-level.my-app"))

SemanticLogger.sync!
SemanticLogger.default_level = :trace # let Quonfig do the filtering
SemanticLogger.add_appender(
  io: $stdout,
  formatter: :json,
  filter: Quonfig.instance.semantic_logger_filter(config_key: "log-level.my-app"),
)
```

</TabItem>

<TabItem value="rails" label="Rails">

```ruby
# Gemfile
gem "amazing_print"
gem "rails_semantic_logger"
```

```ruby
# config/application.rb
Quonfig.init(Quonfig::Options.new(logger_key: "log-level.my-app"))
```

```ruby
# config/initializers/logging.rb
SemanticLogger.sync!
SemanticLogger.default_level = :trace # let Quonfig do the filtering
SemanticLogger.add_appender(
  io: $stdout,
  formatter: Rails.env.development? ? :color : :json,
  filter: Quonfig.instance.semantic_logger_filter(config_key: "log-level.my-app"),
)
```

:::caution
Please read the [Puma/Unicorn](ruby#special-considerations-with-forking-servers-like-puma--unicorn-that-use-workers) notes for special considerations with forking servers.
:::

</TabItem>
</Tabs>

The filter uses the SemanticLogger log's `name` as the `quonfig-sdk-logging.key` context value, so the rule examples above (`starts-with: "MyApp::Services::Auth"`) work out of the box.

### Stdlib Logger integration

If you use Ruby's standard library `Logger`, attach a `Quonfig::Client#stdlib_formatter`:

```ruby
require "logger"
require "quonfig"

Quonfig.init(Quonfig::Options.new(logger_key: "log-level.my-app"))

logger = Logger.new($stdout)
logger.level = Logger::DEBUG # let Quonfig do the filtering
logger.formatter = Quonfig.instance.stdlib_formatter(logger_name: "MyApp::Services::Auth")

logger.debug "filtered by Quonfig"
logger.info  "filtered by Quonfig"
```

The formatter asks Quonfig `should_log?(logger_path:, desired_level:)` before each line. `logger_name:` is passed verbatim as `quonfig-sdk-logging.key`. If you omit `logger_name:` the formatter falls back to the logger's `progname`.

## Telemetry

By default, Quonfig uploads telemetry that enables a number of useful features. You can alter or disable this behavior using the following options:

| Name                         | Description                                                                                                                           | Default           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| collect_evaluation_summaries | Send counts of config/flag evaluation results back to Quonfig to view in web app                                                       | true              |
| context_upload_mode          | Upload either context "shapes" (the names and data types your app uses in Quonfig contexts) or periodically send full example contexts | :periodic_example |

Logger names flowing through `quonfig-sdk-logging.key` are picked up by the normal example-context telemetry, so no separate logger-counts toggle is needed — the dashboard sees candidate logger names via the same path.

If you want to change any of these options, you can pass an `options` object when initializing the Quonfig client.

```ruby
#application.rb
module MyApplication
  class Application < Rails::Application
    #...

    // highlight-start
    options = Quonfig::Options.new(
      collect_evaluation_summaries: true,
      context_upload_mode: :periodic_example,
    )

    Quonfig.init(options)
    // highlight-end
  end
end
```

## Debugging

In the rare
case that you are trying to debug issues that occur within the library, set env var

```bash
QUONFIG_LOG_CLIENT_BOOTSTRAP_LOG_LEVEL = debug
```

## Asset Precompilation in Rails

Developers trying to run `rake assets:precompile` or `rails assets:precompile` in CI/CD know the pain of missing environment variables. Quonfig can help with this, but you don't want to hardcode your Quonfig SDK key in your Dockerfile. What should you do instead?

We recommend using a [datafile](/docs/explanations/concepts/testing#testing-with-datafiles) for `assets:precompile`. You can generate a datafile for your environment using the Quonfig CLI:

```bash
quonfig download --environment test
```

This will generate a JSON file (e.g., `quonfig.test.108.config.json`) based on your Quonfig project’s test environment. You can check into your repo for use in CI/CD and automated testing.

Now you can use the datafile for `assets:precompile`:

```bash
QUONFIG_DATAFILE=quonfig.test.108.config.json bundle exec rake assets:precompile
```

Of course, you can generate a datafile for any environment you like and use it in the same way.

## Bootstrap & Stub Client-side JavaScript flags and configs

If you're using JavaScript on the client side, you can use the Quonfig Ruby client to bootstrap your client-side flags and configs. This helps you avoid loading states while you wait on an HTTP request to Quonfig's evaluation endpoint. You can skip the HTTP request altogether.

### With the Frontend SDKs

If you want the power of the [JavaScript SDK](/docs/sdks/javascript) or [React SDK](/docs/sdks/react), you can use the Ruby client to bootstrap the page with the evaluated flags and configs for the current user context. Just put this in the DOM (perhaps in your application layout) before you load your Quonfig frontend SDK.

```erb
<%== Quonfig.bootstrap_javascript(context) %>
```

Things work as they normally would with the frontend SDKs, you'll just skip the HTTP request.

### Without the Frontend SDKs

If you don't want to use the frontend SDKs, you can get a global `window.quonfig` object to call `get` and `isEnabled` on the client side.

```erb
<%= Quonfig.generate_javascript_stub(context, callback = nil) %>
```

This will give you feature flags and config values for your current context. You can provide an optional callback to record experiment exposures or other metrics. No HTTP request or SDK needed!

## Testing

### Test Setup

You can use a datafile for consistency, reproducibility, and offline testing. See [Testing with DataFiles](/docs/explanations/concepts/testing#testing-with-datafiles).

If you need to test multiple scenarios that depend on a single config or feature key, you can change the Quonfig value using a mock or stub.

### Example Test

Imagine we want to test a `batches` method on our `Job` class. `batches` depends on `job.batch.size` and the value for `job.batch.size` in our default config file is `3`.

We can test how `batches` performs with different values for `job.batch.size` by mocking the return value of `Quonfig.get`.

```ruby
class Job < Array
  def batches
    slice_size = Quonfig.get('job.batch.size')
    each_slice(slice_size)
  end
end

RSpec.describe Job do
  describe '#batches' do
    it 'returns batches of jobs' do
      jobs = Job.new([1, 2, 3, 4, 5])

      expect(jobs.batches.map(&:size)).to eq([3, 2])

      allow(Quonfig).to receive(:get).with('job.batch.size').and_return(2)
      expect(jobs.batches.map(&:size)).to eq([2, 2, 1])
    end
  end
end
```

## Reference

### Client Initialization Options

For more control, you can initialize your client with options. Here are the defaults with explanations.

```ruby
options = Quonfig::Options.new(
  sdk_key: ENV['QUONFIG_BACKEND_SDK_KEY'],
  api_urls: ['https://primary.quonfig.com'], # or ENV['QUONFIG_API_URLS'] (comma-separated). SSE URL is derived by prepending 'stream.'
  on_no_default: ON_NO_DEFAULT::RAISE, # options :raise, :warn_and_return_nil,
  initialization_timeout_sec: 10, # how long to wait before on_init_failure
  on_init_failure: ON_INITIALIZATION_FAILURE::RAISE, # choose to crash or continue with local data only if unable to fetch config data from prefab at startup
  datafile: ENV['QUONFIG_DATAFILE'] || ENV['PREFAB_DATAFILE'],
  logger_key: nil, # the `log_level` config key consulted by `should_log?(logger_path:, ...)`, e.g. "log-level.my-app"
  collect_max_paths: DEFAULT_MAX_PATHS,
  collect_sync_interval: nil,
  context_upload_mode: :periodic_example, # :periodic_example, :shape_only, :none
  context_max_size: DEFAULT_MAX_EVAL_SUMMARIES,
  collect_evaluation_summaries: true, # send counts of config/flag evaluation results back to Quonfig to view in web app
  collect_max_evaluation_summaries: DEFAULT_MAX_EVAL_SUMMARIES,
  allow_telemetry_in_local_mode: false,
  global_context: {}
)

Quonfig.init(options)
```

[SemanticLogger]: https://logger.rocketjob.io/
