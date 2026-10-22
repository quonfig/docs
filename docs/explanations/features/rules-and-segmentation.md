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
| `Property Matches` | Use `Property Matches` to target users with an attribute that matches a regular expression (Regex) | If you set `Criteria Property` to `email` and `Criteria Value` to `^[a-z]+@example\.com$`, then the rule will match users with an `email` like `jane@example.com` | Patterns must follow [Quonfig regex v1](#quonfig-regex-v1) |
| `Property Does Not Match` | Use `Property Does Not Match` to target users with an attribute that does not match a regular expression (Regex) || Patterns must follow [Quonfig regex v1](#quonfig-regex-v1). A context without the property does not match. |

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


## Quonfig regex v1 {#quonfig-regex-v1}

`Property Matches` and `Property Does Not Match` (JSON config operator names
`PROP_MATCHES` and `PROP_DOES_NOT_MATCH`) take a regular expression as their
`Criteria Value`. In JSON config that is
`"valueToMatch": {"type": "string", "value": "<pattern>"}`.

Each backend SDK runs the pattern with its own language's regex engine, and
those engines disagree on many constructs. A pattern that works in one SDK can
fail to compile in another, and then the rule never matches there. Quonfig
regex v1 is the part of regex syntax that every SDK reads the same way, plus a
few limits that keep matching fast. `qfg verify`, `qfg push`, the dashboard and
the API reject a pattern outside v1 when you save it, and their error messages
link to this section.

### How a pattern matches

- **Search, not full match.** A pattern matches if it matches anywhere in the
  value: `a+b+` matches `xaab`. To match the whole value, anchor it with `^`
  and `$`: `^[0-9]{3}$` matches `123`, but not `1234` or `12a`.
- **Case-sensitive.** `abc` does not match `ABC`. Write `[Aa]bc` to accept
  both.
- **String values only.** If the context value is not a string (for example
  the number `123`), both operators return false.
- **Missing property.** If the context does not have the property, both
  operators return false. This is unlike the other negated rules, which match a
  context without the property.
- **Invalid pattern.** If a stored pattern does not compile (for example `(`),
  both operators return false.

### Allowed

- Literal characters, `.`, `^` and `$`, and `|`.
- Groups: `( )` and `(?: )`.
- Quantifiers: `*`, `+`, `?`, `{n}`, `{n,}` and `{n,m}` with
  `n <= m <= 1000`. Each can be lazy: `*?`, `+?`, `??`, `{n,m}?`.
- Classes `[...]` and `[^...]` that hold literal characters, ranges such as
  `a-z`, and the escapes below. To put `[`, `]`, `-` or `\` in a class, escape
  it: `[\[\]\-\\]`.
- Escapes: `\` followed by ASCII punctuation (`\.`, `\*`, `\$`, `\/` and so
  on), `\t`, `\n`, `\r`, `\f`, and `\xHH` with exactly two hex digits.

### Not allowed, and what to write instead

| Construct | Example | Write instead |
| --------- | ------- | ------------- |
| Digit, word, space and boundary shorthands, and their negations | `\d`, `\w`, `\s`, `\b`, `\D`, `\W`, `\S`, `\B` | `[0-9]`, `[A-Za-z0-9_]`, `[ \t\r\n\f\x0B]`. There is no portable `\b`: match the separator itself, or anchor with `^` and `$`. |
| Lookahead and lookbehind | `foo(?=bar)`, `(?<!x)y` | Rewrite without them, or split the rule into two criteria. |
| Named groups | `(?<name>a)`, `(?P<name>a)` | A plain group `( )` or `(?: )`. |
| Inline flags | `(?i)abc`, `(?i:abc)` | Spell out both cases with a class: `[Hh]ello`. |
| Other `(?` groups | atomic `(?>a)`, comment `(?#note)`, conditional | Only `( )` and `(?: )` are supported. |
| Backreferences | `(a)\1`, `\k<name>` | Repeat the text explicitly. |
| Octal escapes and `\0` | `\012`, `\0` | `\xHH`, for example `\x00`. |
| Possessive quantifiers | `a++`, `a*+`, `a{2}+` | The plain form `a+` or the lazy form `a+?`. |
| Malformed repeats | `a{,3}`, `a{1001}`, `a{3,2}`, `x{foo}` | `{0,3}`; counts up to 1000; escape a literal brace as `\{`. |
| Class extensions | `[[:digit:]]`, `[a[b]]`, `[a&&b]`, `[a--b]`, `[]a]` | Literals and ranges only. Escape a literal `[` or `]`, and do not start a class with `]`. |
| Other escapes | `\A`, `\z`, `\Z`, `\G`, `\Q..\E`, `\p{L}`, `\uHHHH`, `\x{41}`, `\h`, `\R`, `\X`, `\K`, `\a`, `\e`, `\cA` | `^` and `$` for anchors; `\xHH` or the character itself. |

A pattern that is not a valid regular expression at all, such as `(abc`,
`[z-a]` or `*a`, is rejected too. A quantifier needs something to repeat, so it
cannot follow `^`, `$`, `|`, `(` or another quantifier.

### Safety limits

Some patterns take exponential time on certain inputs in the SDKs whose
engines backtrack. v1 rejects the shapes that cause it:

- **No quantified group that contains a quantifier or `|`.** `(a+)+`,
  `(a|b)*`, `(ab?)*` and `([0-9]{3})+` are rejected. Quantify the inner part
  only, or use a class: `[ab]*` instead of `(a|b)*`. A group holding `|` is
  fine when the group itself is not quantified: `^(foo|bar)$`.
- **At most 2 unbounded quantifiers** (`*`, `+`, `{n,}`, lazy forms included)
  per pattern. `.*foo.*` is fine; `.*.*.*` and `a+b+c+` are rejected. Bound the
  extra ones with `{n,m}`, or split the rule into two criteria.
- **At most 256 characters** per pattern.
- **Repeat counts at most 1000**, as in `{0,1000}`.

### Not portable: avoid these

Three constructs are still under review and are not read the same way by every
SDK. Avoid them so your rule behaves the same everywhere:

- `\_`: write `_` unescaped.
- `\v`: write `\x0B`.
- `\x80` to `\xFF`: write the character itself.

### Outside the contract

A write-time check cannot remove two differences, because they depend on the
context value rather than the pattern. Quonfig does not guarantee the same
result across SDKs for:

- **Values that contain a newline.** In some SDKs `^` and `$` also match at
  line breaks, or `$` matches before a trailing newline. Keep newlines out of
  values you match with a regex.
- **Characters outside the Basic Multilingual Plane, such as emoji.** The
  Node SDK counts one of them as two characters, so `^.$` does not match `😀`
  in Node and does match it elsewhere.

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
  a context that does not have the property at all. `Property Does Not Match`
  is the exception: it does not match a context without the property.
- **Regex rules** follow [Quonfig regex v1](#quonfig-regex-v1).

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
