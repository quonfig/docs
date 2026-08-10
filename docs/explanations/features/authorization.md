---
title: Authorization
sidebar_label: Authorization
sidebar_position: 4
---

Two properties drive authorization in Quonfig:

1. Every **environment** is either **protected** or not.
2. Every flag and config has an **access level** — `support`, `standard`, `protected-env`, or `protected-all-envs`.

Cross the two and you get a matrix of edit decisions. **Roles** are how you grant someone cells of that matrix: each role is a row. That is the whole model — the rest of this page is the matrix, plus a few footnotes.

## Environments: protected or not

Each environment carries a `protected` bit. Marking `production` protected is the typical move, but nothing is hard-coded: mark `prod-eu` or a compliance environment protected and every rule on this page treats it exactly the same way.

Marking an environment protected does **not** lock every config in it. It changes the verdict only where the matrix says it does — most visibly for `protected-env` configs, which lock in protected environments and stay open everywhere else.

## Configs: four access levels

Every flag and config carries an `access` field. Default if omitted: `standard`.

| `access` | Meaning | Typical use |
|----------|---------|-------------|
| `support` | Editable by the support team as well as engineers. | Account-level overrides, manual feature grants |
| `standard` | Editable by engineers, in any environment. | Most flags and configs |
| `protected-env` | Locked in every protected environment; open everywhere else. | "Engineers change it freely in dev and staging; only the inner circle changes it in production" |
| `protected-all-envs` | Locked down everywhere. | Pricing, billing, compliance-sensitive configs |

Hierarchy from lowest to highest: `support` < `standard` < `protected-env` < `protected-all-envs`.

## Roles

Three roles grant config editing. Each one is a row of the matrix below:

| Role | What it grants |
|------|----------------|
| Support | Edit `support` configs, in every environment. |
| Engineer | Edit `support` and `standard` configs everywhere, and `protected-env` configs in non-protected environments. |
| Protected Engineer | Edit everything, everywhere. |

