---
title: Java
---

## Install the latest version

[GitHub](https://github.com/quonfig/sdk-java) | [Maven Central](https://central.sonatype.com/artifact/com.quonfig/sdk-java)

Gradle and Maven need an explicit version: replace `VERSION` with the [latest version on Maven Central](https://central.sonatype.com/artifact/com.quonfig/sdk-java).

<Tabs groupId="java-build">
<TabItem value="gradle-kotlin" label="Gradle (Kotlin DSL)">

```kotlin
dependencies {
    implementation("com.quonfig:sdk-java:VERSION")
}
```

</TabItem>

<TabItem value="gradle-groovy" label="Gradle (Groovy DSL)">

```groovy
dependencies {
    implementation 'com.quonfig:sdk-java:VERSION'
}
```

</TabItem>

<TabItem value="maven" label="Maven">

```xml
<dependency>
    <groupId>com.quonfig</groupId>
    <artifactId>sdk-java</artifactId>
    <version>VERSION</version>
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

`Quonfig` implements `AutoCloseable`. We recommend using it as a singleton in your application and calling `quonfig.close()` on shutdown to stop the SSE stream and send the last telemetry window.

### If Quonfig is unreachable at startup

The constructor blocks until the first config loads, retrying through blips
(jittered backoff from 0.5s, capped at 30s) until `initTimeout` (default
`10s`). A healthy boot returns as soon as the first config lands, typically in
100-300ms. If no config has loaded by then, `onInitFailure` decides:

| `onInitFailure` | At `initTimeout` | Every configured leg rejects the SDK key (401/403/404/410) |
|---|---|---|
| `OnInitFailure.FAIL` (default) | The constructor throws `QuonfigInitException` (`reason()` `UNAVAILABLE`), or its subclass `QuonfigInitTimeoutException` (`TIMEOUT`) when no attempt finished in time. | Throws at once (`UNAUTHORIZED`). |
| `OnInitFailure.WAIT` | The constructor keeps blocking and retrying, with no upper bound. | Logs an ERROR and keeps retrying. |
| `OnInitFailure.CONTINUE` | The constructor returns a client with no config and logs an ERROR. | Returns at once. |

```java
Quonfig quonfig;
try {
    quonfig = new Quonfig(Options.builder()
        .sdkKey("sdk-...")
        .onInitFailure(OnInitFailure.FAIL) // the default
        .initTimeout(Duration.ofSeconds(10))
        .build());
} catch (QuonfigInitException e) {
    log.error("Quonfig init failed: {}", e.reason(), e);
    throw e; // let the process exit; the orchestrator restarts it
    // or: quonfig = e.client(); // keep the client; it retries and heals
}
```

The client a failed constructor built keeps retrying in the background, and
`e.client()` returns it: keep it and it becomes ready when delivery comes
back, or call `close()` on it if you don't. A process that lets the exception
escape is unaffected.

Getters never block on init. Before the first config loads they return the
caller's default with `Reason.ERROR` and `ErrorCode.PROVIDER_NOT_READY`, and
`get*OrThrow` throws `QuonfigKeyNotFoundException`. `quonfig.isReady()`
reports whether config has loaded, and `quonfig.awaitReady(Duration)` waits
for it; `initFuture()` is still available. Under `WAIT` or `CONTINUE`, wire
your readiness probe to `isReady()`. To keep the 1.x fail-open behavior, set
`.onInitFailure(OnInitFailure.CONTINUE)`. For how to choose between the three,
see [If Quonfig Is Unreachable at Startup](/docs/explanations/architecture/startup-failure).

#### Upgrading from 1.x to 2.0.0

- **The constructor can now throw `QuonfigInitException`** (a
  `RuntimeException`) when delivery is unreachable. Wrap construction if you
  want to handle that, or set `.onInitFailure(OnInitFailure.CONTINUE)` to keep
  the 1.x fail-open behavior.
- **The constructor now blocks** until the first config loads, typically
  100-300 ms, and up to `initTimeout` when delivery is down.
- **`catch (QuonfigInitTimeoutException e)` still compiles and matches**, but
  only for the hang case. It is no longer `final` and now extends
  `QuonfigInitException`; catch that to cover `UNAVAILABLE` and
  `UNAUTHORIZED` too.
- **Getters no longer wait for init.** Before the first config they return
  your default with `ErrorCode.PROVIDER_NOT_READY` (was `GENERAL` after waiting
  up to `initTimeout`), and `get*OrThrow` throws `QuonfigKeyNotFoundException`
  (was `QuonfigInitTimeoutException`).
- **`initTimeout` of zero or less** runs exactly one attempt, then applies
  `onInitFailure`.
- Datadir and datafile modes are unchanged; they load synchronously.

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

To pick up on-disk changes without restarting (an editor save, a `git pull`, a build step), opt in to `dataDirAutoReload(true)`. The SDK watches the directory and re-reads the envelope on each debounced change, firing `onConfigUpdate`. It is off by default; tune the debounce window with `dataDirAutoReloadDebounceMs(long)` (default 200ms).

```java
Options.builder()
    .datadir("/path/to/your-workspace")
    .environment("development")
    .dataDirAutoReload(true) // off by default
    .onConfigUpdate(() -> System.out.println("configs reloaded from disk"))
    .build();
```

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

Or set `QUONFIG_DOMAIN=<your-domain>` in the environment to derive every service URL from one domain (for example a proxied deployment). The SDK then routes to `primary.<your-domain>`, `stream.primary.<your-domain>`, and so on.

If you need to point individual services somewhere the derivation rule doesn't fit, override the URL lists directly. `apiUrls` accepts an ordered list — pass **both** a primary and a secondary to keep automatic failover:

```java
Options.builder()
    .sdkKey("sdk-...")
    .apiUrls(List.of(
        "https://primary.example.com",
        "https://secondary.example.com"))
    .streamUrls(List.of(
        "https://stream.primary.example.com",
        "https://stream.secondary.example.com"))
    .telemetryUrl("https://telemetry.example.com")
    .build();
```

:::note Single URL disables failover
Passing a single-element `apiUrls` list replaces the derived primary/secondary pair with just that one host, which turns off automatic failover and hedging — the SDK logs a warning at init. Pass a primary **and** a secondary URL (as above) to keep failover.
:::

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

Properties are looked up in rules using dotted notation: `user.email`, `team.plan`. The magic property `quonfig.current-time` resolves to the current wall-clock time in milliseconds since the epoch — useful for time-windowed rollouts.

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

Config values are read with typed getters that take a key and a default. The default is returned whenever there is no value of the getter's type: the config is missing, no rule matches, it holds another type, its value is malformed, or an ENV_VAR or secret cannot be resolved. Getters never throw.

```java
import java.time.Duration;
import java.util.List;

String backend       = quonfig.getString("backend.url", "https://api.example.com");
Boolean newCheckout  = quonfig.getBool("checkout.v2", Boolean.FALSE);
Long maxJobsPerSec   = quonfig.getLong("max-jobs-per-second", 10L);
Double sampleRate    = quonfig.getDouble("trace.sample-rate", 0.1);
List<String> regions = quonfig.getStringList("regions", List.of("us-east"));
Duration cacheTtl    = quonfig.getDuration("cache.ttl", Duration.ofSeconds(30));
Object slackConfig   = quonfig.getJson("slack.bot.config", Map.of());
```

:::note Integers are returned as `Long`

`getLong` returns a boxed `Long`, because Quonfig stores int configs as 64-bit values everywhere. `getInt` and `getBoolean` are deprecated aliases of `getLong` and `getBool`; new code should use the new names.

:::

The getters follow the typed-getter contract shared by every Quonfig SDK:

- **No string coercion.** A stored string `"false"` is not a bool, `"3"` is not an int, and a duration config is not a string (read it with `getDuration`).
- **Numbers convert only when exact.** `getDouble` reads an int config (`30` becomes `30.0`). `getLong` reads a double config only when it is a whole number within ±(2^53-1) (`3.0` becomes `3`); `3.9` or `1e300` is a type mismatch. Nothing is truncated.
- **One WARN per key.** A wrong-type or malformed value, an unset ENV_VAR or a secret that cannot be decrypted returns your default and logs one WARN per key per client. The WARN names the key, never the value.
- **`featureIsOn` never throws.** It returns `true` only for a stored bool `true`, and `false` (with one WARN per key) for anything else.

A wrong decryption key therefore degrades to your defaults. When a config must fail hard, read it with the `get*OrThrow` family (`getStringOrThrow`, `getLongOrThrow`, ...). It throws `QuonfigKeyNotFoundException` for a missing key or no matching rule, `QuonfigTypeMismatchException` for another type, `QuonfigCoercionException` for a malformed value, `QuonfigEnvVarNotSetException` or `QuonfigDecryptionException`:

```java
String dbPassword = quonfig.getStringOrThrow("db.password"); // throws on a bad decryption key
```

The rules are the same in every Quonfig SDK; see [Typed Getters, Defaults, and Error Codes](/docs/explanations/concepts/typed-getters).

Each getter has a context-bearing overload:

```java
ContextSet ctx = new ContextSet().withNamedContext("user", Map.of("plan", "pro"));
Long maxJobs = quonfig.getLong("max-jobs-per-second", 10L, ctx);
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
| `errorCode()`     | On `ERROR`: `FLAG_NOT_FOUND` (missing key), `TYPE_MISMATCH` (another type), `PARSE_ERROR` (right type, but the value does not parse), `PROVIDER_NOT_READY` (no config loaded yet) or `GENERAL` (an unset ENV_VAR or a decryption failure). `null` otherwise. |
| `errorMessage()`  | Companion to `errorCode()`.                                                                          |
| `metadata()`      | `configId`, `configKey`, `configType`, optional `ruleIndex`, `weightedValueIndex`, `environment`, `hashPropertyMissing` (`true` when a weighted rollout's hash property was missing). |


The details getters are `getStringDetails`, `getBoolDetails`, `getLongDetails`, `getDoubleDetails`, `getStringListDetails`, `getDurationDetails` and `getJsonDetails` (`getIntDetails` and `getBooleanDetails` are deprecated aliases). They never throw.

### Untyped details read

`evaluateDetails(key)` and `evaluateDetails(key, ctx)` (also on a bound client) return an `EvaluationDetails<Object>` with the value exactly as stored: no type check and no coercion, with the same reason, variant and metadata as the typed details getters. `valueType()` names the config's stored type. A duration comes back as its ISO 8601 text (`"PT90S"`). A missing key returns a `null` value with `Reason.ERROR` and `FLAG_NOT_FOUND`. It never throws, and it is meant for adapters such as OpenFeature providers that do their own typing.

```java
import com.quonfig.sdk.eval.ValueType;

EvaluationDetails<Object> d = quonfig.evaluateDetails("http.timeout");
if (d.valueType() == ValueType.DURATION) {
    String iso = (String) d.value(); // "PT90S"
}
```

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

### Rules

Set levels with the [`qfg` CLI](/docs/tools/cli#log-level). Each `--target` adds a rule that matches every logger whose name starts with that prefix:

```bash
# Default to INFO for every logger in this app
qfg log-level log-level.my-app --value=INFO

# Bump one subsystem to DEBUG
qfg log-level log-level.my-app --target=com.example.auth --value=DEBUG

# Quiet a chatty library, in one environment only
qfg log-level log-level.my-app --target=org.apache.kafka --value=ERROR --environment=production
```

For rules on other properties, such as turning on DEBUG for one developer by `user.email`, add the rule in the Quonfig app. [Dynamic Log Levels](../explanations/features/dynamic-log-levels.md) walks through rule order and shows the stored JSON.

Because the evaluator sees your full context — global, bound, and the injected logger key — you can combine logger rules with user, environment, or request context to crank verbosity up for one user, one staging deploy, or one bad request, without touching anyone else.

### Wiring Quonfig into Logback (recommended)

The `sdk-java-logback` module ships a `TurboFilter` that gates **every** Logback logger dynamically from Quonfig — no per-call-site `if (shouldLog)` wrapping. Add the dependency (you bring your own Logback; the module declares it `provided`):

```kotlin
implementation("com.quonfig:sdk-java-logback:VERSION") // same version as sdk-java
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

When Quonfig has no opinion for a logger path the filter returns `NEUTRAL`, so that logger's own threshold and any other filters still apply — installing the filter never silences loggers Quonfig doesn't configure.

> Log4j2 users: the parallel `com.quonfig:sdk-java-log4j2` module ships an equivalent filter.
>
> Micronaut users: `com.quonfig:sdk-java-micronaut` stores a per-request `ContextSet` for Micronaut HTTP apps. Both modules ship lock-step with `sdk-java` from the same tag, so keep their versions aligned.

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
| `contextUploadMode`           | How named-context data is reported. One of `NONE`, `SHAPES_ONLY` (names + types only), `PERIODIC_EXAMPLE` (shapes plus example contexts with values). | `PERIODIC_EXAMPLE` |

```java
import com.quonfig.sdk.telemetry.ContextUploadMode;

Quonfig quonfig = new Quonfig(
    Options.builder()
        .sdkKey("sdk-...")
        .collectEvaluationSummaries(true)
        .contextUploadMode(ContextUploadMode.SHAPES_ONLY)
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

`quonfig.flush()` sends the current telemetry window and waits for the POST — useful from short-lived processes (CLI, batch job) before exit. It does not throw on a failed POST. `quonfig.close()` sends the current window once with a 5s deadline and stops the SSE client, telemetry reporter, and background threads.

### Delivery options

How the SDK delivers telemetry, and what it does when the endpoint is slow or down, is the same in
every SDK and is explained once on the [Telemetry](../explanations/architecture/telemetry.md) page.
The Java builder methods and defaults:

| `Options.builder()` method         | Default                   |
| ---------------------------------- | ------------------------- |
| `telemetryFlushInterval`           | `Duration.ofSeconds(60)`  |
| `telemetryTimeout`                 | `Duration.ofSeconds(15)`  |
| `telemetryConnectTimeout`          | `Duration.ofSeconds(5)`   |
| `telemetryMaxRetainedBatches`      | `5`                       |
| `telemetryMaxRetainedBytes`        | `2097152` (2MB)           |
| `telemetryMaxRetainedAge`          | `Duration.ofMinutes(5)`   |
| `telemetryMaxEvaluationSummaries`  | `10000`                   |
| `telemetryMaxContextShapeFields`   | `10000`                   |
| `telemetryMaxExampleContexts`      | `10000`                   |

Invalid values (null, zero, negative) fall back to the default. Telemetry logs through SLF4J, or
the `logger(...)` you pass (default `com.quonfig.sdk`).

The flush cadence is a fixed interval set by `telemetryFlushInterval`. `telemetryMaxInterval` is
deprecated and has no effect (the builder method still compiles).

## Invalid or revoked SDK key

If Quonfig rejects the SDK key while the client is running,
`com.quonfig:sdk-java` stops streaming, probes every 150-300 seconds
until the key works again, and logs one ERROR naming the HTTP status and host
(never the key). The full rule is on the [Reliability](../explanations/architecture/resiliency.md#invalid-or-revoked-sdk-key) page.

While the key is rejected, `quonfig.connectionState()` returns
`ConnectionState.DISCONNECTED`, never `FALLING_BACK`. Evaluation keeps serving
the last installed configuration, and the client recovers by itself on the
first accepted probe.

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
    .globalContext(global)
    .initTimeout(Duration.ofSeconds(10))
    .onInitFailure(OnInitFailure.FAIL)
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
| `environment`                 | Datadir mode only: environment name to evaluate against (required there). Falls back to `QUONFIG_ENVIRONMENT` env var. Ignored with a warning in SDK-key mode, where the SDK key determines the environment. | (env var)                              |
| `datadir`                     | Path to a Quonfig workspace directory. Switches the client to datadir mode (no HTTP fetch, no SSE).                                        | `null`                                 |
| `dataDirAutoReload`           | In datadir mode, watch the directory and re-read the envelope on file changes (fires `onConfigUpdate`).                                     | `false`                                |
| `dataDirAutoReloadDebounceMs` | Debounce window (ms) coalescing filesystem bursts when `dataDirAutoReload` is on.                                                          | `200`                                  |
| `initTimeout`                 | How long the constructor retries the initial config fetch before `onInitFailure` applies. Getters never wait.                              | `10s`                                  |
| `onInitFailure`               | `FAIL`, `WAIT` or `CONTINUE` when no config loads within `initTimeout` (see [startup](#if-quonfig-is-unreachable-at-startup)).            | `FAIL`                                 |
| `globalContext`               | A `ContextSet` merged into every evaluation as the base layer.                                                                             | empty                                  |
| `onConfigUpdate`              | `Runnable` invoked after every successful config-store swap (initial load + each SSE envelope).                                            | `null`                                 |
| `onSseConnectionStateChange`  | `Consumer<Boolean>` invoked when the SSE connection's connected state changes.                                                             | `null`                                 |
| `loggerKey`                   | Config key consulted by `shouldLog(...)`. When set, enables single-config dispatch via injected `quonfig-sdk-logging.key`.                  | `null`                                 |
| `disableTelemetry`            | Disable all telemetry uploads.                                                                                                             | `false`                                |
| `collectEvaluationSummaries`  | Send aggregate evaluation counts to Quonfig.                                                                                               | `true`                                 |
| `contextUploadMode`           | `NONE`, `SHAPES_ONLY`, or `PERIODIC_EXAMPLE`.                                                                                              | `PERIODIC_EXAMPLE`                     |
| `telemetryFlushInterval`      | How often the background reporter sends telemetry. Other telemetry options: [Delivery options](#delivery-options).                         | `60s`                                  |
| `telemetryMaxInterval`        | Deprecated; no effect. See [Delivery options](#delivery-options).                                                              | n/a                                    |
