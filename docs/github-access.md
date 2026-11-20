# GitHub repository access control (MELUNE)

This repository is **Private** by design. This document explains how access is
granted, what each role can do, and the honest limits of "view but don't copy".

---

## Roles

| Role | Browse code | Clone | Push | Fork (private repo) | Change settings | Invite others |
| --- | --- | --- | --- | --- | --- | --- |
| **Read** (`pull`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Triage | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Write (`push`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Maintain | ✅ | ✅ | ✅ | ❌ | ⚠️ limited | ❌ |
| Admin | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

For "people can see the whole project but cannot copy it into their own account",
grant the **Read** role. This is the strongest view-only control GitHub offers.

---

## Granting read-only access

Use the repository's helper script:

```bash
# invite one or more users (read-only)
./scripts/github/grant-read-access.sh alice bob

# list current collaborators and permissions
./scripts/github/grant-read-access.sh --list

# remove someone's access
./scripts/github/grant-read-access.sh --remove alice

# invite a whole team (org repositories)
./scripts/github/grant-read-access.sh --team designers
```

Prerequisites:

- GitHub CLI (`gh`) authenticated with `repo` scope
- You must be an **Admin** of the repository
- Usernames must be exact (case-insensitive) GitHub logins

Alternatively, in the GitHub web UI:
**Settings → Collaborators → Add people → choose role `Read` → Send invitation**.

---

## The honest limitation about copying

**You cannot technically prevent a viewer from copying source code.**

Here is why:

- A web browser downloads HTML/CSS/JS to render it — anything the browser can
  show, the user can save, screenshot or `curl`.
- A collaborator with read access must be able to `git clone` to browse offline,
  and a clone is a complete local copy of the entire repository.
- Even without GitHub, a person can manually retype what they see.

GitHub has **no "view but don't copy" mode**. Anyone who can see source can copy
it. What you *can* control:

| Goal | How |
| --- | --- |
| They can read, but cannot modify or delete anything | Read-only role ✅ |
| They cannot fork it into their own GitHub account | Private repo + Read role ✅ |
| They cannot redistribute via GitHub | Private repo ✅ |
| They cannot make a local copy at all | ❌ Impossible if they can see the code |

If you truly need "see the app, never see the source", the only solution is to
**deploy a live demo** and share its URL, keeping the repository private. That
requires a host (Oracle Cloud Free, a VPS, or GitHub Pages for docs). See
[deploy-oracle-cloudflare.md](deploy-oracle-cloudflare.md).

---

## Making the repository public (maximum visibility)

```bash
gh repo edit MFCAtash/melune --visibility public --accept-visibility-change-consequences
```

When public, **anyone** can view, clone and fork. The MIT [LICENSE](../LICENSE)
grants broad reuse rights. Only do this if wide distribution is desired.

---

## Security notes

- Never grant Admin/Write just for viewing — Read is enough.
- Remove access immediately when someone no longer needs it (`--remove`).
- Audit collaborators periodically with `--list`.
- Tokens and credentials must never be committed — see [SECURITY.md](../SECURITY.md).
- The demo accounts and sample media described in the root README must be
  removed before public launch.

---

## Quick reference

```bash
# make repo private (already default for this project)
gh repo edit MFCAtash/melune --visibility private

# invite a read-only viewer
./scripts/github/grant-read-access.sh USERNAME

# verify
./scripts/github/grant-read-access.sh --list
```
