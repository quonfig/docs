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

Note: Date context values can be specified as milliseconds since epoch or RFC3339 formatted strings

| Name          | Function                 | Example usage                                                              | Notes |
|---------------|--------------------------|----------------------------------------------------------------------------|-------|
| `Property Is Before` | Use `Property Is Before` to target with a date attribute before than a threshold | If you set `Criteria Property` to `user.createdAt` and `Criteria Value` to '2025-01-01T00:00:00Z', then the rule will match users created before Jan 1, 2025.  | See note below on SDK version requirements for new rule operators |
| `Property Is After` | Use `Property Is After` to target with a date attribute after a threshold | If you set `Criteria Property` to `user.createdAt` and `Criteria Value` to '2025-01-01T00:00:00Z', then the rule will match users created after Jan 1, 2025.  | See note below on SDK version requirements for new rule operators |


### Semantic Version Rules

| Name          | Function                 | Example usage                                                              | Notes |
|---------------|--------------------------|----------------------------------------------------------------------------|-------|
| `Property Is Semver Less Than` | Use `Property Is Semver Less Than` to target an attribute referring to a software version | If you set `Criteria Property` to `sdk.version` and `Criteria Value` to '2.0.0', then the rule will match versions less than `2.0.0` | See note below on SDK version requirements for new rule operators |
| `Property Is Semver Equal To` | Use `Property Is Semver Equal To` to target an attribute referring to a software version | If you set `Criteria Property` to `sdk.version` and `Criteria Value` to '2.0.0', then the rule will match versions equal to than `2.0.0` | See note below on SDK version requirements for new rule operators |
| `Property Is Semver Greater To` | Use `Property Is Semver Greater Than` to target an attribute referring to a software version | If you set `Criteria Property` to `sdk.version` and `Criteria Value` to '2.0.0', then the rule will match versions greater than `2.0.0` | See note below on SDK version requirements for new rule operators |


## SDK Compatibility

The Quonfig-js and Quonfig-react SDKs evaluate rules remotely so any version will support the operaters with SDK Version requirements.

For in-process evaluation of the newer rules marked above these are the minimum versions

| Language | Version |
|----------| --------|
| Go | 0.2.1 |
| Java | 0.3.25 |
| Node | 0.4.8 |
| Python | 0.12.0 |
| Ruby | 1.8.9 |


