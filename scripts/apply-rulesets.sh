#!/usr/bin/env bash
set -euo pipefail

# Idempotently applies .github/rulesets/*.json and the allow_merge_commit
# repo setting prod.json's "merge" method needs, to dnunez24/website via the
# GitHub REST and GraphQL APIs.
#
# Scope is rulesets and that one repo setting — nothing else repo-wide.
# Repo-wide hardening (default workflow token permissions, PR approval by
# Actions, secret scanning) is a separate concern, added behind
# --apply-hardening by claude/deploy-5-repo-hardening on top of this branch:
# those settings affect every workflow's token, not just this deploy stack,
# so they're a separate PR and a separate flag, not bundled into --apply
# here.
#
# No GitHub environments or deployment branch policies: Cloudflare Workers
# Builds deploys straight from Cloudflare's GitHub app, with no GitHub
# Actions deploy job and no GitHub Deployments API call for an Environment's
# protection rules to gate. main.json and prod.json's branch rules, plus
# Workers Builds' own required status check, are what stand in front of a
# deploy now.
#
# Default mode is a dry run: every GET (and the one GraphQL query, also
# read-only) is real, but every PUT/POST/PATCH is only printed, with its
# payload. Nothing is sent to GitHub unless invoked with --apply.
#
# Order matters and is enforced here, not just documented: the repo PATCH
# first, then the rulesets.
#
# https://docs.github.com/en/rest/repos/rules
# https://docs.github.com/en/rest/repos/repos#update-a-repository
# https://docs.github.com/en/graphql/reference/objects#repositoryruleset
#
# Usage: scripts/apply-rulesets.sh [--apply]

REPO="dnunez24/website"
HOST="github.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULESETS_DIR="$SCRIPT_DIR/../.github/rulesets"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

APPLY=false
case "${1:-}" in
	--apply) APPLY=true ;;
	"") ;;
	*)
		echo "Usage: $0 [--apply]" >&2
		exit 1
		;;
esac

# Every gh call in this script goes through here, always pinned to
# github.com regardless of GH_HOST or any other ambient gh config, and
# always writing to a file instead of a process substitution or command
# substitution that could let a failed `gh api` call pass silently into
# whatever consumes its (empty) output.
gh_api_to_file() {
	local outfile="$1"
	shift
	if ! gh api --hostname "$HOST" "$@" >"$outfile"; then
		echo "::error::gh api $* failed" >&2
		exit 1
	fi
}

# $1 = HTTP method, $2 = API path, $3 = path to a JSON file to send as the
# request body (optional). GET always runs for real, even in dry-run mode —
# it changes nothing, and both the preflight and the ruleset diff need it.
#
# Dry-run announcements go to stderr, not stdout: every call site redirects
# this function's stdout to /dev/null when it doesn't need the real
# response body (which is most of them), and a dry run has no response body
# to show — only the announcement, which must survive that redirect to be
# visible at all.
request() {
	local method="$1" path="$2" input="${3:-}" outfile
	outfile="$WORKDIR/response-$(echo "$path" | tr -c 'a-zA-Z0-9' '-')-$$-$RANDOM.json"
	if [ "$method" = "GET" ] || [ "$APPLY" = true ]; then
		if [ -n "$input" ]; then
			if ! gh api --hostname "$HOST" "$path" --method "$method" --input "$input" >"$outfile"; then
				echo "::error::gh api --method $method $path failed" >&2
				exit 1
			fi
		else
			gh_api_to_file "$outfile" "$path" --method "$method"
		fi
		cat "$outfile"
	else
		echo "--- DRY RUN: $method $path ---" >&2
		if [ -n "$input" ]; then
			echo "payload:" >&2
			jq . "$input" >&2
		fi
		# A dry run never calls GitHub for this, so there's no real response
		# to hand back. Callers that need one (the two-phase main-merge
		# apply) check $APPLY themselves before relying on this output.
		echo "{}"
	fi
}

echo "== Preflight =="
user_file="$WORKDIR/user.json"
gh_api_to_file "$user_file" user
login="$(jq -r .login "$user_file")"
user_id="$(jq -r .id "$user_file")"
if [ "$login" != "dnunez24" ]; then
	echo "::error::authenticated as '$login', not dnunez24. Refusing to run." >&2
	exit 1
