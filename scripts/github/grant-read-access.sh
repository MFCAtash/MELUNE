#!/usr/bin/env bash
# =============================================================================
# MELUNE — grant READ-ONLY access to a private repository
# =============================================================================
# Invites one or more GitHub users as collaborators with `pull` (read) permission
# on this repository. Read-only collaborators can:
#   - browse every file in the web UI
#   - clone the repository (unless disabled — see "Disabling local clones" below)
#   - open issues and review code
#
# They CANNOT:
#   - push commits
#   - merge pull requests
#   - fork this private repository into their own account
#   - change settings or invite others
#
# IMPORTANT HONEST LIMITATION:
#   GitHub (and Git in general) cannot prevent a viewer from copying source code
#   locally once they can see it. A browser downloads the code to render it.
#   The only true "view but never copy" would be a hosted demo/app where no
#   source is exposed at all (e.g. GitHub Pages or a deployed app). This script
#   implements the strongest *GitHub-native* read-only control available.
#
# Usage (from anywhere, with `gh` authenticated as an account that has admin on
# the repository):
#
#   ./scripts/github/grant-read-access.sh alice bob carol
#   ./scripts/github/grant-read-access.sh --repo MFCAtash/melune alice
#   ./scripts/github/grant-read-access.sh --list
#   ./scripts/github/grant-read-access.sh --remove alice
#
# Options:
#   --repo <owner/name>   Target repository (default: detected from `git remote`)
#   --list                List current collaborators and their permissions
#   --remove <user>       Remove a collaborator's access entirely
#   --team <slug>         Invite a *team* instead of users (org repos only)
#   --help                Show this help
#
# Requires: GitHub CLI (`gh`) authenticated with `repo` scope (admin rights on
# the target repository).
# =============================================================================
set -euo pipefail

REPO=""
LIST=0
REMOVE=""
TEAM=""

usage() {
  sed -n '2,42p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)  REPO="${2:-}"; shift 2 ;;
    --list)  LIST=1; shift ;;
    --remove) REMOVE="${2:-}"; shift 2 ;;
    --team)  TEAM="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) break ;;
  esac
done

# Detect repository from git remote when not supplied.
if [ -z "$REPO" ]; then
  REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
  if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  fi
fi

if [ -z "$REPO" ]; then
  echo "ERROR: could not detect repository. Use --repo owner/name." >&2
  exit 1
fi

command -v gh >/dev/null 2>&1 || { echo "ERROR: GitHub CLI (gh) is required." >&2; exit 1; }

if [ "$LIST" -eq 1 ]; then
  echo "==> Collaborators on $REPO"
  gh api "repos/$REPO/collaborators" \
    --jq '.[] | [.login, .role_name, .permissions.pull, .permissions.push] | @tsv' \
    | column -t -s $'\t'
  exit 0
fi

if [ -n "$REMOVE" ]; then
  echo "==> Removing access for $REMOVE from $REPO"
  gh api -X DELETE "repos/$REPO/collaborators/$REMOVE"
  echo "    done."
  exit 0
fi

if [ -n "$TEAM" ]; then
  echo "==> Granting read access to team '$TEAM' on $REPO"
  gh api -X PUT "repos/$REPO/teams/$TEAM" -f permission='pull'
  echo "    team '$TEAM' can now view (read-only)."
  exit 0
fi

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 [--repo owner/name] [--list] [--remove user] [--team slug] USERNAME..." >&2
  exit 1
fi

for user in "$@"; do
  echo "==> Inviting $user as READ-ONLY collaborator on $REPO"
  # `pull` is GitHub's REST name for the read-only role.
  gh api -X PUT "repos/$REPO/collaborators/$user" -f permission='pull' \
    --jq '.login + " -> " + .role_name' 2>/dev/null \
    || { echo "    FAILED for $user (check username and your admin rights)." >&2; continue; }
done

echo
echo "Done. Viewers can browse and clone, but cannot push, fork, or change settings."
echo "Verify with: $0 --list"
