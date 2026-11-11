---
title: Rules and Segmentation
sidebar_label: Rules and Segmentation
sidebar_position: 3
---

Quonfig provides powerful rules that you can compose to target exactly the users you're interested in.

Segments are reusable sets of rules that you can use across your flags and configs. See [Segment Rules](#segment-rules).

:::tip
Rules are evaluated in order. You can drag and drop rules to rearrange them. The first matching rule determines which variant is served.
:::

When a rule matches, you can either:

- Return a specific variant (e.g. `true`, `false`, or `yellow`)
- Return a variant based on a percentage (e.g. `true` 10% of the time and `false` 90% of the time)

A percentage split is sticky to its **sticky property** (usually `user.key`): Quonfig hashes the flag key plus that property's value, so a user keeps the same variant until the value or the percentages change. If you leave the sticky property blank, each evaluation picks a variant at random. See [Rollouts](../../how-tos/rollouts.md#3-choose-the-sticky-property).

## Available Rules

Each criterion in a rule has three parts in the rules editor: a property (such as `user.email`), an operator, and the value or values to match. The **Operator** column below shows the label the editor uses, and the **JSON operator** column shows the name stored in the config's JSON.

### String Rules

| Operator | JSON operator | Example usage | Notes |
|---|---|---|---|
| `is one of` | `PROP_IS_ONE_OF` | Property `user.subscription`, values `pro`, `advanced`: matches users with a `pro` or `advanced` subscription. | |
| `is not one of` | `PROP_IS_NOT_ONE_OF` | Property `user.subscription`, values `pro`, `advanced`: matches users who have neither a `pro` nor an `advanced` subscription. | |
| `ends with one of` | `PROP_ENDS_WITH_ONE_OF` | Property `user.email`, value `@example.com`: matches users whose email ends with `@example.com`. | |
| `does not end with one of` | `PROP_DOES_NOT_END_WITH_ONE_OF` | Property `user.email`, values `@gmail.com`, `@yahoo.com`: matches users whose email ends with neither. | |
| `starts with one of` | `PROP_STARTS_WITH_ONE_OF` | Property `user.country`, value `US-`: matches `US-CA`, `US-NY`, and so on. | |
| `does not start with one of` | `PROP_DOES_NOT_START_WITH_ONE_OF` | Property `user.country`, value `US-`: matches users whose country doesn't start with `US-`. | |
| `contains one of` | `PROP_CONTAINS_ONE_OF` | Property `user.email`, value `+test`: matches `jane+test@example.com`. | |
| `does not contain one of` | `PROP_DOES_NOT_CONTAIN_ONE_OF` | Property `user.email`, value `+test`: matches emails without `+test`. | |
| `matches regex` | `PROP_MATCHES` | Property `user.email`, value `^[a-z]+@example\.com$`: matches users with an email like `jane@example.com`. | Patterns must follow [Quonfig regex v1](#quonfig-regex-v1) |
| `does not match regex` | `PROP_DOES_NOT_MATCH` | Property `user.email`, value `^[a-z]+@example\.com$`: matches emails that aren't of that form. | Patterns must follow [Quonfig regex v1](#quonfig-regex-v1). A context without the property does not match. |

### Numeric Rules

| Operator | JSON operator | Example usage | Notes |
|---|---|---|---|
| `is greater than` | `PROP_GREATER_THAN` | Property `company.employees`, value `100`: matches companies with more than 100 employees. | |
| `is greater than or equal to` | `PROP_GREATER_THAN_OR_EQUAL` | Property `company.employees`, value `100`: matches companies with 100 or more employees. | |
| `is less than` | `PROP_LESS_THAN` | Property `company.employees`, value `100`: matches companies with fewer than 100 employees. | |
| `is less than or equal to` | `PROP_LESS_THAN_OR_EQUAL` | Property `company.employees`, value `100`: matches companies with 100 or fewer employees. | |


### Date Rules

Both the context value and the value you match against must be one of:

- a number: milliseconds since the Unix epoch (fractions are truncated)
- a string of digits: milliseconds since the Unix epoch, for example `"1735689600000"`
- an RFC 3339 / ISO 8601 timestamp with an uppercase `T` and a `Z` or numeric offset, for example `2025-01-01T00:00:00Z` or `2025-01-01T09:00:00+09:00` (fractional seconds allowed)

Anything else does not match: a date-only string (`"2025-01-01"`), a timestamp
with no offset (`"2025-01-01T00:00:00"`), or free-form text (`"Jan 1 2025"`).
In most languages, pass `Date.now()`, `date.getTime()` or an ISO string with
`Z` (for example JavaScript's `date.toISOString()`).

| Operator | JSON operator | Example usage |
|---|---|---|
| `is before` | `PROP_BEFORE` | Property `user.createdAt`, value `2025-01-01T00:00:00Z`: matches users created before Jan 1, 2025. |
| `is after` | `PROP_AFTER` | Property `user.createdAt`, value `2025-01-01T00:00:00Z`: matches users created after Jan 1, 2025. |


### Semantic Version Rules

Semver rules parse both the context value and the value you match against as [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) versions and compare them by SemVer precedence: a pre-release sorts before its release (`2.0.0-rc.1` < `2.0.0`), and build metadata (`+build.5`) is ignored.

Abbreviated versions are accepted on both sides: `"2"` reads as `2.0.0` and `"4.1"` as `4.1.0`, so an app reporting version `"4.1"` matches `is semver greater than 4.0.18`. A leading `v` (`v2.0.0`) is not valid. If either value fails to parse, the rule does not match.

| Operator | JSON operator | Example usage |
|---|---|---|
| `is semver less than` | `PROP_SEMVER_LESS_THAN` | Property `sdk.version`, value `2.0.0`: matches versions less than `2.0.0` (e.g. `1.9.9`, `2.0.0-rc.1`). |
| `is semver equal to` | `PROP_SEMVER_EQUAL` | Property `sdk.version`, value `2.0.0`: matches versions equal to `2.0.0`. |
| `is semver greater than` | `PROP_SEMVER_GREATER_THAN` | Property `sdk.version`, value `2.0.0`: matches versions greater than `2.0.0` (e.g. `2.0.1`, `2.1.0`). |


### Integer Range Rule

`IN_INT_RANGE` matches a numeric context value inside a half-open range
`[start, end)`: `start` is inclusive and `end` is exclusive. The value to
match is an object with `start`, `end`, or both, such as `{"start": 18, "end": 65}`
(matches 18 through 64). A missing `start` has no lower bound and a missing
`end` has no upper bound. `qfg verify` rejects other shapes, such as
`{"min": ..., "max": ...}`.

The rules editor's operator list doesn't offer this rule, so write it in the
config's JSON (for example in a cloned workspace, then `qfg push`). The
dashboard shows an existing one as `is in range`.

### Presence Rules

Presence rules check whether a property is **set** on the evaluation context, regardless of its type or value. They take only a property, with no value to match. A property counts as **present** when the dotted path resolves and the value is not `null`/`undefined`. Empty string `""`, `0`, and `false` are intentionally considered present (the question is "is the field set", not "is it truthy"). Missing intermediate keys in dotted paths count as not present.

| Operator | JSON operator | Example usage |
|---|---|---|
| `is present` | `IS_PRESENT` | Property `user.id`: matches any user whose context has a non-null `user.id` (including empty string or `0`) and skips users where `user.id` was never sent. |
| `is not present` | `IS_NOT_PRESENT` | Property `organization.domain`: matches contexts that did not include `organization.domain` (or sent it as `null`); useful for "fall through" defaults for anonymous or partial contexts. |

### Segment Rules

A segment is a named, reusable set of rules. To use one in a flag or config
rule, pick **segment** in the rule's property box, choose **is** or **is not**,
and pick the segment. The rule row then reads `segment is <segment key>`.

| In the editor | JSON operator | Matches when |
|---|---|---|
| `segment is <key>` | `IN_SEG` | The context matches the segment's rules. |
| `segment is not <key>` | `NOT_IN_SEG` | The context doesn't match the segment's rules. |

In JSON, a segment criterion has no `propertyName`, and its `valueToMatch` is a
string holding the segment key, for example
`{"operator": "IN_SEG", "valueToMatch": {"type": "string", "value": "beta-testers"}}`.

If the segment a rule names doesn't exist, `IN_SEG` doesn't match and
`NOT_IN_SEG` does. `qfg verify` rejects a rule that names a segment that
doesn't exist.


## Quonfig regex v1 {#quonfig-regex-v1}

`matches regex` and `does not match regex` (JSON config operator names
`PROP_MATCHES` and `PROP_DOES_NOT_MATCH`) take a regular expression as the
value to match. In JSON config that is
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

- **String rules on non-string values.** `is one of`, starts with, ends with
  and contains compare a non-string context value by its text form. A boolean
  compares as `"true"` or `"false"`, so `is one of true` matches a context `beta: true`. A whole number
  compares as plain digits whatever its type, so `1234567.0` compares as
  `"1234567"` and never as `"1.234567e+06"` or `"1234567.0"`. Other numbers use
  their shortest decimal form (`1.5`). Lists compare each element.
  Comparisons are case-sensitive.
- **Numeric rules** need a numeric context value. A string such as `"100"`
  does not match `is greater than`.
- **Dates** use the timestamp forms listed under [Date Rules](#date-rules), on
  both the context and the criteria side.
- **Semantic versions** use SemVer 2.0 precedence and accept `x` and `x.y`
  abbreviations, as described under
  [Semantic Version Rules](#semantic-version-rules).
- **Integer ranges** are `[start, end)`, as described under
  [Integer Range Rule](#integer-range-rule).
- **Negated rules** (`is not one of`, `does not start with one of`, and so on)
  match a context that does not have the property at all. `does not match regex`
  is the exception: it does not match a context without the property.
- **Regex rules** follow [Quonfig regex v1](#quonfig-regex-v1).

## SDK Compatibility

The JavaScript, React, React Native and Swift SDKs evaluate rules on Quonfig's
servers, so these rules need no upgrade of those SDKs.

Backend SDKs evaluate rules in your process. Every current major version
follows every rule above. Early releases could differ on date formats,
abbreviated versions, booleans and whole-number floats in string rules, and
integer ranges, so upgrade if you are pinned to an old version.
