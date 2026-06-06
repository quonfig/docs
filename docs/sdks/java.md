---
title: Java
---

## Install the latest version

[GitHub](https://github.com/quonfig/sdk-java) | [Maven Central](https://central.sonatype.com/artifact/com.quonfig/sdk-java)

Replace `1.0.0` with the [latest version on Maven Central](https://central.sonatype.com/artifact/com.quonfig/sdk-java).

<Tabs groupId="java-build">
<TabItem value="gradle-kotlin" label="Gradle (Kotlin DSL)">

```kotlin
dependencies {
    implementation("com.quonfig:sdk-java:1.0.0")
}
```

</TabItem>

<TabItem value="gradle-groovy" label="Gradle (Groovy DSL)">

```groovy
dependencies {
    implementation 'com.quonfig:sdk-java:1.0.0'
}
```

</TabItem>

<TabItem value="maven" label="Maven">

```xml
<dependency>
    <groupId>com.quonfig</groupId>
    <artifactId>sdk-java</artifactId>
    <version>1.0.0</version>
</dependency>
```

</TabItem>
</Tabs>

**Requirements:** Java 17 or later.

## Initialize the client

The Java SDK exposes a single client class, `com.quonfig.sdk.Quonfig`, configured with an immutable `Options` value built via `Options.builder()`.

If you set `QUONFIG_BACKEND_SDK_KEY` in your environment, initialization is a one-liner:

```java
import com.quonfig.sdk.Options;
import com.quonfig.sdk.Quonfig;

Quonfig quonfig = new Quonfig(Options.builder().build());
```

Or pass the SDK key explicitly:

```java
Quonfig quonfig = new Quonfig(
    Options.builder()
        .sdkKey(System.getenv("QUONFIG_BACKEND_SDK_KEY"))
        .build()
);
```

`Quonfig` implements `AutoCloseable`. We recommend using it as a singleton in your application and calling `quonfig.close()` on shutdown to stop the SSE stream and flush telemetry.

### Initialization is asynchronous

The constructor returns immediately and runs the initial config fetch on a background thread. The first call to any typed getter (`getString`, `getBoolean`, etc.) blocks on initialization, with a timeout controlled by `initTimeout` (default `10s`).

If initialization fails or times out, getters return the caller's default value with `Reason.ERROR` — they do not throw. Use `quonfig.initFuture().get()` if you need to block explicitly during startup.

```java
Quonfig quonfig = new Quonfig(Options.builder().sdkKey("sdk-...").build());

// Optional: block until the initial fetch completes
quonfig.initFuture().get();
```

### Datadir mode (local development)

To run the SDK against a local checkout of a Quonfig workspace directory (the `configs/`, `feature-flags/`, `segments/`, `log-levels/` tree), use `datadir`. **`environment` is required in datadir mode** — set it via the builder or the `QUONFIG_ENVIRONMENT` env var.

```java
Quonfig quonfig = new Quonfig(
    Options.builder()
        .datadir("/path/to/your-workspace")
        .environment("development")
        .build()
);
```

In datadir mode the SDK loads everything synchronously from disk; there is no background fetch and no SSE connection. Telemetry is still uploaded if an `sdkKey` is also set.

### Domain and API URL configuration

By default the SDK derives every service URL from a single domain (`quonfig.com`):

- API: `https://primary.quonfig.com`, `https://secondary.quonfig.com`
- SSE stream: `https://stream.primary.quonfig.com`, `https://stream.secondary.quonfig.com`
- Telemetry: `https://telemetry.quonfig.com`

Override the whole bundle by changing the domain (handy for self-hosted deployments and local proxies):

```java
Quonfig quonfig = new Quonfig(
    Options.builder()
        .sdkKey("sdk-...")
        .domain("quonfig.example.com")
        .build()
);
```

Or set `QUONFIG_DOMAIN` in the environment. For local development with the bundled Caddy reverse proxy (`scripts/local-proxy/setup.sh` in the monorepo), set `QUONFIG_DOMAIN=quonfig-localhost` and the SDK will route to `primary.quonfig-localhost`, `stream.primary.quonfig-localhost`, etc.

If you need to point individual services somewhere the derivation rule doesn't fit, override the URL lists directly:

```java
Options.builder()
    .sdkKey("sdk-...")
    .apiUrls(List.of("https://primary.example.com"))
    .streamUrls(List.of("https://stream.primary.example.com"))
    .telemetryUrl("https://telemetry.example.com")
    .build();
```

## Feature Flags

For boolean flags, use `featureIsOn`:

```java
import com.quonfig.sdk.eval.ContextSet;

if (quonfig.featureIsOn("my.feature.name", new ContextSet())) {
    // ...
}
```

A flag that doesn't exist yet evaluates to `false`, so you can safely add `featureIsOn` checks before the flag is created.

<details className="alert--info">
<summary>
Feature flags don't have to return just true or false.
</summary>

You can return any supported type using the typed getters described in [Dynamic Config](#dynamic-config) below.

```java
String variant = quonfig.getString("my.string.feature.name", "control");
```

</details>

## Context

Feature flags become more powerful when you give the evaluator [context](/docs/explanations/concepts/context) about the current user, team, request, or host. The Java SDK uses `com.quonfig.sdk.eval.ContextSet` to bundle one or more **named contexts** (e.g. `user`, `team`, `device`).

```java
import com.quonfig.sdk.eval.ContextSet;
import java.util.Map;

ContextSet ctx = new ContextSet()
    .withNamedContext("user", Map.of(
        "key", "user-123",
        "email", "alice@example.com"
    ))
    .withNamedContext("team", Map.of(
        "key", "team-abc",
        "plan", "pro"
    ));
```

Properties are looked up in rules using dotted notation: `user.email`, `team.plan`. The magic property `quonfig.current-time` (also `prefab.current-time` and `reforge.current-time`, kept for compatibility) resolves to the current wall-clock time in milliseconds since the epoch — useful for time-windowed rollouts.

### Global Context

A global context is merged into every evaluation. Use it for values that don't change at runtime (application name, region, host).

```java
ContextSet global = new ContextSet()
    .withNamedContext("application", Map.of(
        "key", "my-api",
        "region", System.getenv("REGION")
    ));

Quonfig quonfig = new Quonfig(
    Options.builder()
        .sdkKey("sdk-...")
        .globalContext(global)
        .build()
);
```

Global context is the least specific layer and is overridden by any per-call context that supplies the same key.

### Bound Context (per-request)

For web servers, bind context for the lifetime of a request via `withContext(...)`. The returned `BoundQuonfig` mirrors every typed getter, with the bound context pre-applied — no need to thread `ContextSet` through every call site.

```java
import com.quonfig.sdk.BoundQuonfig;

ContextSet requestCtx = new ContextSet()
    .withNamedContext("user", Map.of(
        "key", currentUser.getId(),
        "email", currentUser.getEmail()
    ));

BoundQuonfig boundQuonfig = quonfig.withContext(requestCtx);

if (boundQuonfig.featureIsOn("my.feature.name")) {
    // ...
}
```

### Just-in-time Context

You can also pass a `ContextSet` directly to any getter call. It merges with the global (and bound) context; per-call values win on key collision.

```java
ContextSet jitCtx = new ContextSet()
    .withNamedContext("device", Map.of("mobile", true));

boolean enabled = quonfig.featureIsOn("my.feature.name", jitCtx);
```

## Dynamic Config

Config values are read with typed getters that take a key and a default. The default is returned whenever the config is missing, unevaluable, or the wrong type — getters never throw.

```java
import java.time.Duration;
import java.util.List;

String backend       = quonfig.getString("backend.url", "https://api.example.com");
Boolean newCheckout  = quonfig.getBoolean("checkout.v2", Boolean.FALSE);
Long maxJobsPerSec   = quonfig.getInt("max-jobs-per-second", 10L);
Double sampleRate    = quonfig.getDouble("trace.sample-rate", 0.1);
List<String> regions = quonfig.getStringList("regions", List.of("us-east"));
Duration cacheTtl    = quonfig.getDuration("cache.ttl", Duration.ofSeconds(30));
Object slackConfig   = quonfig.getJson("slack.bot.config", Map.of());
```

:::note Integers are returned as `Long`

`getInt` returns a boxed `Long`, not `Integer`. Quonfig stores int configs as 64-bit values everywhere; widening at the SDK boundary avoids silent overflow.

:::

Each getter has a context-bearing overload:

```java
ContextSet ctx = new ContextSet().withNamedContext("user", Map.of("plan", "pro"));
Long maxJobs = quonfig.getInt("max-jobs-per-second", 10L, ctx);
```

### Evaluation details (reason, variant, errors)

Each typed getter has a `getXDetails(...)` variant that returns an `EvaluationDetails<T>` instead of just the value. Use it when you need the resolution `Reason`, the synthetic OpenFeature `variant` identifier, the matching rule index, or the error code on failure.

```java
import com.quonfig.sdk.EvaluationDetails;
import com.quonfig.sdk.Reason;

EvaluationDetails<String> details = quonfig.getStringDetails(
    "backend.url", "https://api.example.com", ctx);

if (details.reason() == Reason.ERROR) {
    log.warn("backend.url evaluation failed: {} ({})",
        details.errorMessage(), details.errorCode());
}
```

`EvaluationDetails<T>` carries:

| Field             | Description                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `value()`         | The typed value (or your default on `DEFAULT` / `ERROR`).                                            |
| `reason()`        | `STATIC`, `TARGETING_MATCH`, `SPLIT`, `DEFAULT`, `ERROR`, or `UNKNOWN`.                              |
| `variant()`       | OpenFeature-style identifier — `"static"`, `"targeting:<n>"`, `"split:<n>"`, or `"default"`.         |
| `variantIndex()`  | The selected weighted-bucket index on `SPLIT`; `null` otherwise.                                     |
| `errorCode()`     | `FLAG_NOT_FOUND`, `TYPE_MISMATCH`, or `GENERAL` on `ERROR`; `null` otherwise.                        |
| `errorMessage()`  | Companion to `errorCode()`.                                                                          |
| `metadata()`      | `configId`, `configKey`, `configType`, optional `ruleIndex`, `weightedValueIndex`, `environment`.    |

## Dynamic Log Levels

Log levels in Quonfig are stored as `log_level` configs. The SDK consults them via `shouldLog(...)`, so changes pushed to Quonfig take effect immediately over SSE — no redeploy or polling.

`shouldLog(loggerPath, level [, ctx])` returns `true` when a record at `level` should be emitted for `loggerPath`. It always injects the logger path into the evaluation context as `quonfig-sdk-logging.key`, and uses one of two lookup strategies:

- **Single-config dispatch** — when you set `loggerKey(...)` on `Options`, that one config is evaluated with `quonfig-sdk-logging.key=<loggerPath>` so a single config drives per-logger rules. This is the recommended pattern.
- **Per-logger lookup** — when `loggerKey` is unset, the SDK looks up a config keyed by `loggerPath` itself, then walks up dotted parents (`com.example.MyClass` → `com.example` → `com` → `""`) until one matches.

If no log-level config is found at any level, `shouldLog` returns `true` — the SDK never silently swallows logs.

### Basic usage

```java
import com.quonfig.sdk.Options;
import com.quonfig.sdk.Quonfig;
import org.slf4j.event.Level;

Quonfig quonfig = new Quonfig(
    Options.builder()
        .sdkKey("sdk-...")
        .loggerKey("log-level.my-app")
        .build()
);

if (quonfig.shouldLog("com.example.auth", Level.DEBUG)) {
    // ...
}
```

### Rule example

Create a `log_level` config keyed `log-level.my-app` and target individual loggers via `quonfig-sdk-logging.key`:

```yaml
# Default to INFO for every logger in this app
default: INFO

rules:
  # Bump a subsystem to DEBUG
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "com.example.auth"
    value: DEBUG

  # Silence a chatty third-party package
  - criteria:
      quonfig-sdk-logging.key:
        starts-with: "org.apache.kafka"
    value: ERROR

  # Turn DEBUG on for one developer, everywhere
  - criteria:
      user.email: "developer@example.com"
    value: DEBUG
```

Because the evaluator sees your full context — global, bound, and the injected logger key — you can combine logger rules with user, environment, or request context to crank verbosity up for one user, one staging deploy, or one bad request, without touching anyone else.

### Wiring Quonfig into Logback (recommended)

The `sdk-java-logback` module ships a `TurboFilter` that gates **every** Logback logger dynamically from Quonfig — no per-call-site `if (shouldLog)` wrapping. Add the dependency (you bring your own Logback; the module declares it `provided`):

```kotlin
implementation("com.quonfig:sdk-java-logback:1.0.0")
implementation("ch.qos.logback:logback-classic:1.5.18")
```

Install the filter once at startup, right after constructing the client:

```java
import com.quonfig.sdk.Quonfig;
import com.quonfig.sdk.logback.QuonfigLogbackTurboFilter;

Quonfig quonfig = new Quonfig(options); // options.loggerKey("log-level.my-app")
QuonfigLogbackTurboFilter.install(quonfig);
```

From then on, ordinary SLF4J calls are gated for you — records below the level Quonfig resolves for the logger's name are dropped, those at or above are emitted:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

private static final Logger log = LoggerFactory.getLogger("my-app");

void doWork() {
    log.debug("expensive thing happened: {}", expensiveDescription()); // dropped unless Quonfig allows DEBUG
    log.warn("heads up");                                              // emitted at a WARN floor
}
```

When Quonfig has no opinion for a logger path the filter returns `NEUTRAL`, so that logger's own threshold and any other filters still apply — installing the filter never silences loggers Quonfig doesn't configure. A reference wiring (driving every level TRACE→ERROR through the real filter and asserting the gate) lives in `test/test-java`.

> Log4j2 users: the parallel `sdk-java-log4j2` module ships an equivalent filter.

### Gating a single call site manually

If you don't use Logback (or want to guard one expensive call), consult `shouldLog` directly:

```java
import org.slf4j.event.Level;

if (quonfig.shouldLog("com.example.auth", Level.DEBUG)) {
    log.debug("expensive thing happened: {}", expensiveDescription());
}
```

`Level` here is `org.slf4j.event.Level`, which the SDK accepts directly and compares against the resolved config value (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`).

## Telemetry

By default Quonfig uploads telemetry that powers the dashboard's evaluation counts, context-shape detection, and example-context capture. Tune or disable via `Options`:

| Name                          | Description                                                                                                                  | Default            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `disableTelemetry`            | Disable all telemetry uploads.                                                                                               | `false`            |
| `collectEvaluationSummaries`  | Send aggregate counts of config/flag evaluation results back to Quonfig.                                                     | `true`             |
| `contextUploadMode`           | How named-context data is reported. One of `NONE`, `SHAPES` (names + types only), `PERIODIC_EXAMPLE` (full sample, redacted). | `PERIODIC_EXAMPLE` |

```java
import com.quonfig.sdk.telemetry.ContextUploadMode;

Quonfig quonfig = new Quonfig(
    Options.builder()
        .sdkKey("sdk-...")
        .collectEvaluationSummaries(true)
        .contextUploadMode(ContextUploadMode.SHAPES)
        .build()
);
```

To disable everything:

```java
Options.builder()
    .sdkKey("sdk-...")
    .disableTelemetry(true)
    .build();
```

`quonfig.flush()` drains any pending telemetry synchronously — useful from short-lived processes (CLI, batch job) before exit. `quonfig.close()` stops the SSE client, telemetry reporter, and background threads.

## Testing

`Quonfig` is a regular class with no static state. The cleanest way to unit-test code that reads configs is to point a `Quonfig` instance at a small datadir of test fixtures:

```java
Quonfig testQuonfig = new Quonfig(
    Options.builder()
        .datadir("src/test/resources/quonfig-fixtures")
        .environment("test")
        .disableTelemetry(true)
        .build()
);
```

For finer-grained tests, mock `Quonfig` (or `BoundQuonfig`) with your favorite mocking library and stub the typed getters directly.

## Reference

### Options

```java
import com.quonfig.sdk.Options;
import com.quonfig.sdk.telemetry.ContextUploadMode;
import java.time.Duration;
import java.util.List;

Options options = Options.builder()
    .sdkKey(System.getenv("QUONFIG_BACKEND_SDK_KEY"))
    .domain("quonfig.com")
    .environment("production")
    .globalContext(global)
    .initTimeout(Duration.ofSeconds(10))
    .loggerKey("log-level.my-app")
    .collectEvaluationSummaries(true)
    .contextUploadMode(ContextUploadMode.PERIODIC_EXAMPLE)
    .build();
```

#### Option Definitions

| Name                          | Description                                                                                                                                | Default                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `sdkKey`                      | Your Quonfig SDK key. Required for HTTP+SSE mode. Falls back to `QUONFIG_BACKEND_SDK_KEY` env var.                                         | (env var)                              |
| `domain`                      | Base domain used to derive `apiUrls`, `streamUrls`, and `telemetryUrl`. Falls back to `QUONFIG_DOMAIN` env var.                            | `quonfig.com`                          |
| `apiUrls`                     | Explicit API base URLs. Takes precedence over `domain`.                                                                                    | `[https://primary.<domain>, https://secondary.<domain>]` |
| `streamUrls`                  | Explicit SSE stream base URLs. Defaults to `apiUrls` rewritten with a `stream.` prefix on each host.                                        | derived from `apiUrls`                 |
| `telemetryUrl`                | Explicit telemetry endpoint.                                                                                                               | `https://telemetry.<domain>`           |
| `environment`                 | Environment name to evaluate against. Required in datadir mode. Falls back to `QUONFIG_ENVIRONMENT` env var.                               | (env var)                              |
| `datadir`                     | Path to a Quonfig workspace directory. Switches the client to datadir mode (no HTTP fetch, no SSE).                                        | `null`                                 |
| `initTimeout`                 | How long the initial config fetch and any later getter call will wait for init to complete.                                                | `10s`                                  |
| `globalContext`               | A `ContextSet` merged into every evaluation as the base layer.                                                                             | empty                                  |
| `onConfigUpdate`              | `Runnable` invoked after every successful config-store swap (initial load + each SSE envelope).                                            | `null`                                 |
| `onSseConnectionStateChange`  | `Consumer<Boolean>` invoked when the SSE connection's connected state changes.                                                             | `null`                                 |
| `loggerKey`                   | Config key consulted by `shouldLog(...)`. When set, enables single-config dispatch via injected `quonfig-sdk-logging.key`.                  | `null`                                 |
| `disableTelemetry`            | Disable all telemetry uploads.                                                                                                             | `false`                                |
| `collectEvaluationSummaries`  | Send aggregate evaluation counts to Quonfig.                                                                                               | `true`                                 |
| `contextUploadMode`           | `NONE`, `SHAPES`, or `PERIODIC_EXAMPLE`.                                                                                                   | `PERIODIC_EXAMPLE`                     |
| `telemetryFlushInterval`      | How often the background reporter flushes pending telemetry.                                                                               | `60s`                                  |
| `telemetryMaxInterval`        | Maximum back-off between telemetry flushes after repeated failures.                                                                        | `600s`                                 |
