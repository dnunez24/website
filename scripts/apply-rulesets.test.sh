#!/usr/bin/env bash
set -euo pipefail

# Offline, fixture-driven tests for two parts of apply-rulesets.sh:
#
# - verify_bypass_actors (m3 in deploy-rework-review.md): a wrong-but-valid
#   RepositoryRole id used to pass this check as long as GraphQL echoed the
#   same id back, because it never looked at repositoryRoleName, the only
#   field that says which role an id actually resolves to.
# - check_required_contexts_have_reported (R1/R4 in the review's Recheck
#   section): it used to check every required context against `main`'s tip
#   only, so `prod.json`'s release-source (which never runs on a push, only
#   on a PR into `prod`) always looked unreported and refused --apply after
#   other writes had already gone through.
#
# Run: bash scripts/apply-rulesets.test.sh
#
# No network, no real `gh`: PATH is prepended with a fake `gh` (below) that
# answers the specific calls these functions make, from canned fixtures,
# and refuses anything else — so a future change to what this script asks
# `gh` for fails this test instead of the fake silently answering the wrong
# question. That includes any write (a `--method` other than the implicit
# GET): neither function under test should ever attempt one, and the fake's
# catch-all makes sure a regression that added one would be caught here.

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sourced, not executed: apply-rulesets.sh's own run-guard keeps this from
# doing a real preflight or touching GitHub. Only its function definitions
# (and REPO/HOST/WORKDIR/RULESET_SHAPE/APPLY=false) land in this shell.
# shellcheck source=apply-rulesets.sh
source "$TEST_DIR/apply-rulesets.sh"

# A second temp dir of this test's own, cleaned up together with
# apply-rulesets.sh's $WORKDIR (sourcing it above already set a trap for
# that one — replacing it here, rather than adding a second `trap ... EXIT`,
# since bash keeps only the most recent handler for a given signal).
FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR" "$FIXTURE_DIR"' EXIT

# main-merge.json and prod.json are the real fixtures, not copies: testing
# against the files this script actually applies means the tests can't
# quietly drift from them. main-merge.json already has exactly the
# bypass_actors shape verify_bypass_actors's cases test (one RepositoryRole,
# actor_id 5); prod.json already requires exactly release-source plus the
# quality-stack and Workers Builds contexts.
MAIN_MERGE_FIXTURE="$TEST_DIR/../.github/rulesets/main-merge.json"
PROD_FIXTURE="$TEST_DIR/../.github/rulesets/prod.json"

FAKE_GH_DIR="$FIXTURE_DIR/bin"
FAKE_GH_CHECK_RUNS_DIR="$FIXTURE_DIR/check-runs"
FAKE_GH_PRS_DIR="$FIXTURE_DIR/prs"
mkdir -p "$FAKE_GH_DIR" "$FAKE_GH_CHECK_RUNS_DIR" "$FAKE_GH_PRS_DIR"
export FAKE_GH_CHECK_RUNS_DIR FAKE_GH_PRS_DIR
cat >"$FAKE_GH_DIR/gh" <<'FAKE_GH'
#!/usr/bin/env bash
set -euo pipefail
# Every call this script makes is `gh api --hostname <host> <path-or-
# graphql> ...`, so $1=api $2=--hostname $3=<host> $4=<path or "graphql">.
# A write (`request()`'s PUT/POST/PATCH) sets $5=--method — none of the
# three shapes below match that, so it falls to the catch-all and fails
# loudly instead of silently succeeding.
if [ "${1:-}" != "api" ]; then
	echo "fake gh: unexpected invocation: $*" >&2
	exit 1
fi
path="${4:-}"
case "$path" in
	graphql)
		cat "$FAKE_GH_RESPONSE"
		;;
	*/check-runs)
		ref="${path#repos/*/commits/}"
		ref="${ref%/check-runs}"
		# printf, not echo: echo's trailing newline is itself not
		# [a-zA-Z0-9], so tr would turn it into a trailing "-" too,
		# mismatching a fixture file named without one.
		file="$FAKE_GH_CHECK_RUNS_DIR/$(printf '%s' "$ref" | tr -c 'a-zA-Z0-9' '-').json"
		if [ -f "$file" ]; then cat "$file"; else echo '{"total_count":0,"check_runs":[]}'; fi
		;;
	*/pulls)
		base=""
		for arg in "$@"; do
			case "$arg" in
				base=*) base="${arg#base=}" ;;
			esac
		done
		file="$FAKE_GH_PRS_DIR/$(printf '%s' "$base" | tr -c 'a-zA-Z0-9' '-').json"
		if [ -f "$file" ]; then cat "$file"; else echo '[]'; fi
		;;
	*)
		echo "fake gh: unexpected invocation: $*" >&2
		exit 1
		;;
esac
FAKE_GH
chmod +x "$FAKE_GH_DIR/gh"
PATH="$FAKE_GH_DIR:$PATH"

pass_count=0
fail_count=0

report() {
	local case_name="$1" want="$2" got="$3"
	if [ "$got" = "$want" ]; then
		echo "ok   $case_name (expected $want, got $got)"
		pass_count=$((pass_count + 1))
	else
		echo "FAIL $case_name (expected $want, got $got)"
		fail_count=$((fail_count + 1))
	fi
}

