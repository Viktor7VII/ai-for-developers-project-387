#!/usr/bin/env bash
# Tests of the agent run limit action (.github/actions/agent-run-limit) with a fake GitHub API.
# Runs the action's script directly; no network and no real workflow runs. Part of `mise run check`.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"

# The action's bash script: the block after "run: |", without its YAML indentation
# (carriage returns dropped: the file may have CRLF line endings in a Windows checkout).
awk '{ sub(/\r$/, "") } /^      run: \|$/ { on = 1; next } on { sub(/^        /, ""); print }' \
  "$root/.github/actions/agent-run-limit/action.yml" > "$work/limit.sh"

# Fake gh: own job id $MY_ID (default 500); one /oc run (11) and one review run (22) for the pull request.
# Fixture files per scenario: 11 / 22 hold pre-rendered "<job id>|<job name>|<state>" lines (only jobs with
# a smaller id than MY_ID are returned, like the real filter); 11.2 / 22.2 replace them from the second
# budget check on (an earlier job that became visible late); runs-11 / runs-22 replace the run list lines
# "<run id> <created_at> <1 if the title matches the PR>"; fail-runs / fail-jobs-<run> simulate API errors;
# transient fails one queue query; wait-<n> lists unfinished earlier /oc jobs for the n-th queue query.
cat > "$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
url="$2"; [ "$2" = "--paginate" ] && url="$3"
fail() { [ -f "$FIX/fail-$1" ] && { echo "HTTP 502" >&2; exit 1; }; }
runs() { if [ -f "$FIX/runs-$1" ]; then cat "$FIX/runs-$1"; else echo "$1 2026-11-24T10:00:00Z 1"; fi; }
case "$url" in
  */attempts/*/jobs*) echo "${MY_ID:-500}" ;;
  */pulls/*) echo 2026-11-24T09:00:00Z ;;
  *page=[2-9]*) ;;
  */workflows/opencode.yml/runs*) fail runs; runs 11 ;;
  */workflows/opencode-review.yml/runs*) runs 22 ;;
  */runs/*/jobs*)
    id="${url#*/runs/}"; id="${id%%/*}"
    if [[ "$*" == *'.status != "completed") | .id'* ]]; then
      [ -f "$FIX/transient" ] && { rm -f "$FIX/transient"; echo "HTTP 502" >&2; exit 1; }
      n=$(cat "$FIX/polls" 2>/dev/null || echo 0); echo $((n + 1)) > "$FIX/polls"
      [ "$id" = 11 ] && cat "$FIX/wait-$n" 2>/dev/null; exit 0
    fi
    fail "jobs-$id"
    calls=$(cat "$FIX/calls-$id" 2>/dev/null || echo 0); echo $((calls + 1)) > "$FIX/calls-$id"
    file="$FIX/$id"; [ "$calls" -ge 1 ] && [ -f "$FIX/$id.2" ] && file="$FIX/$id.2"
    [ -f "$file" ] && awk -F'|' -v me="${MY_ID:-500}" '$1 < me' "$file"; exit 0 ;;
  *) echo "unexpected gh $*" >&2; exit 1 ;;
esac
EOF
printf '#!/bin/sh\necho "slept $1" >> "$FIX/log"\n' > "$work/bin/sleep"
chmod +x "$work/bin/gh" "$work/bin/sleep"

failures=0
# scenario <name> <wait> <expected exit> <expected outputs> <description>; fixtures via fx.
fx() { mkdir -p "$work/$1"; printf "$3" > "$work/$1/$2"; }
scenario() {
  local fix="$work/$1" out="$work/$1.out"
  mkdir -p "$fix"; : > "$out"
  FIX="$fix" MY_ID="${MY_ID:-500}" SETTLE=7 PATH="$work/bin:$PATH" GITHUB_REPOSITORY=o/r GITHUB_RUN_ID=9 GITHUB_RUN_ATTEMPT=1 \
    GITHUB_OUTPUT="$out" GITHUB_STEP_SUMMARY=/dev/null PR_NUMBER=5 JOB_NAME="Run OpenCode" \
    MAX_RUNS=3 WAIT="$2" timeout 20 bash "$work/limit.sh" > "$fix.log" 2>&1
  local code=$? got
  got="$(tr '\n' ' ' < "$out" | sed 's/ *$//')"
  if [ "$code" = "$3" ] && [ "$got" = "$4" ]; then
    echo "ok   $5"
  else
    echo "FAIL $5: exit=$code (want $3), outputs='$got' (want '$4')"
    sed 's/^/     /' "$fix.log"
    failures=$((failures + 1))
  fi
}

# Budget counting
fx a 11 '201|Run OpenCode|taken\n'; fx a 22 '101|Review pull request|taken\n102|Review pull request|free\n'
scenario a false 0 "used=2 allowed=true" "taken runs of both workflows count, free ones don't"
fx b 11 '201|Run OpenCode|taken\n202|Run OpenCode|pending\n'; fx b 22 '101|Review pull request|taken\n'
scenario b false 1 "used=3 allowed=false" "limit reached: refused before the model"
fx c 11 '201|Run OpenCode|free\n202|Run OpenCode|free\n'; fx c 22 '101|Review pull request|taken\n'
scenario c false 0 "used=1 allowed=true" "cancelled or failed before reservation are free"
fx d 11 '201|Run OpenCode|taken\n'; fx d 22 '101|Review pull request|taken\n102|Review pull request|pending\n'
scenario d false 1 "used=3 allowed=false" "concurrent earlier pending job counts (fail-closed)"
fx e 11 '201|Run OpenCode|taken\n'
fx e 22 '101|Review pull request|taken\n102|Review pull request|taken\n101|Review pull request|taken\n'
scenario e false 1 "used=3 allowed=false" "all run attempts count (re-runs), shared /oc + review budget"
fx f 11 ''; fx f 22 '101|Review pull request|taken\n101|Review pull request|taken\n'
scenario f false 0 "used=1 allowed=true" "a job listed in several attempts counts once"

# API errors fail closed
fx g 11 '201|Run OpenCode|taken\n'; fx g 22 '101|Review pull request|taken\n102|Review pull request|taken\n'
touch "$work/g/fail-jobs-22"
scenario g false 1 "allowed=false" "API error on the jobs list refuses the run"
fx h 11 '201|Run OpenCode|taken\n'; touch "$work/h/fail-runs"
scenario h false 1 "allowed=false" "API error on the runs list refuses the run"

# Concurrency: the Actions API may list an earlier job late; jobs check only earlier jobs
fx k 11 '201|Run OpenCode|taken
'; fx k 22 '101|Review pull request|taken
'
fx k 22.2 '101|Review pull request|taken
150|Review pull request|pending
'
scenario k false 1 "used=3 allowed=false" "earlier job visible only on the second check: refused before the model"
grep -q 'slept 7' "$work/k/log" || { echo "FAIL second check did not wait settle-seconds"; failures=$((failures + 1)); }
for id in 500 501; do
  fx "l$id" 11 '101|Run OpenCode|taken
102|Review pull request|taken
500|Run OpenCode|pending
501|Review pull request|pending
'
done
MY_ID=500 scenario l500 false 0 "used=2 allowed=true" "simultaneous jobs: the earlier one (id 500) gets the last run"
MY_ID=501 scenario l501 false 1 "used=3 allowed=false" "simultaneous jobs: the later one (id 501) is refused"
fx m 11 '101|Run OpenCode|taken
102|Review pull request|taken
'
fx m 11.2 '101|Run OpenCode|taken
102|Review pull request|taken
500|Run OpenCode|pending
'
MY_ID=501 scenario m false 1 "used=3 allowed=false" "simultaneous jobs with API lag: the later one is refused on the second check"
fx n runs-11 '11 2026-11-24T10:00:00Z 1
12 2026-11-24T10:05:00Z 0
'; fx n 11 ''; fx n 22 ''
fx n 12 '301|Run OpenCode|taken
302|Run OpenCode|taken
303|Run OpenCode|taken
'
scenario n false 0 "used=0 allowed=true" "runs of other pull requests are not counted"

# /oc queue
fx i 11 ''; fx i 22 ''
scenario i true 0 "used=0 allowed=true" "queue: earlier jobs finished (cancelled, failed) - no wait"
fx j 11 ''; fx j 22 ''; touch "$work/j/transient"; fx j wait-0 '400\n401\n'; fx j wait-1 '400\n'
scenario j true 0 "used=0 allowed=true" "queue: API error retried, waits until earlier jobs finish"
if [ "$(grep -c 'slept 20' "$work/j/log" 2>/dev/null)" != 3 ]; then
  echo "FAIL queue: expected 3 waits (error, 2 busy, 1 busy)"; failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
  echo "$failures agent run limit test(s) failed"
  exit 1
fi
echo "All agent run limit tests passed"
