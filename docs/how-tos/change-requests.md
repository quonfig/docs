---
title: Propose a Change for Review
sidebar_label: Change Requests
description: Propose a flag or config change from the app, the CLI or an agent. Nothing goes live until someone with rights merges it.
---

A **change request** lets you propose a flag or config change without making it
live. Someone who could make the same change directly reviews it and merges it.
Only then does it reach your SDKs.

Use it when:

- your role cannot change a protected environment, and someone else has to
  approve the change;
- you want a second person to look at a change before it ships;
- a coding agent makes the change and a person should decide whether it goes
  live.

There are four ways to open one. Use the first that fits:

| Where you are | How |
|---|---|
| In the Quonfig app | [Propose from the editor](#from-the-app) |
| In a terminal, no clone | [Add `--propose` to a write command](#from-the-cli-without-a-clone) |
| In an agent session | [The `propose_change_request` MCP tool](#from-an-agent) |
| In a clone of the workspace repo | [Push a branch with `qfg push --propose`](#from-a-clone) |

## From the app {#from-the-app}

1. Open the flag or config and make your edit.
2. Propose it:
   - If your role cannot save the change, the button reads **Propose change**.
   - If your role can save it, open the menu next to **Save** and choose
     **Propose change instead**.
3. In the dialog, check the title. It starts as a one-line summary of your
   edit, and you can change it. Add a description if the reviewer needs the
   reason. Under the fields, the dialog shows the change as the reviewer will
   see it.
4. Choose **Propose change**.

The app opens the new change request. Nothing is live yet. The page says who can
merge it. If you cannot merge it yourself, use **Copy link** and send the link
to someone who can.

To find it again:

- **Change Requests** in the sidebar lists every request. The number next to it
  is how many are open.
- The dashboard lists the requests that wait for review.
- The flag or config page shows a banner while an open request touches it.

One request from the editor holds the changes of one flag or config. To change
several items in one request, use the CLI or a clone.

## From the CLI without a clone {#from-the-cli-without-a-clone}

Add `--propose` to a write command. The command builds the same change that it
would write live and opens a change request with it:

```bash
qfg set-default checkout.new-flow --environment production --value true --propose
```

```text
✓ Opened change request #7.
  https://app.quonfig.com/workspaces/<workspace-id>/change-requests/7
NOT LIVE
Check on it: qfg cr show 7 / Wait: qfg cr wait 7
```

`--propose` works on `qfg create`, `qfg set-default`, `qfg set-rollout`,
`qfg log-level` and `qfg delete`. It needs no `--confirm`, because nothing goes
live. `--title` and `--description` are optional. Without a title, the request
gets a one-line summary of the change.

To add another change to a request you opened, use `--cr <number>` in place of
`--propose`:

```bash
qfg set-default checkout.new-flow --environment staging --value true --cr 7
```

```text
✓ Added to change request #7.
```

Only the proposer can add to a request. `--cr` takes no `--title` or
`--description`: the request keeps its own.

When a live write is refused because your role does not allow it, the error
prints the same command with `--propose` added.

## From an agent {#from-an-agent}

An agent that uses the [Quonfig MCP server](../api/mcp-server.md) calls
`propose_change_request`. It can propose even when its role cannot write.
There is no merge tool: a person merges the request in the app or with
`qfg cr merge`.

## From a clone {#from-a-clone}

Use a clone when you want to edit the JSON files directly or put many changes
in one request. Make the clone with [`qfg pull`](../tools/cli.md#pull). Your CLI
needs `qfg push --propose` (`qfg push --help` lists it). An older CLI prints
`Nonexistent flag: --propose`; upgrade with
`npm install -g @quonfig/cli@latest`.

### 1. Make the change on a branch

```bash
qfg pull --dir ./my-config
git -C ./my-config switch -c turn-on-checkout
```

Edit the JSON files, or use any `qfg` command that edits the local files. Then
check and commit:

```bash
qfg verify ./my-config
git -C ./my-config commit -am "Turn on checkout for beta"
```

### 2. Propose it

```bash
qfg push --dir ./my-config --propose --title "Turn on checkout for beta"
```

After the usual line about the pushed commits, you see:

```text
Proposed change request #7 from branch turn-on-checkout.
  https://app.quonfig.com/workspaces/<workspace-id>/change-requests/7
NOT LIVE
It goes live only when someone with rights merges it. Check on it: qfg cr show 7
```

`--title` and `--description` are optional. Without a title, the change request
uses the commit message when the branch has one commit, and the branch name
when it has more.

`qfg push --propose` does not ask for confirmation, because nothing goes live.

#### What "not live" means

- `main` does not change. Your SDKs keep serving the values they served before.
- If the workspace has Slack connected, Slack posts that the request was
  opened, with the words NOT LIVE and a link. Slack posts the change itself
  only after the merge.
- The change exists only on the branch and as change request #7, until someone
  merges it or it is closed.

Do not tell anyone a flag "is on" because a change request is open. After it is
merged, check the value with `qfg info <key>`.

#### Add more commits

All the commits on the branch are one change request. To change it, commit on
the same branch and push again:

```bash
git -C ./my-config commit -am "Also turn it on in staging"
qfg push --dir ./my-config
```

```text
Updated change request #7 with this push.
  https://app.quonfig.com/workspaces/<workspace-id>/change-requests/7
NOT LIVE
It goes live only when someone with rights merges it. Check on it: qfg cr show 7
```

Only the person who proposed a change request can push to its branch. Anyone
else is refused and told to push their commits to a new branch and propose
their own.

#### If you committed on `main` by mistake

`qfg push --propose` refuses to run on `main`, because commits pushed to `main`
go live. It prints the commands that move your commits to a branch:

```text
--propose needs a branch: commits on main go live when pushed.
Move your 1 unpushed commit(s) to a branch (this CLI will not move your branches for you):
  git switch -c <branch-name>
  git branch -f main origin/main
Then run: qfg push --propose
```

#### If a push to `main` is refused

When your role does not allow a change and you push it to `main` from a clone
with plain `qfg push`, the refusal ends with:

```text
You can propose this change instead; someone with rights merges it:
  git switch -c <branch-name>
  git branch -f main origin/main
  qfg push --propose
```

Run those three commands to propose the same commits.

## 3. Review it

Anyone in the workspace can propose, including read-only members and agents.
To see what is waiting:

```bash
qfg cr list
```

```text
#7  open  turn-on-checkout  Ana Lee  2026-11-13  Turn on checkout for beta
```

`--mine` lists only your own, `--status merged|closed|all` lists others, and
`--limit` caps the rows.

To read one, use its number or its branch name:

```bash
qfg cr show 7
```

```text
Changes against main (what a merge would land):
  M feature-flags/checkout.new-flow.json
    -   "value": false
    +   "value": true
  1 file(s): 1 modified, 0 added, 0 deleted

Change request #7 [open]
Title (as written by the proposer): Turn on checkout for beta
Branch: turn-on-checkout (head 3f2a9c1, base 8d04e7b)
Proposed by Ana Lee via cli
Mergeable: yes
You can merge: yes
You can close: yes
https://app.quonfig.com/workspaces/<workspace-id>/change-requests/7
```

The diff comes first because it is what lands. The title and description are
the proposer's own words; Quonfig does not check them. Judge the change by the
diff. If a change touches a segment, `qfg cr show` says so: a segment can change
what a protected flag serves.

### The review page in the app

The link that a propose command prints opens the change request in the Quonfig
app. The page shows what merging would change now, file by file, in plain words,
with a **Raw diff** tab for the JSON. Below the changes are the
**Merge and go live** button and the **Close without merging** button.

- The change goes live as soon as you merge. If the request touches a protected
  environment, the app asks you to confirm first.
- If you cannot merge, the page says why and shows **Copy link** in place of
  the merge button.
- A closed request cannot be reopened. Propose a new one.

All the change requests of a workspace are listed under **Change Requests** in
the sidebar.

## 4. Who can merge

A change request can be merged by anyone whose role could make the same change
directly. Quonfig checks each changed file against `main` as it is at merge
time: the merger's current permissions and the current protection of each
environment. Your existing roles are the policy; there is no separate approval
setting.

The proposer can merge their own change request if their role allows the
change. The merge is then recorded as self-merged.

`qfg cr show` tells you whether you can merge. When you cannot, it names the
permission and file, for example
`You can merge: no (Requires: <permission> on <file>)`.

## 5. Merge it

```bash
qfg cr merge 7
```

The CLI shows the change request and its diff, then asks:

```text
Merge change request #7 into main? It goes live. [y/N]
```

Answer `y`:

```text
Merged change request #7 into main as 20f4c67. It is live.
```

`--yes` skips the question. Without a terminal, `qfg cr merge` refuses to run
unless you pass `--yes`.

What happens when you merge:

- The change lands on `main` as one new commit. Its author is the proposer and
  its committer is the person who merged. The commit message records the change
  request number.
- Your SDKs receive the change, as with any other change to `main`.
- The branch is deleted on the server.

The merge goes ahead only if the branch still points at the commit you were
shown. If the proposer pushed again in the meantime, nothing is merged:

```text
Change request #7 changed since you viewed it (head 3f2a9c1 -> 75024ab). Nothing merged. Run qfg cr show 7 and merge again.
```

After a merge, update your local copy:

```bash
git -C ./my-config switch main
qfg pull --dir ./my-config
```

**Agents:** an agent never merges a change request it did not author unless a
person tells it to merge that one. See [Agent skill](../tools/agent-skill.md).

## 6. Conflicts and how to fix them

If someone changed a file on `main` that your change request also changes, the
merge is blocked. Quonfig never merges two changes inside one file.
`qfg cr show` lists each file:

```text
Conflicts with main: feature-flags/checkout.new-flow.json (changed in 9b1e2d4)
Mergeable: no (conflict)
```

The review page says "Main changed a file this request also changes. Merge main
into the branch, then push again."

To fix it, the proposer merges `main` into the branch and pushes again:

```bash
git -C ./my-config switch turn-on-checkout
git -C ./my-config fetch origin
git -C ./my-config merge origin/main
# if git reports a conflict: edit the file, keep both changes where they belong, then
git -C ./my-config add -A
git -C ./my-config commit
qfg verify ./my-config
qfg push --dir ./my-config
```

The push updates the same change request. Rewriting the branch (a rebase or a
force push) is not supported; merge `main` in instead.

## 7. Close it without merging

```bash
qfg cr close 7 --note "superseded by #8"
```

```text
Closed change request #7.
Its branch was deleted on the server.
```

Nothing goes live. The proposer can always close their own change request.
Anyone else needs the permissions that merging it would need. The branch is
deleted on the server if it still points at the proposed commit.

## Limits and errors

- **50 open change requests per workspace.** The 51st is refused with
  `Change request limit reached: this workspace has 50 open change requests, the limit. Merge or close one (qfg cr list), then retry.`
- **`Branch <name> was pushed, but the server did not open a change request`**:
  the server is older than your CLI. Nothing is proposed and nothing went live.
- Every command takes `--json` for scripts and `-w <org>/<workspace>` to name
  the workspace.

The full flag list is in the [CLI reference](../tools/cli.md#propose).
