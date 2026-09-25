#!/usr/bin/env bash
set -euo pipefail

# Offline, fixture-driven tests for verify_bypass_actors (m3 in
# deploy-rework-review.md): a wrong-but-valid RepositoryRole id used to
# pass this check as long as GraphQL echoed the same id back, because it
# never looked at repositoryRoleName, the only field that says which role
# an id actually resolves to. Run: bash scripts/apply-rulesets.test.sh
#
# No network, no real `gh`: PATH is prepended with a fake `gh` (below) that
# answers the one GraphQL call verify_bypass_actors makes, from a canned
# fixture, and refuses anything else — so a future change to what this
# script asks `gh` for fails this test instead of the fake silently
# answering the wrong question.

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

# main-merge.json is the real fixture, not a copy: it already has exactly
# the bypass_actors shape under test (one RepositoryRole, actor_id 5), and
# testing against the file this script actually applies means the test
# can't quietly drift from it.
RULESET_FIXTURE="$TEST_DIR/../.github/rulesets/main-merge.json"

FAKE_GH_DIR="$FIXTURE_DIR/bin"
mkdir -p "$FAKE_GH_DIR"
cat >"$FAKE_GH_DIR/gh" <<'FAKE_GH'
#!/usr/bin/env bash
set -euo pipefail
# verify_bypass_actors calls exactly: gh api --hostname <host> graphql
# -f query=... -f nodeId=... — i.e. $1=api $2=--hostname $3=<host>
# $4=graphql. Anything else is a call this fake doesn't understand.
if [ "${1:-}" = "api" ] && [ "${4:-}" = "graphql" ]; then
	cat "$FAKE_GH_RESPONSE"
	exit 0
fi
echo "fake gh: unexpected invocation: $*" >&2
exit 1
FAKE_GH
chmod +x "$FAKE_GH_DIR/gh"
PATH="$FAKE_GH_DIR:$PATH"

# $1 = output path, $2 = repositoryRoleDatabaseId, $3 = repositoryRoleName
write_fixture() {
	jq -n --argjson id "$2" --arg name "$3" \
		'{data: {node: {bypassActors: {nodes: [{bypassMode: "always", repositoryRoleName: $name, repositoryRoleDatabaseId: $id}]}}}}' \
		>"$1"
}

pass_count=0
fail_count=0

# $1 = case name, $2 = fixture file, $3 = "pass" or "fail" (expected outcome)
run_case() {
	local case_name="$1" fixture="$2" want="$3" got
	FAKE_GH_RESPONSE="$fixture"
	export FAKE_GH_RESPONSE
	# Subshell: verify_bypass_actors calls `exit 1` directly on failure, not
	# `return 1` — without the subshell, a "fail" case would exit this whole
	# test script instead of just reporting a result. `if (...)` also keeps
	# `set -e` above from treating that exit as this script's own failure.
	if ( verify_bypass_actors "test-node-id" "$RULESET_FIXTURE" >/dev/null 2>&1 ); then
		got="pass"
	else
		got="fail"
	fi
	if [ "$got" = "$want" ]; then
		echo "ok   $case_name (expected $want, got $got)"
		pass_count=$((pass_count + 1))
	else
		echo "FAIL $case_name (expected $want, got $got)"
		fail_count=$((fail_count + 1))
	fi
}

admin_fixture="$FIXTURE_DIR/admin.json"
write_fixture "$admin_fixture" 5 "admin"
run_case "id 5, role admin" "$admin_fixture" pass

mixed_case_fixture="$FIXTURE_DIR/admin-mixed-case.json"
write_fixture "$mixed_case_fixture" 5 "Admin"
run_case "id 5, role Admin (case-insensitive)" "$mixed_case_fixture" pass

# The bug this suite guards against: id 5 is correct, but GraphQL reports
# it as the "write" role, not "admin". The old check compared
# repositoryRoleDatabaseId to itself and never looked at
# repositoryRoleName, so this used to pass.
write_role_fixture="$FIXTURE_DIR/write-role.json"
write_fixture "$write_role_fixture" 5 "write"
run_case "id 5, role write (must fail)" "$write_role_fixture" fail

# The id check on its own, still exercised: a valid role name on the wrong
# id must also fail.
wrong_id_fixture="$FIXTURE_DIR/wrong-id.json"
write_fixture "$wrong_id_fixture" 3 "admin"
run_case "id 3 instead of 5 (must fail)" "$wrong_id_fixture" fail

echo
echo "$pass_count passed, $fail_count failed"
if [ "$fail_count" -gt 0 ]; then
	exit 1
fi
