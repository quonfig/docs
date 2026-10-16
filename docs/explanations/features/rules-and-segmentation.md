---
title: Rules and Segmentation
sidebar_label: Rules and Segmentation
sidebar_position: 3
---

Quonfig provides powerful rules that can you can compose to target exactly the users you're interested in.

Segments are reusable sets of rules that you can use across multiple feature flags.

:::tip
Rules are evaluated in order. You can drag and drop rules to rearrange them. The first matching rule determines which variant is served.
:::

When a rule matches, you can either:

- Return a specific variant (e.g. `true`, `false`, or `yellow`)
- Return a variant based on a percentage (e.g. `true` 10% of the time and `false` 90% of the time)

Note that the variant determined by percentage rollouts is "sticky" to the provided lookup key and won't change unless the key changes or the percentage values change.

## Available Rules

### String Rules

| Name          | Function                 | Example usage                                                              | Notes |
|---------------|--------------------------|----------------------------------------------------------------------------|-------|
| `Property Is One Of` | Use `Property Is One Of` to target users with specific attributes. | If you set `Criteria Property` to `subscription` and `Criteria Values` to `pro,advanced` then it will match users with a `pro` or `advanced` subscription. ||
| `Property Is Not One Of` | Use `Property Is Not One Of` to target users who do not match a specific attribute. | If you set `Criteria Property` to `subscription` and `Criteria Values` to `pro,advanced` then it will match users who have neither a `pro` nor an `advanced` subscription. ||
| `Property Ends With One Of` | Use `Property Ends With One Of` to target users with an attribute that ends with a value. | If you set `Criteria Property` to `email` and `Criteria Values` to `@example.com` then it will match users who have an `email` ending with `@example.com` ||
| `Property Does Not End With One Of` | Use `Property Does Not End With One Of` to target users with an attribute that does not end with a value. | If you set `Criteria Property` to `email` and `Criteria Values` to `@gmail.com,@yahoo.com` then it will match users who have an `email` that does not end with `@gmail.com` or `@yahoo.com`. ||
| `Property Starts With One Of` | Use `Property Starts With One Of` to target users with an attribute that starts with a value. || See note below on SDK version requirements for new rule operators |
| `Property Does Not Start With One Of` | Use `Property Does Not Starts With One Of` to target users with an attribute that does not start with a value. || See note below on SDK version requirements for new rule operators|
| `Property Contains One Of` | Use `Property Contains One Of` to target users with an attribute that contains a value. || See note below on SDK version requirements for new rule operators |
| `Property Does Not Contain One Of` | Use `Property Does Not Contain One Of` to target users with an attribute that does not contain a value. || See note below on SDK version requirements for new rule operators|
| `Property Matches` | Use `Property Matches` to target users with an attribute that matches a regular expression (Regex) || See note below on SDK version requirements for new rule operators |
| `Property Does Not Match` | Use `Property Does Not Match` to target users with an attribute that does not match a regular expression (Regex) || See note below on SDK version requirements for new rule operators|

### Numeric Rules

| Name          | Function                 | Example usage                                                              | Notes |
|---------------|--------------------------|----------------------------------------------------------------------------|-------|
| `Property Is Greater Than` | Use `Property Is Greater Than` to target with a numeric attribute greater than a threshold | If you set `Criteria Property` to `company.employees` and `Criteria Value` to 100, then the rule will match users belonging to a company with more than 100 employees |See note below on SDK version requirements for new rule operators|
| `Property Is Greater Than Or Equal To` | Use `Property Is Greater Than Or Equal To` to target with a numeric attribute greater than or equal threshold | If you set `Criteria Property` to `company.employees` and `Criteria Value` to 100, then the rule will match users belonging to a company with 100 or more employees |See note below on SDK version requirements for new rule operators|
| `Property Is Less Than` | Use `Property Is Less Than` to target with a numeric attribute less than a threshold | If you set `Criteria Property` to `company.employees` and `Criteria Value` to 100, then the rule will match users belonging to a company with less than 100 employees |See note below on SDK version requirements for new rule operators|
| `Property Is Less Than Or Equal To` | Use `Property Is Less Than Or Equal To` to target with a numeric attribute less than than or equal to a  threshold | If you set `Criteria Property` to `company.employees` and `Criteria Value` to 100, then the rule will match users belonging to a company with 100 or fewer employees |See note below on SDK version requirements for new rule operators|