### verify_bypass_actors ######################################################

# $1 = output path, $2 = repositoryRoleDatabaseId, $3 = repositoryRoleName
write_bypass_fixture() {
	jq -n --argjson id "$2" --arg name "$3" \
		'{data: {node: {bypassActors: {nodes: [{bypassMode: "always", repositoryRoleName: $name, repositoryRoleDatabaseId: $id}]}}}}' \
		>"$1"
}

# $1 = case name, $2 = GraphQL fixture file, $3 = "pass" or "fail"
run_bypass_case() {
	local case_name="$1" fixture="$2" want="$3" got
	FAKE_GH_RESPONSE="$fixture"
	export FAKE_GH_RESPONSE
	# Subshell: verify_bypass_actors calls `exit 1` directly on failure, not
	# `return 1` — without the subshell, a "fail" case would exit this whole
	# test script instead of just reporting a result. `if (...)` also keeps
	# `set -e` above from treating that exit as this script's own failure.
	if ( verify_bypass_actors "test-node-id" "$MAIN_MERGE_FIXTURE" >/dev/null 2>&1 ); then
		got="pass"
	else
		got="fail"
	fi
	report "$case_name" "$want" "$got"
}

admin_fixture="$FIXTURE_DIR/admin.json"
write_bypass_fixture "$admin_fixture" 5 "admin"
run_bypass_case "id 5, role admin" "$admin_fixture" pass

mixed_case_fixture="$FIXTURE_DIR/admin-mixed-case.json"
write_bypass_fixture "$mixed_case_fixture" 5 "Admin"
run_bypass_case "id 5, role Admin (case-insensitive)" "$mixed_case_fixture" pass

# The bug this suite guards against: id 5 is correct, but GraphQL reports
# it as the "write" role, not "admin". The old check compared
# repositoryRoleDatabaseId to itself and never looked at
# repositoryRoleName, so this used to pass.
write_role_fixture="$FIXTURE_DIR/write-role.json"
write_bypass_fixture "$write_role_fixture" 5 "write"
run_bypass_case "id 5, role write (must fail)" "$write_role_fixture" fail

# The id check on its own, still exercised: a valid role name on the wrong
# id must also fail.
wrong_id_fixture="$FIXTURE_DIR/wrong-id.json"
write_bypass_fixture "$wrong_id_fixture" 3 "admin"
run_bypass_case "id 3 instead of 5 (must fail)" "$wrong_id_fixture" fail

### check_required_contexts_have_reported #####################################

# $1 = case name, $2 = ruleset file, $3 = "pass" (returns normally) or
# "refuse" (exits non-zero) with APPLY=true — the only mode that actually
# refuses; a dry run only warns.
run_guard_case() {
	local case_name="$1" file="$2" want="$3" got
	APPLY=true
	if ( check_required_contexts_have_reported "$file" >/dev/null 2>&1 ); then
		got="pass"
	else
		got="refuse"
	fi
	APPLY=false
	report "$case_name" "$want" "$got"
}

# prod.json requires check, build, structured-data, a11y, perf (ci.yml,
# push-triggered on main only, so never on prod's own tip), release-source
# (release.yml, pull_request-only, never on any tip) and Workers Builds:
# website (Cloudflare's app, push-triggered on every branch including
# prod). Fixture: everything except release-source shows up directly on
# prod's tip (standing in for "already working", not a claim any of the
# quality-stack jobs push-trigger on prod for real — they don't; only
# release-source's PR-only path is what this case exercises). No PR is
# open into prod for it, except release-source's own: one open PR whose
# head SHA's check-runs include it.
echo '{"total_count":6,"check_runs":[{"name":"check"},{"name":"build"},{"name":"structured-data"},{"name":"a11y"},{"name":"perf"},{"name":"Workers Builds: website"}]}' \
	>"$FAKE_GH_CHECK_RUNS_DIR/prod.json"
echo '[{"head":{"sha":"release-pr-head-sha"}}]' >"$FAKE_GH_PRS_DIR/prod.json"
echo '{"total_count":1,"check_runs":[{"name":"release-source"}]}' \
	>"$FAKE_GH_CHECK_RUNS_DIR/release-pr-head-sha.json"
run_guard_case "prod preflight passes, release-source seen only on a prod PR" "$PROD_FIXTURE" pass

# main-merge.json requires check and Workers Builds: website. Fixture:
# main's tip shows check but not Workers Builds: website (a stale-token
# build failure, or one that just hasn't landed yet — see this repo's own
# m7/R1 notes) — genuinely missing, not a pull_request-only context (it's
# not defined in any workflow file this script can see), so there's no PR
# fallback to catch it either. Must refuse under --apply, and must do so
# without the fake `gh` ever seeing a write (its catch-all would fail this
# test loudly if it did).
echo '{"total_count":1,"check_runs":[{"name":"check"}]}' \
	>"$FAKE_GH_CHECK_RUNS_DIR/main.json"
run_guard_case "main-merge refuses on a genuinely missing context, before any write" "$MAIN_MERGE_FIXTURE" refuse

echo
echo "$pass_count passed, $fail_count failed"
if [ "$fail_count" -gt 0 ]; then
	exit 1
fi
