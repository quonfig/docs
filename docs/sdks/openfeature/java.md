---
title: Java (OpenFeature)
---

[OpenFeature](https://openfeature.dev) is a CNCF standard for feature flag evaluation.
`com.quonfig:openfeature-server-java` is a thin provider that wraps the native
`com.quonfig:sdk-java` SDK and implements the OpenFeature Java server-side `FeatureProvider`
interface.

## Install

Replace `VERSION` with the [latest version on Maven Central](https://central.sonatype.com/artifact/com.quonfig/openfeature-server-java).

Gradle (Kotlin DSL):

```kotlin
dependencies {
    implementation("com.quonfig:openfeature-server-java:VERSION")
}
```

Maven:

```xml
<dependency>
  <groupId>com.quonfig</groupId>
  <artifactId>openfeature-server-java</artifactId>
  <version>VERSION</version>
</dependency>
```

The provider brings in `com.quonfig:sdk-java` and the OpenFeature Java SDK
(`dev.openfeature:sdk`) as transitive dependencies.

## Initialize

```java
import com.quonfig.openfeature.QuonfigProvider;
import com.quonfig.openfeature.QuonfigProviderOptions;
import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.OpenFeatureAPI;

QuonfigProvider provider = new QuonfigProvider(
    QuonfigProviderOptions.builder()
        .sdkKey("qf_sk_production_...")
        .build());

// Registers the provider and blocks until initialize() completes.
OpenFeatureAPI.getInstance().setProviderAndWait(provider);

Client client = OpenFeatureAPI.getInstance().getClient();
```

## Evaluate flags

```java
import dev.openfeature.sdk.Value;

// Boolean flag
boolean enabled = client.getBooleanValue("checkout-v2", false);

// String config
String welcome = client.getStringValue("welcome-message", "Hello!");

// Integer config (Quonfig stores 64-bit ints; narrowed to int)
int seats = client.getIntegerValue("max-seats", 5);

// Double config
double limit = client.getDoubleValue("upload-limit-gb", 1.0);

// Object config (JSON or string_list)
Value allowedPlans = client.getObjectValue("allowed-plans", new Value());
```

Use the `get*Details` variants (for example `getBooleanDetails`) to read the reason, variant
and error code alongside the value.

## Evaluation context

Pass per-request context as an `EvaluationContext`:

```java
import dev.openfeature.sdk.MutableContext;

MutableContext ctx = new MutableContext("user-123") // targetingKey -> user.id by default
    .add("user.plan", "pro")
    .add("org.tier", "enterprise");

boolean isPro = client.getBooleanValue("pro-feature", false, ctx);
```

OpenFeature context is flat; Quonfig context is namespace-nested. The provider maps
between them using dot-notation:

| OpenFeature key | Quonfig namespace | Quonfig property |
|----------------|-------------------|-----------------|
| `targetingKey` | `user` | `id` (configurable) |
| `"user.email"` | `user` | `email` |
| `"org.tier"` | `org` | `tier` |
| `"country"` (no dot) | `""` (default) | `country` |
| `"user.ip.address"` | `user` | `ip.address` (split on first dot) |

### Custom targetingKey mapping

```java
QuonfigProvider provider = new QuonfigProvider(
    QuonfigProviderOptions.builder()
        .sdkKey("qf_sk_...")
        .targetingKeyMapping("org.id")
        .build());
```

## Local / offline mode

Use `datadir` instead of `sdkKey` to evaluate against a Quonfig workspace on disk. No
network calls are made.

```java
QuonfigProvider provider = new QuonfigProvider(
    QuonfigProviderOptions.builder()
        .datadir("/path/to/workspace")
        .environment("production")
        .build());
```

The environment name must match one listed in the workspace's `quonfig.json`
exactly (matching is case-sensitive, and workspace environments are lowercase,
such as `production`).

## Init failure

`initialize()` builds the native client, which blocks until the first config loads
and retries through blips until `initTimeout` (default 10s). What happens when
delivery is down is set by `onInitFailure`. Both options pass straight through to
`com.quonfig:sdk-java`:

```java
import com.quonfig.sdk.OnInitFailure;
import java.time.Duration;

QuonfigProvider provider = new QuonfigProvider(
    QuonfigProviderOptions.builder()
        .sdkKey("qf_sk_production_...")
        .initTimeout(Duration.ofSeconds(5))      // default: 10s
        .onInitFailure(OnInitFailure.CONTINUE)   // default: FAIL
        .build());
```

| `onInitFailure` | `initialize()` | Provider status | When config arrives |
|---|---|---|---|
| `FAIL` (default) | Throws, so `setProviderAndWait` throws | `ERROR` | `PROVIDER_READY` |
| `WAIT` | Blocks until the first config loads | `NOT_READY` | Returns; `READY` |
| `CONTINUE` | Returns, then emits `PROVIDER_ERROR` | `ERROR` | `PROVIDER_READY` |

Under `FAIL` and `CONTINUE` the provider keeps the client, which keeps retrying in
the background. Evaluations return your default with `PROVIDER_NOT_READY` until a
config arrives. `ERROR` is non-fatal: evaluations still run. Datadir mode loads
synchronously and is unaffected. See
[If Quonfig Is Unreachable at Startup](/docs/explanations/architecture/startup-failure).

## Lifecycle events

The provider emits standard OpenFeature provider events:

- `PROVIDER_READY` after `initialize()` succeeds, and again when a client that started
  without config (`FAIL` or `CONTINUE` above) receives its first config.
- `PROVIDER_ERROR` if initialization fails (the exception is also rethrown from
  `initialize()`), and after `initialize()` returns under `CONTINUE` with no config
  (nothing is rethrown in that case).
- `PROVIDER_CONFIGURATION_CHANGED` when the SDK receives a config update after the provider
  is ready.
- `PROVIDER_STALE` is not emitted: the Java SDK is a server SDK and keeps no cached config.

```java
OpenFeatureAPI.getInstance().onProviderReady(details ->
    System.out.println("Quonfig provider ready"));

OpenFeatureAPI.getInstance().onProviderConfigurationChanged(details ->
    System.out.println("Config updated"));
```

## Reasons and errors

Evaluation never throws. On an error, or when the value is null, you get your default value
back, with the error code and message set on the evaluation details.

- Reasons pass through from the SDK: `STATIC`, `TARGETING_MATCH`, `SPLIT`, `DEFAULT`
  (anything else becomes `UNKNOWN`).
- A missing flag returns reason `DEFAULT` with error code `FLAG_NOT_FOUND`. Other errors
  (`TYPE_MISMATCH`, `PARSE_ERROR`, `GENERAL`) return reason `ERROR`.
- Values are never coerced: a stored `"true"` is not a boolean, `"3"` is not a number, and
  an int or bool config is not a string. Reading a flag with the method for another type
  returns `TYPE_MISMATCH`. Numbers convert only when exact: `getDoubleValue` reads an int
  config, and `getIntegerValue` reads a double only when it is a whole number within
  ±(2^53-1) and the `int` range.
- A value of the right type that does not parse (a stored int `"twelve"`, an ENV_VAR set to
  an unparseable string, or a malformed duration such as `"30s"` read with
  `getStringValue`) returns `PARSE_ERROR`. An unset ENV_VAR returns `GENERAL`.
- Calls made before the provider is initialized, or while no config has loaded yet (see
  [Init failure](#init-failure)), return the default with `PROVIDER_NOT_READY`.

The rules come from the native SDK; see
[Typed Getters, Defaults, and Error Codes](/docs/explanations/concepts/typed-getters).

## Native SDK escape hatch

`provider.getClient()` returns the underlying `com.quonfig.sdk.Quonfig` client for features
not available in OpenFeature. It returns `null` until the provider has been initialized.

```java
import com.quonfig.sdk.Quonfig;
import java.time.Duration;
import org.slf4j.event.Level;

Quonfig q = provider.getClient();

// Parsed duration values
Duration ttl = q.getDuration("cache.ttl", Duration.ZERO);

// Log level integration
boolean shouldLog = q.shouldLog("com.example.Auth", Level.DEBUG);

// List all config keys
java.util.Set<String> keys = q.keys();
```

## What you lose vs. the native SDK

OpenFeature is designed for feature flags, not general configuration. Some Quonfig
features require the native `com.quonfig:sdk-java` SDK directly:

1. **Log levels** -- `shouldLog()` and `getLogLevel()` are native-only; use `provider.getClient()`.
2. **`duration` configs** -- returned as the ISO 8601 string (e.g. `"PT90S"`) exactly as stored, via `getStringValue()`; use `getClient().getDuration()` for a `java.time.Duration`.
3. **`bytes` configs** -- not accessible (no binary type in OpenFeature).
4. **`keys()`** and raw config access -- use `provider.getClient()`.
5. **Context keys use dot-notation** -- pass `"user.email"`, not nested objects.
6. **`targetingKey` maps to `user.id` by default** -- configure `targetingKeyMapping` if different.