Everyone also holds **Member**, the read-only floor: view workspaces, configs, and history. Roles are assigned at the organization scope and apply uniformly to every workspace in the org, and they combine — an Engineering Manager might hold Engineer plus [Admin](#members-and-admins), a senior IC Protected Engineer alone.

## The matrix

Columns are each access level crossed with **where your edit lands**: a non-protected environment, a protected environment, or the default value (what an environment serves when none of its own rules matched).

<div style={{overflowX: "auto", maxWidth: "100%", margin: "1.25rem 0"}}>

<svg viewBox="0 0 974 274" width="974" height="274" role="img" aria-label="Authorization matrix. Rows are the four roles: Member, Support, Engineer, and Protected Engineer. Columns are the four access levels — support, standard, protected-env, protected-all-envs — each crossed with three contexts: a non-protected environment, a protected environment, and the default value. Member has no edit access anywhere. Support edits support configs in all three contexts. Engineer edits support and standard configs in all three contexts, and protected-env configs only in non-protected environments, with a conditional verdict on the default value. Protected Engineer edits everything. Conditional means editable only while every protected environment ends in a catch-all rule." fontFamily="system-ui, -apple-system, sans-serif">
<text x="10" y="20" fontSize="15" fontWeight="700" fill="currentColor">Who can edit what</text>
<text x="10" y="37" fontSize="11.5" fill="currentColor" opacity="0.62">Access level across the top; where the edit lands underneath it. A cell is the verdict for an edit that touches only that section.</text>
<rect x="196" y="48" width="192" height="26" fill="currentColor" opacity="0.05"/>
<text x="292" y="66" fontSize="11.5" fontWeight="700" textAnchor="middle" fill="currentColor">Support</text>
<rect x="388" y="48" width="192" height="26" fill="currentColor" opacity="0.05"/>
<text x="484" y="66" fontSize="11.5" fontWeight="700" textAnchor="middle" fill="currentColor">Standard</text>
<rect x="580" y="48" width="192" height="26" fill="currentColor" opacity="0.05"/>
<text x="676" y="66" fontSize="11.5" fontWeight="700" textAnchor="middle" fill="currentColor">Protected-env</text>
<rect x="772" y="48" width="192" height="26" fill="currentColor" opacity="0.05"/>
<text x="868" y="66" fontSize="11.5" fontWeight="700" textAnchor="middle" fill="currentColor">Protected-all-envs</text>
<text x="228" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">non-protected</text>
<text x="228" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="292" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">protected</text>
<text x="292" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="356" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">default</text>
<text x="356" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">value</text>
<text x="420" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">non-protected</text>
<text x="420" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="484" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">protected</text>
<text x="484" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="548" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">default</text>
<text x="548" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">value</text>
<text x="612" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">non-protected</text>
<text x="612" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="676" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">protected</text>
<text x="676" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="740" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">default</text>
<text x="740" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">value</text>
<text x="804" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">non-protected</text>
<text x="804" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="868" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">protected</text>
<text x="868" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">environment</text>
<text x="932" y="86" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">default</text>
<text x="932" y="96" fontSize="8.6" textAnchor="middle" fill="currentColor" opacity="0.72">value</text>
<line x1="10" y1="102" x2="964" y2="102" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1"/>
<text x="16" y="123" fontSize="11.5" fontWeight="500" fill="currentColor">Member</text>
<rect x="223.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="228" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="287.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="292" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="351.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="356" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="415.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="420" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="479.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="484" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="543.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="548" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="607.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="612" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="671.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="676" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="735.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="740" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="799.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="804" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="863.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="868" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="927.4" y="110.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="932" y="130" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<line x1="10" y1="136" x2="964" y2="136" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1"/>
<text x="16" y="157" fontSize="11.5" fontWeight="500" fill="currentColor">Support</text>
<circle cx="228" cy="149" r="5" fill="#16a34a"/>
<text x="228" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="292" cy="149" r="5" fill="#16a34a"/>
<text x="292" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="356" cy="149" r="5" fill="#16a34a"/>
<text x="356" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<rect x="415.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="420" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="479.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="484" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="543.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="548" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="607.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="612" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="671.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="676" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="735.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="740" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="799.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="804" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="863.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="868" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="927.4" y="144.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="932" y="164" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<line x1="10" y1="170" x2="964" y2="170" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1"/>
<text x="16" y="191" fontSize="11.5" fontWeight="500" fill="currentColor">Engineer</text>
<circle cx="228" cy="183" r="5" fill="#16a34a"/>
<text x="228" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="292" cy="183" r="5" fill="#16a34a"/>
<text x="292" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="356" cy="183" r="5" fill="#16a34a"/>
<text x="356" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="420" cy="183" r="5" fill="#16a34a"/>
<text x="420" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="484" cy="183" r="5" fill="#16a34a"/>
<text x="484" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="548" cy="183" r="5" fill="#16a34a"/>
<text x="548" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="612" cy="183" r="5" fill="#16a34a"/>
<text x="612" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<rect x="671.4" y="178.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="676" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="714" y="173" width="52" height="27" rx="4" fill="#d97706" opacity="0.14"/>
<path d="M740 177.6 L745.2 187.4 L734.8 187.4 Z" fill="#d97706"/>
<text x="740" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">cond</text>
<rect x="799.4" y="178.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="804" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="863.4" y="178.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="868" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<rect x="927.4" y="178.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="932" y="198" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">lock</text>
<line x1="10" y1="204" x2="964" y2="204" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1"/>
<text x="16" y="225" fontSize="11.5" fontWeight="500" fill="currentColor">Protected Engineer</text>
<circle cx="228" cy="217" r="5" fill="#16a34a"/>
<text x="228" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="292" cy="217" r="5" fill="#16a34a"/>
<text x="292" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="356" cy="217" r="5" fill="#16a34a"/>
<text x="356" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="420" cy="217" r="5" fill="#16a34a"/>
<text x="420" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="484" cy="217" r="5" fill="#16a34a"/>
<text x="484" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="548" cy="217" r="5" fill="#16a34a"/>
<text x="548" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="612" cy="217" r="5" fill="#16a34a"/>
<text x="612" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="676" cy="217" r="5" fill="#16a34a"/>
<text x="676" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="740" cy="217" r="5" fill="#16a34a"/>
<text x="740" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="804" cy="217" r="5" fill="#16a34a"/>
<text x="804" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="868" cy="217" r="5" fill="#16a34a"/>
<text x="868" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<circle cx="932" cy="217" r="5" fill="#16a34a"/>
<text x="932" y="232" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">edit</text>
<line x1="10" y1="238" x2="964" y2="238" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1"/>
<line x1="196" y1="48" x2="196" y2="238" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1"/>
<line x1="388" y1="48" x2="388" y2="238" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1"/>
<line x1="580" y1="48" x2="580" y2="238" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1"/>
<line x1="772" y1="48" x2="772" y2="238" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1"/>
<circle cx="16" cy="256" r="5" fill="#16a34a"/>
<text x="27" y="260" fontSize="10" fill="currentColor" opacity="0.78">editable</text>
<path d="M88 250.6 L93.2 260.4 L82.8 260.4 Z" fill="#d97706"/>
<text x="99" y="260" fontSize="10" fill="currentColor" opacity="0.78">conditional — editable only while every protected environment ends in a catch-all rule</text>
<rect x="515.4" y="251.4" width="9.2" height="9.2" rx="1.4" fill="#dc2626"/>
<text x="531" y="260" fontSize="10" fill="currentColor" opacity="0.78">locked</text>
</svg>

</div>

<details>
<summary>The same matrix in text</summary>

Each cell reads *non-protected environment / protected environment / default value*:

| Role | `support` | `standard` | `protected-env` | `protected-all-envs` |
|------|-----------|------------|-----------------|----------------------|
| Member | lock / lock / lock | lock / lock / lock | lock / lock / lock | lock / lock / lock |
| Support | edit / edit / edit | lock / lock / lock | lock / lock / lock | lock / lock / lock |
| Engineer | edit / edit / edit | edit / edit / edit | edit / lock / cond | lock / lock / lock |
| Protected Engineer | edit / edit / edit | edit / edit / edit | edit / edit / edit | edit / edit / edit |

</details>

Three things to know when reading it:

- **A save is judged per section you touched.** Editing only your staging rules never asks for permission in a protected environment — the protected column applies only when your edit actually lands there.
- **Creating and deleting a config, and metadata changes** (name, description, tags, the `access` field) are not scoped to any environment — a new flag or a deletion changes what *every* environment serves — so they are judged at the strictest context. Nobody can lower a config's `access` in order to edit it.
- **The one `cond` cell** is the default value of a `protected-env` config. It moves as the config's own rules change:

<details>
<summary>When is a default value locked, and what to do about it</summary>

A config's default value is what an environment serves when none of that environment's own rules matched. Editing the default is therefore an edit to your protected environments — unless they can never fall through to it:

> The default value is **unreachable** — and unlocks — when every protected environment ends in a **terminal catch-all**: a rule with no criteria, or one whose criteria are all "always true". Then editing the default cannot change what those environments serve.

Concretely, with `production` marked protected:

```text
DEFAULT IS REACHABLE  ->  locked

  production:
    if plan is "pro"  -> on          (targeted; can fail to match)
                                     (no catch-all: falls through)
  default:
    always            -> off         <- production serves this

DEFAULT IS UNREACHABLE  ->  editable

  production:
    if plan is "pro"  -> on
    always            -> off         (terminal catch-all)
  default:
    always            -> off         <- production never reaches it
```

Reachability is computed on the **stored** document, not the one being written — so removing the protected environment's catch-all to unlock the default doesn't work: that removal is itself an edit to the protected environment, which is exactly what the fence denies.

If the editor tells you the default is locked, you have two ways forward:

- **Ask a Protected Engineer to add an explicit rule in the protected environment.** Once every protected environment ends in a rule that always matches, the default unlocks — permanently, until someone removes that rule.
- **Set the value in your own environment instead.** Usually what you actually wanted: an explicit rule in `staging` beats the default for staging traffic and leaves the protected environments alone.

</details>

## Additional roles: fencing people out of protected environments

The roles above lose access in a protected environment only where the config's access level says so — an Engineer still edits `standard` configs in production. Some teams also want the opposite: people who can work freely in staging and dev but can **never** touch a protected environment at all. Two opt-in roles do that.

<details>
<summary>Support and Engineer, non-protected environments only</summary>

| Role | Slug | What it grants | Where |
|------|------|----------------|-------|
| Support (non-protected envs) | `support_nonprotected` | Edit `support` configs | Non-protected environments only |
| Engineer (non-protected envs) | `engineer_nonprotected` | Edit `support`, `standard`, and `protected-env` configs | Non-protected environments only |

The fence is the environment's `protected` bit — the same bit used everywhere on this page, not a hard-coded "production". And unlike the unscoped roles, here it is absolute: a holder is locked out of a protected environment at **every** access level, including `support` and `standard`.

Their rows of the matrix (same cell format as above — *non-protected environment / protected environment / default value*):

| Role | `support` | `standard` | `protected-env` | `protected-all-envs` |
|------|-----------|------------|-----------------|----------------------|
| Support (non-protected envs) | edit / lock / cond | lock / lock / lock | lock / lock / lock | lock / lock / lock |
| Engineer (non-protected envs) | edit / lock / cond | edit / lock / cond | edit / lock / cond | lock / lock / lock |

`cond` is the same conditional default described [above](#the-matrix): editable only while every protected environment ends in a catch-all rule. If a holder finds the default locked, the two ways forward are the same too — an explicit rule in their own environment, or a Protected Engineer adds a catch-all in the protected one.

Beyond the environment fence, these roles are narrower in a second, independent way: a whole class of writes has no environment for the fence to open on, so it stays closed regardless of how your environments are configured:

- **Creating or deleting a config.** A new flag defines what every environment serves, including protected ones. Ask an engineer to create the skeleton, then edit it.
- **Metadata** — name, description, tags, the `access` field.
- **Segments, schemas, and restore-from-history** — whole-file writes with no environment to name.
- **SDK keys** — workspace plumbing, not a per-environment config edit.

One wire-level note: the conditional default exists only when saving a whole document (the editor's Save, `qfg push`). An env-targeted write — `PATCH /v1/flags/{key}/environments/{env}`, MCP `set_flag` — names a real environment and can never address the default value at all.

These two roles are **not self-serve** — they don't appear in your role picker until switched on for your organization. [Contact us](mailto:hello@quonfig.com) and we'll enable them; everything else on this page works out of the box.

</details>

## Members and admins

**Member** is the read-only floor everyone holds automatically: view workspaces, configs, and history.

**Admin** manages workspace plumbing — invites, role assignment, billing, environments, SDK keys, integrations. It grants **no** config editing and stacks with the roles above: an EM can manage the team without being able to edit pricing, and a senior IC can hold Protected Engineer without being on the hook for billing.

SDK-key management is the one place the axes meet: an Admin manages keys in any environment; otherwise the config role decides — Protected Engineer anywhere, Engineer in non-protected environments, Support not at all.

## Where authorization is enforced

Everything on this page is enforced in Quonfig's application layer, and every write path converges on it: the app UI, both CLI push engines (`qfg push` and `qfg migrate --push`), the public API, and MCP. The layer sits **between all of those and your workspace's git repo** — and your deployed SDKs receive only what's committed to that repo.

<div style={{overflowX: "auto", maxWidth: "100%", margin: "1.25rem 0"}}>

<svg viewBox="0 0 720 312" style={{width: "100%", height: "auto", minWidth: "620px"}} role="img" aria-label="Where authorization is enforced. Three writers on your machine — the app UI, qfg push from a local checkout, and the REST API or MCP — all converge on Quonfig's authorization layer, which checks role, access level, and environment before a write can commit to the workspace git repo. Denied writes stop at the layer and never reach the repo. Your deployed servers receive only what is committed. Local files are plain text; editing them enforces nothing until pushed." fontFamily="system-ui, -apple-system, sans-serif">
<defs>
<marker id="authz-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M0 0 L10 5 L0 10 Z" fill="currentColor" opacity="0.55"/>
</marker>
</defs>
<text x="95" y="28" fontSize="9" fontWeight="700" letterSpacing="1" textAnchor="middle" fill="currentColor" opacity="0.55">YOUR MACHINE</text>
<text x="380" y="28" fontSize="9" fontWeight="700" letterSpacing="1" textAnchor="middle" fill="currentColor" opacity="0.55">QUONFIG</text>
<text x="637" y="28" fontSize="9" fontWeight="700" letterSpacing="1" textAnchor="middle" fill="currentColor" opacity="0.55">YOUR INFRASTRUCTURE</text>
<rect x="15" y="38" width="160" height="230" rx="8" fill="currentColor" opacity="0.04"/>
<rect x="205" y="38" width="350" height="230" rx="8" fill="#6f63d6" opacity="0.06"/>
<rect x="570" y="38" width="135" height="230" rx="8" fill="currentColor" opacity="0.04"/>
<rect x="25" y="58" width="120" height="36" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.35"/>
<text x="85" y="80" fontSize="11" fontWeight="500" textAnchor="middle" fill="currentColor">App UI</text>
<rect x="25" y="110" width="120" height="48" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.35"/>
<text x="85" y="129" fontSize="11" fontWeight="500" textAnchor="middle" fill="currentColor">qfg push</text>
<text x="85" y="145" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.65">from a local checkout</text>
<rect x="25" y="176" width="120" height="36" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.35"/>
<text x="85" y="198" fontSize="11" fontWeight="500" textAnchor="middle" fill="currentColor">REST API / MCP</text>
<text x="85" y="240" fontSize="9" fontStyle="italic" textAnchor="middle" fill="currentColor" opacity="0.6">local files are plain text —</text>
<text x="85" y="252" fontSize="9" fontStyle="italic" textAnchor="middle" fill="currentColor" opacity="0.6">editing them enforces nothing</text>
<line x1="145" y1="76" x2="221" y2="136" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.3" markerEnd="url(#authz-ah)"/>
<line x1="145" y1="134" x2="221" y2="148" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.3" markerEnd="url(#authz-ah)"/>
<line x1="145" y1="194" x2="221" y2="160" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.3" markerEnd="url(#authz-ah)"/>
<rect x="225" y="104" width="140" height="92" rx="8" fill="#6f63d6" opacity="0.08"/>
<rect x="225" y="104" width="140" height="92" rx="8" fill="none" stroke="#6f63d6" strokeWidth="1.6"/>
<text x="295" y="132" fontSize="12" fontWeight="700" textAnchor="middle" fill="currentColor">Authorization</text>
<text x="295" y="150" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">role × access level</text>
<text x="295" y="163" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">× environment</text>
<text x="295" y="180" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.55">the matrix above</text>
<text x="295" y="220" fontSize="9.5" textAnchor="middle" fill="#dc2626">✗ denied writes stop here</text>
<text x="295" y="234" fontSize="9" textAnchor="middle" fill="#dc2626" opacity="0.8">and never reach the repo</text>
<line x1="365" y1="150" x2="403" y2="150" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.3" markerEnd="url(#authz-ah)"/>
<text x="384" y="142" fontSize="8" textAnchor="middle" fill="currentColor" opacity="0.6">commits</text>
<rect x="408" y="104" width="135" height="92" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.4"/>
<text x="475" y="132" fontSize="11" fontWeight="700" textAnchor="middle" fill="currentColor">Workspace git repo</text>
<text x="475" y="150" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">the stored truth —</text>
<text x="475" y="163" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">every change is a commit</text>
<line x1="543" y1="150" x2="584" y2="150" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.3" markerEnd="url(#authz-ah)"/>
<rect x="588" y="104" width="110" height="92" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.4"/>
<text x="643" y="128" fontSize="11" fontWeight="700" textAnchor="middle" fill="currentColor">Your servers</text>
<text x="643" y="146" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">SDKs receive only</text>
<text x="643" y="159" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">what's committed,</text>
<text x="643" y="172" fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">via SSE / HTTP</text>
<text x="15" y="296" fontSize="10" fill="currentColor" opacity="0.65">Every write path converges on the same authorization layer, before anything reaches the repo your SDKs consume.</text>
</svg>

</div>

This placement is what makes local editing harmless. A local checkout of your workspace is plain text — anyone can open the JSON in an editor and change anything, and nothing stops them, because nothing needs to: those edits change nothing until they're pushed, and the push lands in the authorization layer before it can touch the repo. Direct pushes to the underlying git repo bypass these tier checks; they're rare, bounded by repo-level access, and structurally validated, but per-file authorization at the git layer is not enforced today.
