---
title: Java
---

:::warning Not yet available

There is no official Quonfig Java SDK yet. The instructions below describe a planned API and are **not** currently usable — the Maven coordinates, classes, and method names on this page are aspirational and may change before release.

If you need Java support, please let us know so we can prioritize. In the meantime, the [Go](./go.md), [Node](./node/node.md), [Python](./python.md), and [Ruby](./ruby.md) SDKs are production-ready.

:::

## Install the latest version

[Github](https://github.com/QuonfigHQ/sdk-java) | [Maven Repository](https://mvnrepository.com/artifact/com.quonfig/sdk)

```xml
<dependency>
    <groupId>com.quonfig</groupId>
    <artifactId>sdk</artifactId>
    <version>LATEST</version>
</dependency>
```

<details>
<summary>

#### Dependency-Reduced Version

</summary>

There's an optional uber-jar with shaded and relocated guava and failsafe dependencies

```xml
<dependency>
    <groupId>com.quonfig</groupId>
    <artifactId>sdk</artifactId>
    <version>LATEST</version>
    <classifier>uberjar</classifier>
</dependency>
```

</details>

## Initialize the client

### Basic Usage

```java
import com.quonfig.sdk.Options;
import com.quonfig.sdk.Sdk;

final Sdk quonfig = new Sdk(new Options());
```

### Typical Usage

We recommend using the `Sdk` as a singleton in your application. This is the most common way to use the SDK.

```java
import com.quonfig.sdk.Options;
import com.quonfig.sdk.Sdk;

// Micronaut Factory
@Factory
public class QuonfigFactory {

  @Singleton
  public Sdk quonfig() {
    return new Sdk(new Options());
  }

  @Singleton
  public FeatureFlagClient featureFlagClient(Sdk quonfig) {
    return quonfig.featureFlagClient();
  }

  @Singleton
  public ConfigClient configClient(Sdk quonfig) {
    return quonfig.configClient();
  }
}
```

## Feature Flags

For boolean flags, you can use the `featureIsOn` convenience method:

```java
public class MyClass {
  // assumes you have setup a singleton
  @Inject
  private FeatureFlagClient featureFlagClient;

  public String test(String key){
    boolean val = featureFlagClient.featureIsOn(key);
    return "Feature flag value of %s is %s".formatted(key, val);
  }
}
```

Feature flags don't have to return just true or false. You can get other data types using typed methods:

```java
public class MyClass {
  // assumes you have setup a singleton
  @Inject
  private FeatureFlagClient featureFlagClient;

  public String test(String key){
    // highlight-next-line
    String val = featureFlagClient.getString(key, "default value");
    return "Feature flag value of %s is %s".formatted(key, val);
  }
}
```

Available typed methods: `getString()`, `getLong()`, `getDouble()`, `getBoolean()`, `getStringList()`, `getJSON()`, and `getDuration()`.

## Context

To finely-target configuration rule evaluation, we accept contextual information globally, request-scoped (thread-locally) with the ContextStore which will affect all featureflag and config lookups.

### Global Context

Use global context for information that doesn't change - for example, your application's key, availability-zone etc. Set it in the client's options as below

```java
import com.quonfig.sdk.Options;
import com.quonfig.sdk.Sdk;

Context deploymentContext = Context
  .newBuilder("application")
  .put("key", "my-api")
  .put("az", "1a")
  .put("type", "web")
  .build();

Options options = new Options()
  .setGlobalContext(ContextSet.from(deploymentContext));

final Sdk quonfig = new Sdk(options);
```

### Thread-local (Request-scoped)

```java
// set the thread-local context
quonfig.configClient().getContextStore().addContext(
  Context.newBuilder("User")
    .put("name", user.getName())
    .put("key", user.getKey())
    .build());

// or using an autoclosable scope helper
// this will replace any-existing threadlocal context until the try-with-resources block exits
ContextHelper prefabContextHelper = new ContextHelper(
  quonfig.configClient()
);

try (
  ContextHelper.ContextScope ignored = prefabContextHelper.performWorkWithAutoClosingContext(
    Context.newBuilder("User")
      .put("name", user.getName())
      .put("key", user.getKey())
      .build());
) {
  // do config/flag operations
}
```

When thread-local context is set, log levels and feature flags will evaluate in that context. Here are details on setting thread-local context:

<Tabs groupId="lang">
<TabItem value="micronaut" label="Micronaut">

Add a [filter](https://github.com/QuonfigHQ/example-micronaut-app/blob/configure-prefab-context/src/main/java/com/example/prefab/ContextFilter.java) to add a Quonfig context based on the currently "logged in" user.

```java
@Filter(Filter.MATCH_ALL_PATTERN)
public class ContextFilter implements HttpFilter {

    private final ConfigClient configClient;

    @Inject
    ContextFilter(ConfigClient configClient) {
        this.configClient = configClient;
    }

    @Override
    public Publisher<? extends HttpResponse<?>> doFilter(HttpRequest<?> request, FilterChain chain) {

        request.getUserPrincipal(Authentication.class).ifPresent(authentication ->
                {
                    User user = (User) authentication.getAttributes().get(ExampleAuthenticationProvider.USER_ATTR);
                    configClient.getContextStore()
                            .addContext(
                              Context.newBuilder("user")
                                .put("id", user.id())
                                .put("country", user.country())
                                .put("email", user.email())
                                .build()
                            );
                }
        );
        return chain.proceed(request);
    }

    @Override
    public int getOrder() {
        return ServerFilterPhase.SECURITY.after() + 1;
        // run after the DefaultLoginFilter
    }
}
```

Quonfig Context uses ThreadLocals by default. In event-based frameworks like micronaut, that won't work so configure the Quonfig Context store to use `ServerRequestContextStore` instead.

```java
options.setContextStore(new ServerRequestContextStore());
```

Learn more with the [Quonfig + Micronaut example app](https://github.com/QuonfigHQ/example-micronaut-app)

</TabItem>

<TabItem value="dropwizard" label="Dropwizard">

Use a `ContainerRequestFilter` to set the context for your request when the request begins

```java
public class ContextAddingRequestFilter implements ContainerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(ContextAddingRequestFilter.class);
    private final ConfigClient configClient;

    @Inject
    public ContextAddingRequestFilter(ConfigClient configClient) {
        this.configClient = configClient;
    }

    @Override
    public void filter(ContainerRequestContext containerRequestContext) throws IOException {
        final SecurityContext securityContext =
                containerRequestContext.getSecurityContext();
        if (securityContext != null) {
            Principal principal = securityContext.getUserPrincipal();
            if (principal instanceof User) {
                User user = (User) principal;
                LOGGER.info("will add pf context for {}", user);
                configClient.getContextStore().addContext(
                      Context.newBuilder("User")
                        .put("name", user.getName())
                        .build());
            }
        }
    }
}
```

Then we'll add another `ContainerResponseFilter` to clear the context from the ThreadLocal when the request finishes.

```java
public class PrefabContexClearingResponseFilter implements ContainerResponseFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(PrefabContexClearingResponseFilter.class);
    private final ConfigClient configClient;

    @Inject
    PrefabContexClearingResponseFilter(ConfigClient configClient) {
        this.configClient = configClient;
    }

    @Override
    public void filter(ContainerRequestContext containerRequestContext, ContainerResponseContext containerResponseContext) throws IOException {
        configClient.getContextStore().clearContexts();
        LOGGER.info("Cleared context");
    }
}
```

Learn more with the [Quonfig + Dropwizard example app](https://github.com/QuonfigHQ/example-dropwizard-app)

</TabItem>
</Tabs>

<details>
<summary>

### Just-in-time Context

</summary>

You can also provide context information inline when making a get request. If you provide just-in-time context to your FF or config evaluations, it will be merged with the global context.

```java
featureFlagClient.featureIsOn(
    "features.example-flag",
    Context.newBuilder("customer")
      .put("group", "beta")
      .build()
  )

String value = quonfig.configClient().getString(
  "the.key",
  "default-value",
  Context.newBuilder("user")
    .put("name", "james")
    .put("tier", "gold")
    .put("customerMonths", 12)
    .build()
)
```

</details>

See [contexts](/docs/explanations/concepts/context) for more information

## Dynamic Config

Use typed methods to retrieve configuration values:

```java
// Get a string config value with a default
String value = quonfig.configClient().getString("the.key", "default-value");
System.out.println(value);

// Get a long config value with a default
long count = quonfig.configClient().getLong("max.count", 100L);
```

Available typed methods: `getString()`, `getLong()`, `getDouble()`, `getBoolean()`, `getStringList()`, `getJSON()`, and `getDuration()`.

### Live Values

Live values are a convenient and clear way to use configuration throughout your system. Inject a Quonfig client and get live values for the configuration keys you need.

In code, `.get()` will return the value. These values will update automatically when the configuration is updated in Quonfig.

```java
import java.util.function.Supplier;

class MyClass {

  private Supplier<String> sampleString;
  private Supplier<Long> sampleLong;

  @Inject
  public MyClass(ConfigClient configClient) {
    this.sampleString = configClient.liveString("sample.string");
    this.sampleLong = configClient.liveLong("sample.long");
  }

  public String test(){
    return "I got %s and %d from Quonfig.".formatted(sampleString.get(), sampleLong.get());
  }
}
```

## Dynamic Log Levels

The Quonfig SDK provides seamless integration with popular Java logging frameworks, enabling you to dynamically manage log levels across your application in real-time without restarting.

### Features

- **Centrally manage log levels** - Control logging across your entire application from the Quonfig dashboard
- **Real-time updates** - Change log levels without restarting your application
- **Context-aware logging** - Different log levels for different loggers based on runtime context
- **Performance** - Efficient filtering happens before log message construction
- **Framework support** - Works with Logback and Log4j2

### Logback Integration

Add the Logback integration dependency:

```xml
<dependency>
    <groupId>com.quonfig</groupId>
    <artifactId>sdk-logback</artifactId>
    <version>LATEST</version>
</dependency>
```

Install the filter during application startup:

```java
import com.quonfig.sdk.Sdk;
import com.quonfig.sdk.Options;
import com.quonfig.sdk.logback.QuonfigLogbackTurboFilter;

public class MyApplication {
    public static void main(String[] args) {
        // Initialize the Quonfig SDK
        Sdk sdk = new Sdk(new Options());

        // Install the Logback turbo filter
        QuonfigLogbackTurboFilter.install(sdk.loggerClient());

        // Now all your logging will respect Quonfig log levels
    }
}
```

**Compatibility:** Logback 1.2.x, 1.3.x, 1.4.x, and 1.5.x

### Log4j2 Integration

Add the Log4j2 integration dependency:

```xml
<dependency>
    <groupId>com.quonfig</groupId>
    <artifactId>sdk-log4j2</artifactId>
    <version>LATEST</version>
</dependency>
```

Install the filter during application startup:

```java
import com.quonfig.sdk.Sdk;
import com.quonfig.sdk.Options;
import com.quonfig.sdk.log4j2.QuonfigLog4j2Filter;

public class MyApplication {
    public static void main(String[] args) {
        // Initialize the Quonfig SDK
        Sdk sdk = new Sdk(new Options());

        // Install the Log4j2 filter
        QuonfigLog4j2Filter.install(sdk.loggerClient());

        // Now all your logging will respect Quonfig log levels
    }
}
```

**Compatibility:** Log4j2 2.x

### Configuration

Create a `LOG_LEVEL_V2` config in your Quonfig dashboard with key `log-levels.default`:

```yaml
# Default to INFO for all loggers
default: INFO

# Set specific packages to DEBUG
rules:
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "com.example.services"
    value: DEBUG

  # Only log errors in noisy third-party library
  - criteria:
      quonfig-sdk-logging.logger-path:
        starts-with: "com.thirdparty.noisy"
    value: ERROR
```

You can customize the config key name using the `setLoggerKey` option. This is useful if you have multiple applications sharing the same Quonfig project and want to isolate log level configuration per application:

```java
Options options = new Options().setLoggerKey("myapp.log.levels");
Sdk sdk = new Sdk(options);
```

The SDK automatically includes `lang: "java"` in the evaluation context, which you can use in your rules to create Java-specific log level configurations:

```yaml
# Different log levels for Java vs other languages
rules:
  - criteria:
      quonfig-sdk-logging.lang: java
      quonfig-sdk-logging.logger-path:
        starts-with: "com.example"
    value: DEBUG

  - criteria:
      quonfig-sdk-logging.lang: python
      quonfig-sdk-logging.logger-path:
        starts-with: "myapp"
    value: INFO
```

### Targeted Log Levels

You can use [rules and segmentation](/docs/explanations/features/rules-and-segmentation) to change your log levels based on the current user/request/device context. This allows you to increase log verbosity for specific users, environments, or conditions without affecting your entire application.

The log level evaluation has access to **all context** that is available during evaluation, not just the `quonfig-sdk-logging` context. This means you can create rules combining:

- **SDK logging context** (`quonfig-sdk-logging.*`) - Logger name and language
- **Global context** - Application name, environment, availability zone, etc.
- **Thread-local context** - User, team, device, request information from request-scoped context

For example, you can create rules like:

```yaml
# Enable DEBUG logs only for specific application in staging
rules:
  - criteria:
      application.key: "myapp"
      application.environment: "staging"
      quonfig-sdk-logging.logger-path:
        starts-with: "com.example"
    value: DEBUG

  # Enable DEBUG logs for a specific user across all applications
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG

  # Lower verbosity in production
  - criteria:
      application.environment: "production"
    value: WARN
```

This allows you to increase log verbosity for specific users, specific applications, particular environments, or any combination of conditions without affecting your entire system.

### How It Works

Once installed, the integration automatically intercepts **all** logging calls across your entire application:

- Works with **all loggers** (no need to configure individual loggers)
- Works with **all appenders** (console, file, syslog, etc.)
- Filters happen **before** log messages are formatted (performance benefit)
- No modification of your existing logging configuration needed

For more details, see:
- [Logback Integration README](https://github.com/QuonfigHQ/sdk-java/blob/main/logback/README.md)
- [Log4j2 Integration README](https://github.com/QuonfigHQ/sdk-java/blob/main/log4j2/README.md)

## Telemetry

By default, Quonfig uploads telemetry that enables a number of useful features. You can alter or disable this behavior using the following options:

| Name                       | Description                                                                                                                           | Default          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| collectEvaluationSummaries | Send counts of config/flag evaluation results back to Quonfig to view in web app                                                       | true             |
| collectLoggerCounts        | Send counts of logger usage back to Quonfig to power log-levels configuration screen                                                   | true             |
| contextUploadMode          | Upload either context "shapes" (the names and data types your app uses in Quonfig contexts) or periodically send full example contexts | PERIODIC_EXAMPLE |

If you want to change any of these options, you can pass an `options` object when initializing the Quonfig client.

```java
Options options = new Options()
  .setCollectEvaluationSummaries(true)
  .setCollectLoggerCounts(true)
  .setContextUploadMode(Options.CollectContextMode.PERIODIC_EXAMPLE);
```

## Testing

Quonfig suggests testing with generous usage of Mockito. We also provide a useful `FixedValue` for testing Live Values.

```java
@Test
void testQuonfig(){
  ConfigClient mockConfigClient = mock(ConfigClient.class);
  when(mockConfigClient.liveString("sample.string")).thenReturn(FixedValue.of("test value"));
  when(mockConfigClient.liveLong("sample.long")).thenReturn(FixedValue.of(123L));

  MyClass myClass = new MyClass(mockConfigClient);

  // test business logic

}
```

## Reference

### Options

```java
Options options = new Options()
  .setConfigOverrideDir(System.getProperty("user.home"))
  .setSdkKey(System.getenv("QUONFIG_BACKEND_SDK_KEY"))
  .setPrefabDatasource(Options.Datasources.ALL) // Option: Datasources.LOCAL_ONLY
  .setOnInitializationFailure(Options.OnInitializationFailure.RAISE) // Option Options.OnInitializationFailure.UNLOCK
  .setInitializationTimeoutSec(10)
  .setGlobalContext(ContextSet.from(Context
      .newBuilder("application")
      .put("key", "my-api")
      .put("az", "1a")
      .put("type", "web")
      .build())
   );
```

#### Option Definitions

| Name                       | Description                                                                                                                           | Default          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| collectEvaluationSummaries | Send counts of config/flag evaluation results back to Quonfig to view in web app                                                       | true             |
| collectLoggerCounts        | Send counts of logger usage back to Quonfig to power log-levels configuration screen                                                   | true             |
| contextUploadMode          | Upload either context "shapes" (the names and data types your app uses in Quonfig contexts) or periodically send full example contexts | PERIODIC_EXAMPLE |
| onInitializationFailure    | Choose to crash or continue with local data only if unable to fetch config data from Quonfig at startup                                | RAISE (crash)    |
| prefabDatasources          | Use either only-local data or local + API data                                                                                        | ALL              |
| globalContext              | set a static context to be used as the base layer in all configuration evaluation                                                     | EMPTY            |