fi
echo "  authenticated as $login (id $user_id) on $HOST"

repo_file="$WORKDIR/repo.json"
gh_api_to_file "$repo_file" "repos/$REPO"
is_admin="$(jq -r .permissions.admin "$repo_file")"
if [ "$is_admin" != "true" ]; then
	echo "::error::$login does not have admin permission on $REPO. Refusing to run." >&2
	exit 1
fi
echo "  $login has admin permission on $REPO"
echo

echo "== Repository settings =="
echo "  allow_merge_commit=true (squash stays on; rebase left untouched) — prod.json's pull_request rule allows \"merge\", which the repo must also allow"
repo_settings_file="$WORKDIR/repo-settings.json"
jq -n '{ allow_merge_commit: true }' >"$repo_settings_file"
request PATCH "repos/$REPO" "$repo_settings_file" >/dev/null
echo

# Fields that make up a ruleset's desired state — everything in
# .github/rulesets/*.json, and the subset of a GET response comparable to
# it (id, node_id, source_type, source, created_at, updated_at and _links
# are server-assigned or endpoint-derived, not request fields).
RULESET_SHAPE='{name, target, enforcement, conditions, rules, bypass_actors}'

# Finds an existing ruleset named $1, if any. Prints its id (empty if none),
# and fails if more than one ruleset shares the name rather than guessing.
find_ruleset_id() {
	local name="$1"
	local all_rulesets_file="$WORKDIR/rulesets-all-$name.json"
	local matches_file="$WORKDIR/rulesets-matching-$name.json"
	gh_api_to_file "$all_rulesets_file" "repos/$REPO/rulesets" --paginate
	# --paginate with a JSON array response concatenates pages as separate
	# arrays back to back, not one flat array — slurp and flatten before
	# filtering, so a match on page 2 isn't missed.
	jq -s --arg n "$name" '[.[][] | select(.name == $n) | .id]' "$all_rulesets_file" >"$matches_file"
	local match_count
	match_count="$(jq 'length' "$matches_file")"
	if [ "$match_count" -gt 1 ]; then
		echo "::error::$match_count rulesets are named '$name'; refusing to guess which one to update:" >&2
		jq . "$matches_file" >&2
		exit 1
	fi
	jq -r '.[0] // empty' "$matches_file"
}

# Confirms, via GraphQL (the only place GitHub resolves a RepositoryRole
# bypass actor's numeric id to a name), that $2's RepositoryRole bypass
# actors match what $1 (the ruleset's node_id) actually has live. Exits
# non-zero on any mismatch — this is the safety check that lets
# apply_bypassed_ruleset activate a ruleset it just created or updated.
verify_bypass_actors() {
	local node_id="$1" file="$2"
	local gql_file="$WORKDIR/graphql-bypass-$node_id.json"
	# The $nodeId below is a GraphQL variable, not a shell one — it's bound
	# by the -f nodeId="$node_id" argument, not by shell expansion, so the
	# query is deliberately single-quoted.
	# shellcheck disable=SC2016
	if ! gh api --hostname "$HOST" graphql -f query='
		query($nodeId: ID!) {
			node(id: $nodeId) {
				... on RepositoryRuleset {
					bypassActors(first: 10) {
						nodes { bypassMode repositoryRoleName repositoryRoleDatabaseId }
					}
				}
			}
		}' -f nodeId="$node_id" >"$gql_file"; then
		echo "::error::GraphQL query for $node_id's bypass actors failed" >&2
		exit 1
	fi
	# Every RepositoryRole actor the local file wants must appear live with
	# the same numeric id. repositoryRoleName is a free-text field (not a
	# GraphQL enum — confirmed by introspection), so it's logged for a human
	# to read, not compared against a guessed casing.
	local wanted actual
	wanted="$(jq -r '[.bypass_actors[]? | select(.actor_type == "RepositoryRole") | .actor_id] | sort | @csv' "$file")"
	actual="$(jq -r '[.data.node.bypassActors.nodes[]? | .repositoryRoleDatabaseId] | sort | @csv' "$gql_file")"
	if [ "$wanted" != "$actual" ]; then
		echo "::error::Bypass actor mismatch for $node_id: wanted RepositoryRole id(s) [$wanted], GraphQL reports [$actual]." >&2
		jq . "$gql_file" >&2
		exit 1
	fi
	echo "  confirmed via GraphQL: RepositoryRole id(s) [$actual], name(s): $(jq -r '[.data.node.bypassActors.nodes[]? | .repositoryRoleName] | join(", ")' "$gql_file")"
}

