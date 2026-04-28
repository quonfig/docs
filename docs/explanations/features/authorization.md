---
title: Authorization
sidebar_label: Authorization
sidebar_position: 4
---

Quonfig authorization has two independent axes:

1. **Config access** — which configs a user can edit, based on a tiered hierarchy.
2. **Admin** — whether a user can manage the workspace (members, billing, environments). Independent of config editing.

Roles and permissions are stored in WorkOS at the organization scope. A user's role applies uniformly to every workspace in that org.

## Roles

| Role | Slug | What it grants |
|------|------|----------------|
| Member | `member` | Default read-only floor. View workspaces, configs, and history. Auto-assigned by WorkOS. |
| Admin | `admin` | Manage members, billing, environments, SDK keys, and integrations. Does **not** grant config edit. |
| Support | `support` | Edit `support`-tier configs. |
| Engineer | `engineer` | Edit `support` and `standard`-tier configs. |
| Protected Engineer | `protected_engineer` | Edit `support`, `standard`, and `protected` configs (in any environment). |

Multi-role is on. Every user holds Member implicitly, plus zero or more of `{admin, support | engineer | protected_engineer}`. The config-tier roles and the admin role are orthogonal — an Engineering Manager might hold `engineer + admin`; a senior IC might hold `protected_engineer` alone.

## Config access tiers

Every config carries an `access` field that determines who can edit it and where. Default if omitted: `standard`.

| Config `access` | Required role | Behavior |
|-----------------|---------------|----------|
| `support` | Support or above | Editable by support team and engineers. Typical use: account-level overrides, manual feature grants. |
| `standard` | Engineer or above | Editable by engineers in any environment. Most feature flags and configs live here. |
| `protected-env` | Engineer in non-protected environments; Protected Engineer in protected environments (and on the default value) | Locked down in production (or any environment marked `protected`); open in dev/staging. |
| `protected-all-envs` | Protected Engineer | Locked down everywhere. Typical use: pricing, billing, compliance-sensitive configs. |

Hierarchy from lowest to highest: `support` < `standard` < `protected-env` < `protected-all-envs`.

A protected environment does **not** lock down all configs in that environment — it only gates configs whose `access` is `protected-env`. Standard configs remain editable by Engineers in production.

## How role and config tier compose

| Config `access` | Required permission |
|-----------------|---------------------|
| `support` | `config.edit.support` |
| `standard` | `config.edit.standard` |
| `protected-env` | `config.edit.protected` (when editing the protected env or the default value); otherwise `config.edit.standard` |
| `protected-all-envs` | `config.edit.protected` (always) |

WorkOS does not need separate roles for `protected-env` vs `protected-all-envs`. Both require `config.edit.protected`; Quonfig's app-layer check decides whether the specific edit is allowed in the target environment.

## Admin is orthogonal to config edit

Admin controls workspace plumbing — invites, role assignment, billing, environments, SDK keys, integrations. It grants **no** config edit permissions on its own. An Admin who needs to edit production-tier configs must also hold `protected_engineer`.

This separation lets an EM manage their team without being on the hook for editing pricing, and lets a senior engineer edit production configs without being on the hook for billing.

## Where authorization is enforced

All checks run in the application layer (the Node backend), against the user's WorkOS permissions claim. UI/oRPC writes, CLI `qfg push`, and any other write path go through the same `canEdit()` decision. Direct git pushes are rare and are bounded by repo-level access in Gitea plus structural validation in pre-receive hooks; per-file authorization at the git layer is not enforced today.
