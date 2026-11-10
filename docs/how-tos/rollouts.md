---
title: Percentage Rollouts
sidebar_label: Rollouts
description: Roll a flag out to a percentage of traffic, and choose whether each user, account or request keeps its result.
---

You've built something new and want to turn it on for a slice of traffic
first: 5%, then 25%, then everyone. In Quonfig that's a **percentage
rollout**: a flag whose value is a weighted split such as `true` 10% /
`false` 90%.

The percentage lives in Quonfig, not in your code. Your code only checks the
flag, and you change the percentage without a deploy.

## 1. Set the percentage

From the CLI:

```bash
qfg set-rollout new-checkout --environment production --true-percent 10
```

Or in the app, open the flag, pick the environment, and set the rule's value
to a percentage split. Drag the slider to 10%.

For flags with more than two values (an A/B/C test, say), use weights:

```bash
qfg set-rollout checkout-button-color --environment production --weights "red:34,green:33,blue:33"
```

## 2. Check the flag in code

This is a normal flag check. The context you pass is what makes the
rollout sticky (see the next section).

<Tabs groupId="lang">
<TabItem value="node" label="Node">

```javascript
if (quonfig.isEnabled("new-checkout", { user: { key: user.id } })) {
  return newCheckout();
}
```

</TabItem>
<TabItem value="go" label="Go">

```go
ctx := quonfig.NewContextSet().
    WithNamedContextValues("user", map[string]interface{}{"key": user.ID})

if enabled, _ := sdk.FeatureIsOn("new-checkout", ctx); enabled {
    return newCheckout()
}
```

</TabItem>
<TabItem value="python" label="Python">

```python
if client.is_feature_enabled("new-checkout", contexts={"user": {"key": user.id}}):
    return new_checkout()
```

</TabItem>
<TabItem value="ruby" label="Ruby">

```ruby
if Quonfig.enabled?("new-checkout", { user: { key: user.id } })
  new_checkout
end
```

</TabItem>
</Tabs>

If you already set context per request (the usual setup, see
[Context](/docs/explanations/concepts/context)), you don't need to pass it
here.

## 3. Choose the sticky property

Every percentage split has a **sticky property**. It decides how each
evaluation picks a side. In the app it's the **Sticky property** field next
to the slider. In the CLI it's `--hash-by`. The default is `user.key`.

Quonfig hashes the flag key plus the value of that property, so the same
value always lands on the same side. You have three choices:

| Sticky property | What happens | Use it for |
|---|---|---|
| `user.key` (default) | Each user always gets the same answer | Product features, A/B tests |
| Another property, such as `organization.key`, `device.id` or a cookie `visitor.id` | Everyone with the same value gets the same answer, so a whole account flips together | Account-level rollouts, logged-out traffic |
| Blank | A new random pick on **every evaluation** | Moving load to a new pipeline or backend, sampling, shadow traffic |

**Sticky to the user.** The usual choice. A user who gets the new checkout
keeps getting it on every request and every server, so their experience
doesn't flicker.

**Sticky to something else.** Bucket on whatever unit should move together.
For a B2B feature, `organization.key` keeps teammates on the same side. For
anonymous visitors, put an id from a cookie in context and bucket on it:

```javascript
quonfig.isEnabled("new-landing-page", { visitor: { id: cookies.visitorId } });
```

The sticky property doesn't have to be a `key`. A non-key property such as
`visitor.id` isn't recorded or billed as a tracked context (see
[percentage rollouts without a key](/docs/explanations/concepts/context#percentage-rollouts-without-a-key)).

**Not sticky.** Clear the sticky property and each evaluation rolls the dice
again, using your weights. With a 10% rollout, about 10% of calls return
`true`, spread across all requests, users and servers. You don't need any
context for this, and you don't need to generate your own random number.
This is the right setting when the unit is the request, not the person: "send
10% of jobs through the new pipeline."

## Watch out: a missing sticky property is not random

If the sticky property is set but the context doesn't include it, Quonfig
doesn't pick randomly. It hashes an empty value, so **every** context
without the property lands on the same side. That's usually all `true` or
all `false` for that traffic.

For example, the sticky property is `user.key`, and a background job checks
the flag with no user in context. Every job gets the same answer.

When this happens the SDK logs one warning per flag, and the evaluation
details include `hashPropertyMissing: true`. Two fixes:

- Pass the property: add the user, org or visitor to context.
- Change the sticky property to something the caller has, or clear it if
  you want a random pick per call.

## Dialing up

Raise the percentage in steps: 1% → 10% → 50% → 100%. On a two-way split,
users who already get `true` keep getting `true` as the percentage goes up.
Only new users join. Lowering it removes the most recently added users first.

Don't change the sticky property mid-rollout. It reshuffles everyone. If
you set a custom sticky property with `qfg set-rollout --hash-by`, pass the
same `--hash-by` on every step. Without it, the command writes the default
`user.key`.

A rollout sits underneath your targeting rules. If a rule above it says
"internal users get `true`", internal users keep `true` whatever the
percentage. `qfg set-rollout` keeps those rules, and `--replace-targeting`
removes them so everyone goes through the split. See
[`set-rollout`](/docs/tools/cli#set-rollout).

When you reach 100% and it's been stable, make `true` the default with
`qfg set-default`, then remove the flag check from your code.

## Related

- [Rules and segmentation](/docs/explanations/features/rules-and-segmentation)
- [Running an experiment](/docs/how-tos/experiment)
- [Feature flag or config?](/docs/how-tos/flag-or-config)