# Applies a ruleset that has at least one bypass actor, two-phase: create or
# update it with enforcement forced to "disabled" first, confirm via
# GraphQL that its bypass actors resolve to what the file wants, and only
# then flip it to the file's real enforcement value. A wrong actor_id can
# therefore never go live with an active bypass — worst case, the ruleset
# sits there disabled (enforcing nothing) until this is fixed and re-run.
apply_bypassed_ruleset() {
	local file="$1" name existing_id disabled_file
	name="$(jq -r .name "$file")"
	existing_id="$(find_ruleset_id "$name")"

	disabled_file="$WORKDIR/disabled-$name.json"
	jq '.enforcement = "disabled"' "$file" >"$disabled_file"

	local response_file="$WORKDIR/bypass-apply-$name.json"
	if [ -n "$existing_id" ]; then
		echo "  found existing ruleset, id $existing_id — phase 1: disable and apply"
		request PUT "repos/$REPO/rulesets/$existing_id" "$disabled_file" >"$response_file"
	else
		echo "  no existing ruleset named '$name' — phase 1: create disabled"
		request POST "repos/$REPO/rulesets" "$disabled_file" >"$response_file"
	fi

	if [ "$APPLY" = false ]; then
		echo "  -- DRY RUN: phase 2 would be a GraphQL query confirming the bypass actor(s) above resolve correctly, then PUT enforcement=\"active\" --"
		return
	fi

	local ruleset_id node_id
	ruleset_id="$(jq -r .id "$response_file")"
	node_id="$(jq -r .node_id "$response_file")"
	echo "  phase 2: verifying bypass actor(s) via GraphQL before activating id $ruleset_id"
	verify_bypass_actors "$node_id" "$file"

	echo "  phase 3: activating (enforcement=\"active\")"
	request PUT "repos/$REPO/rulesets/$ruleset_id" "$file" >/dev/null
}

apply_ruleset() {
	local file="$1" name existing_id
	local live_file live_shape_file local_shape_file

	echo "== Validating $(basename "$file") =="
	jq empty "$file"
	echo "  jq syntax OK"

	name="$(jq -r .name "$file")"
	echo "== Ruleset '$name' =="

	if [ "$(jq '.bypass_actors | length' "$file")" -gt 0 ]; then
		apply_bypassed_ruleset "$file"
		echo
		return
	fi

	existing_id="$(find_ruleset_id "$name")"
	if [ -n "$existing_id" ]; then
		echo "  found existing ruleset, id $existing_id"
		echo "  -- diff: live ruleset (left) vs $(basename "$file") (right) --"
		live_file="$WORKDIR/live-$name.json"
		live_shape_file="$WORKDIR/live-shape-$name.json"
		local_shape_file="$WORKDIR/local-shape-$name.json"
		gh_api_to_file "$live_file" "repos/$REPO/rulesets/$existing_id"
		# Plain files, not process substitution: a failure in either jq call
		# above already aborted the script (set -e), so by the time diff
		# runs here, both sides are known-good — nothing about the diff's
		# own exit code (1 = differences found, not an error) can hide a
		# failure the way a failed command inside `<(...)` could.
		jq -S "$RULESET_SHAPE" "$live_file" >"$live_shape_file"
		jq -S "$RULESET_SHAPE" "$file" >"$local_shape_file"
		if diff "$live_shape_file" "$local_shape_file"; then
			echo "  no differences"
		fi
		request PUT "repos/$REPO/rulesets/$existing_id" "$file" >/dev/null
	else
		echo "  no existing ruleset named '$name' — will create"
		request POST "repos/$REPO/rulesets" "$file" >/dev/null
	fi
	echo
}

for ruleset_file in "$RULESETS_DIR"/*.json; do
	apply_ruleset "$ruleset_file"
done

if [ "$APPLY" = false ]; then
	echo "Dry run only — nothing above was changed."
	echo "Re-run with --apply to send the PUT/POST/PATCH requests shown above."
fi