### Date Rules

Both the context value and the `Criteria Value` must be one of:

- a number: milliseconds since the Unix epoch (fractions are truncated)
- a string of digits: milliseconds since the Unix epoch, for example `"1735689600000"`
- an RFC 3339 / ISO 8601 timestamp with an uppercase `T` and a `Z` or numeric offset, for example `2025-01-01T00:00:00Z` or `2025-01-01T09:00:00+09:00` (fractional seconds allowed)

Anything else does not match: a date-only string (`"2025-01-01"`), a timestamp
with no offset (`"2025-01-01T00:00:00"`), or free-form text (`"Jan 1 2025"`).
In most languages, pass `Date.now()`, `date.getTime()` or an ISO string with
`Z` (for example JavaScript's `date.toISOString()`).

JSON config operator names: `PROP_BEFORE`, `PROP_AFTER`.

| Name          | Function                 | Example usage                                                              | Notes |
|---------------|--------------------------|----------------------------------------------------------------------------|-------|
| `Property Is Before` | Use `Property Is Before` to target with a date attribute before than a threshold | If you set `Criteria Property` to `user.createdAt` and `Criteria Value` to '2025-01-01T00:00:00Z', then the rule will match users created before Jan 1, 2025.  | See note below on SDK version requirements for new rule operators |
| `Property Is After` | Use `Property Is After` to target with a date attribute after a threshold | If you set `Criteria Property` to `user.createdAt` and `Criteria Value` to '2025-01-01T00:00:00Z', then the rule will match users created after Jan 1, 2025.  | See note below on SDK version requirements for new rule operators |


### Semantic Version Rules

Semver rules parse both the context value and the criteria value as [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) versions and compare them by SemVer precedence: a pre-release sorts before its release (`2.0.0-rc.1` < `2.0.0`), and build metadata (`+build.5`) is ignored.

Abbreviated versions are accepted on both sides: `"2"` reads as `2.0.0` and `"4.1"` as `4.1.0`, so an app reporting version `"4.1"` matches `Property Is Semver Greater Than 4.0.18`. A leading `v` (`v2.0.0`) is not valid. If either value fails to parse, the rule does not match.

JSON config operator names: `PROP_SEMVER_LESS_THAN`, `PROP_SEMVER_EQUAL`, `PROP_SEMVER_GREATER_THAN`.

| Name          | Function                 | Example usage                                                              | Notes |
|---------------|--------------------------|----------------------------------------------------------------------------|-------|
| `Property Is Semver Less Than` | Use `Property Is Semver Less Than` to target an attribute referring to a software version | If you set `Criteria Property` to `sdk.version` and `Criteria Value` to `2.0.0`, then the rule will match versions less than `2.0.0` (e.g. `1.9.9`, `2.0.0-rc.1`) | See note below on SDK version requirements for new rule operators |
| `Property Is Semver Equal To` | Use `Property Is Semver Equal To` to target an attribute referring to a software version | If you set `Criteria Property` to `sdk.version` and `Criteria Value` to `2.0.0`, then the rule will match versions equal to `2.0.0` | See note below on SDK version requirements for new rule operators |
| `Property Is Semver Greater Than` | Use `Property Is Semver Greater Than` to target an attribute referring to a software version | If you set `Criteria Property` to `sdk.version` and `Criteria Value` to `2.0.0`, then the rule will match versions greater than `2.0.0` (e.g. `2.0.1`, `2.1.0`) | See note below on SDK version requirements for new rule operators |


### Integer Range Rule

`IN_INT_RANGE` matches a numeric context value inside a half-open range
`[start, end)`: `start` is inclusive and `end` is exclusive. The criteria value
is an object with `start`, `end`, or both, such as `{"start": 18, "end": 65}`
(matches 18 through 64). A missing `start` has no lower bound and a missing
`end` has no upper bound. `qfg verify` rejects other shapes, such as
`{"min": ..., "max": ...}`.

### Presence Rules

Presence rules check whether a property is **set** on the evaluation context, regardless of its type or value. They take only a property name — no `Criteria Value`. A property counts as **present** when the dotted path resolves and the value is not `null`/`undefined`. Empty string `""`, `0`, and `false` are intentionally considered present (the question is "is the field set", not "is it truthy"). Missing intermediate keys in dotted paths count as not present.

JSON config operator names: `IS_PRESENT`, `IS_NOT_PRESENT`.

| Name          | Function                 | Example usage                                                              | Notes |
|---------------|--------------------------|----------------------------------------------------------------------------|-------|
| `Property Is Present` | Match when the property is set on the context | If you set `Criteria Property` to `user.id`, the rule matches any user whose context has a non-null `user.id` (including empty string or `0`) and skips users where `user.id` was never sent | See note below on SDK version requirements for new rule operators |
| `Property Is Not Present` | Match when the property is missing or null on the context | If you set `Criteria Property` to `organization.domain`, the rule matches contexts that did not include `organization.domain` (or sent it as `null`); useful for "fall through" defaults for anonymous or partial contexts | See note below on SDK version requirements for new rule operators |


## How values are compared

Every Quonfig SDK compares context values the same way, so a rule matches the
same users whichever SDK evaluates it:

- **String rules on non-string values.** `Property Is One Of`, starts with,
  ends with, contains and hierarchical match compare a non-string context value
  by its text form. A boolean compares as `"true"` or `"false"`, so
  `Property Is One Of true` matches a context `beta: true`. A whole number
  compares as plain digits whatever its type, so `1234567.0` compares as
  `"1234567"` and never as `"1.234567e+06"` or `"1234567.0"`. Other numbers use
  their shortest decimal form (`1.5`). Lists compare each element.
  Comparisons are case-sensitive.
- **Numeric rules** need a numeric context value. A string such as `"100"`
  does not match `Property Is Greater Than`.
- **Dates** use the timestamp forms listed under [Date Rules](#date-rules), on
  both the context and the criteria side.
- **Semantic versions** use SemVer 2.0 precedence and accept `x` and `x.y`
  abbreviations, as described under
  [Semantic Version Rules](#semantic-version-rules).
- **Integer ranges** are `[start, end)`, as described under
  [Integer Range Rule](#integer-range-rule).
- **Negated rules** (`Is Not One Of`, `Does Not Start With`, and so on) match
  a context that does not have the property at all.

## SDK Compatibility

The JavaScript, React, React Native and Swift SDKs evaluate rules on Quonfig's
servers, so these rules need no upgrade of those SDKs.

Backend SDKs evaluate rules in your process. These versions are the first to
follow every rule above. Older versions can differ on date formats,
abbreviated versions, booleans and whole-number floats in string rules, and
integer ranges:

| Language | Package                     | Minimum version |
| -------- | --------------------------- | --------------- |
| Go       | `github.com/quonfig/sdk-go` | 1.7.0           |
| Node     | `@quonfig/node`             | 1.7.0           |
| Python   | `quonfig` (PyPI)            | 1.8.0           |
| Ruby     | `quonfig` (RubyGems)        | 1.8.0           |
| Java     | `com.quonfig:sdk-java`      | 1.7.0           |
| .NET     | `Quonfig.Sdk`               | 1.7.0           |
