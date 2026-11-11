---
title: Typed Getters, Defaults, and Error Codes
sidebar_position: 7
---

Every Quonfig SDK reads config through **typed getters**: `getString`, `getBool`, `getInt` and
so on, spelled the way each language spells them. They all follow one contract. This page
describes it once. Each SDK page has a short section with that SDK's method names and links back
here.

## The contract

A typed getter returns a value of its type, or **no value**. It returns no value when:

- the key is missing, or no rule matches;
- the config holds **another type**. There is no string coercion: a stored string `"false"` is
  not a bool, `"3"` is not a number, and a duration config is not a string;
- the value is **malformed**, for example an int config holding `"twelve"` or a duration config
  holding `"30s"`;
- the value comes from an environment variable that is not set, or it is a
  [secret](/docs/explanations/features/secret-management) that cannot be decrypted (backend SDKs
  only; frontend SDKs never receive these values).

**Numbers convert only when the result is exact.** A float/double getter reads an int config
(`30` becomes `30.0`). An int getter reads a double config only when it is a whole number within
±(2^53-1) (`3.0` becomes `3`). `3.9`, `1e300` and `2^53` are type mismatches. Nothing is ever
truncated.

**With no value, you get your default.** If you passed a default, the getter returns it, exactly
as you passed it. If you didn't, the SDK's no-default policy decides (see the
[table below](#per-sdk-reference)). On most backend SDKs the default policy is to throw, so a
typed read with no default throws on a missing key, a wrong type or a malformed value.

**Flag checks never throw.** `isEnabled` (and its equivalent in each SDK) returns `true` only
for a flag whose value is the bool `true`. It returns `false` for a missing key, a flag with no
matching rule, a non-bool value (the string `"true"` included) and any resolution error,
whatever the no-default policy is.

**Each failure logs one warning per key.** A type mismatch, a malformed value, an unset
environment variable or a decryption failure logs one WARN per key per client. In most SDKs a
flag check that returns `false` for a missing key or no matching rule logs one too. The warning
names the key and the types, never the value.

Store each value with the config type you read it with. If a read keeps returning your default,
the warning tells you which key to look at, and a details getter tells you why.

### A broken config degrades to defaults

Because a failed read returns your default, a wrong decryption key or an unset environment
variable in production serves your code defaults and logs warnings. It doesn't stop your service.
If a config must fail hard (a database password, say), read it **without a default** under a
throwing no-default policy, or with the SDK's throwing variant (`get*OrThrow` in Java). That read
then throws the underlying error.

## Details getters and error codes

The details getters (`getStringDetails`, `get_int_details`, `GetBoolDetails` and so on) return
the value together with a `reason`, a `variant` and, when the read failed, an `errorCode`.
Details getters **never throw**. A failed read has reason `ERROR`, your default (or no value) as
the value, and one of these codes:

| Error code | Meaning | Typical cause |
|---|---|---|
| `FLAG_NOT_FOUND` | The key is not in the loaded config. | A typo, the wrong environment, or a config not sent to frontend SDKs. |
| `TYPE_MISMATCH` | The config holds another type than the one you asked for. | Reading an int config with a string getter, or `3.9` with an int getter. A caller problem. |
| `PARSE_ERROR` | The value has the right type but does not parse. | An int config holding `"twelve"`, a duration holding `"30s"`, or an environment variable that cannot be converted. A data problem. |
| `PROVIDER_NOT_READY` | The client has no config yet. | A read before the first config loads, or while a client that started without config is still retrying. |
| `GENERAL` | Anything else. | An unset environment variable, or a secret that cannot be decrypted. |

Code that switches on the error code should handle all five. A few SDKs use a subset; see
[SDK differences](#sdk-differences).

Most SDKs also have an **untyped details read** (`evaluateDetails` or its equivalent). It returns
any config's value in its stored form, for example a duration as its ISO 8601 text (`"PT90S"`),
plus the stored type, with no type check. OpenFeature providers use it to return a duration's
text.

The OpenFeature providers ([Node](/docs/sdks/openfeature/node),
[Web](/docs/sdks/openfeature/web), [Python](/docs/sdks/openfeature/python),
[Ruby](/docs/sdks/openfeature/ruby), [Go](/docs/sdks/openfeature/go),
[Java](/docs/sdks/openfeature/java), [.NET](/docs/sdks/openfeature/dotnet)) wrap these SDKs, so
they follow the same contract and report these codes as OpenFeature error codes. Each provider
page lists its reason and error mapping.

## Per-SDK reference

| SDK | Typed getters | Default | With no default | Flag check | Details |
|---|---|---|---|---|---|
| [Node](/docs/sdks/node/) | `getString`, `getBool`, `getInt`, `getNumber`, `getStringList`, `getDuration` (ms), `getJSON` | optional 3rd argument: `(key, contexts?, default?)` | `onNoDefault`: `"error"` (default) throws; `"warn"` / `"ignore"` return `undefined` | `isEnabled` | `get*Details`, `evaluateDetails` |
| [Python](/docs/sdks/python/) | `get_string`, `get_bool`, `get_int`, `get_float`, `get_string_list`, `get_duration` (seconds), `get_json` | `default=` | `on_no_default`: `"error"` (default) raises; `"warn"` / `"ignore"` return `None` | `is_feature_enabled` | `*_details`, `evaluate_details` |
| [Ruby](/docs/sdks/ruby) | `get_string`, `get_bool`, `get_int`, `get_float`, `get_string_list`, `get_duration` (ms), `get_json` | `default:` | `on_no_default`: `:raise` (default) raises; `:return_nil` returns `nil` | `enabled?` | `*_details`, `evaluate_details` |
| [Go](/docs/sdks/go) | `GetStringValue`, `GetBoolValue`, `GetIntValue`, `GetFloatValue`, `GetStringSliceValue`, `GetDurationValue`, `GetJSONValue` | none: each returns `(value, ok, err)`; apply your default when `ok` is false | `err` matches a sentinel such as `quonfig.ErrTypeMismatch` | `FeatureIsOn` | `EvaluateDetails` |
| [Java](/docs/sdks/java) | `getString`, `getBool`, `getLong`, `getDouble`, `getStringList`, `getDuration`, `getJson` | required argument (pass `null` for none) | returns your default (or `null`); `get*OrThrow` throws instead | `featureIsOn` | `get*Details`, `evaluateDetails` |
| [.NET](/docs/sdks/dotnet) | `GetString`, `GetBool`, `GetInt`, `GetLong`, `GetDouble`, `GetStringList`, `GetDuration`, `GetJson` | optional `defaultValue:` | `OnNoDefault`: `Throw` (default) throws; `Warn` / `Ignore` return `null` | `IsFeatureEnabled` | `Get*Details`, `EvaluateDetails` |
| [Swift](/docs/sdks/swift) | `string`, `int`, `double`, `stringList`, `duration` (seconds), `json` | required `default:` (`json` returns `nil`) | not applicable; getters never throw | `isEnabled` | `details(_:)`, `details(_:as:)` |
| [JavaScript](/docs/sdks/javascript), [React](/docs/sdks/react), [React Native](/docs/sdks/react-native) | `get` (any type, as stored) and `getDuration` | `getDuration(key, default?)` | `get` returns `undefined`; never throws | `isEnabled` | `getDetails` |

## SDK differences

- **Go** has no default argument. Every getter returns `(value, ok, err)`. When `ok` is false,
  apply your default; `err` matches `quonfig.ErrNotFound` (or is nil) for a missing key,
  `quonfig.ErrTypeMismatch`, `quonfig.ErrUnableToCoerce` (malformed), `quonfig.ErrMissingEnvVar`
  or `quonfig.ErrUnableToDecrypt`. `FeatureIsOn` returns `(false, false)` for anything that is not
  a bool `true`.
- **Java** getters always take a default and never throw. Use `get*OrThrow` (for example
  `getStringOrThrow`) when a read must fail hard.
- **.NET** has no `PROVIDER_NOT_READY` code. Before the first config loads, every key reads as
  missing (`FlagNotFound`), so your default or `OnNoDefault` applies.
- **Swift** getters require a default and never throw. A malformed value reports
  `TYPE_MISMATCH` rather than `PARSE_ERROR`, and there is no `GENERAL` code.
- **Browser JavaScript, React and React Native** receive values the server already evaluated, so
  there is no typed getter family beyond `getDuration`. `get` returns the value as stored, or
  `undefined` for a missing key or a value that doesn't match its declared type. These SDKs have
  no `PROVIDER_NOT_READY` code, and secrets and environment-variable values never reach them.
