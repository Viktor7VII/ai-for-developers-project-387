#!/usr/bin/env bash
# Tests of .github/scripts/run-review.sh with a fake `opencode` (no network, no model). Part of `mise run check`.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/pr"
git -C "$work/pr" init -q && git -C "$work/pr" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init

# Fake OpenCode 2.x: prints JSON events for $MODE like `opencode run --format json`.
cat > "$work/bin/opencode" <<'EOF'
#!/usr/bin/env bash
cat > /dev/null
text() { printf '{"type":"text","sessionID":"s","part":{"id":"%s","type":"text","text":"%s"}}\n' "$1" "$2"; }
error() { printf '{"type":"error","sessionID":"s","error":{"type":"%s","message":"%s"}}\n' "$1" "$2"; }
echo "> build · model" >&2
case "$MODE" in
  ok) text prt_1 '===REVIEW-START===\nИт'; text prt_1 'ог: ок\n===REVIEW-END===' ;;
  quota) error provider.free-limit 'Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.'; exit 1 ;;
  error) error provider.auth 'Invalid API key'; exit 1 ;;
  crash) echo 'segfault' >&2; exit 2 ;;
  hang) sleep 10 ;;
  notext) printf '{"type":"step_start"}\n{"type":"step_finish"}\n' ;;
  edits) touch changed.txt; text prt_1 'Итог: ок' ;;
esac
EOF
chmod +x "$work/bin/opencode"
: > "$work/prompt.md"

failures=0
# scenario <mode> <expected exit> <expected quota output> <expected review> <description>
scenario() {
  local out="$work/$1.out" log="$work/$1.log"
  : > "$out"; rm -f "$work/review.md" "$work/pr/changed.txt"
  (cd "$work/pr" && MODE="$1" MODEL=opencode/test OPENCODE_TIMEOUT=1s GITHUB_OUTPUT="$out" PATH="$work/bin:$PATH" \
    bash "$here/run-review.sh" "$work/prompt.md" "$work") > "$log" 2>&1
  local code=$? quota review
  quota="$(sed -n 's/^quota-exceeded=//p' "$out")"
  review="$(cat "$work/review.md" 2>/dev/null)"
  if [ "$code" = "$2" ] && [ "$quota" = "$3" ] && { [ -z "$4" ] || [ "$review" = "$4" ]; }; then
    echo "ok   $5"
  else
    echo "FAIL $5: exit=$code (want $2), quota='$quota' (want '$3'), review='$review'"
    sed 's/^/     /' "$log"
    failures=$((failures + 1))
  fi
}

scenario ok 0 "" "Итог: ок" "successful answer: review extracted from text deltas"
scenario quota 1 "true" "" "free model quota exhausted: fails fast, marked as not counted"
scenario error 1 "" "" "other OpenCode error fails without the quota mark"
scenario crash 1 "" "" "opencode crash without events fails"
scenario hang 1 "" "" "time limit: opencode stopped by timeout"
scenario notext 1 "" "" "answer without text fails"
scenario edits 1 "" "" "reviewer changing files fails"
grep -q "did not finish" "$work/hang.log" || { echo "FAIL timeout message missing"; failures=$((failures + 1)); }
grep -q "not counted" "$work/quota.log" || { echo "FAIL quota message missing"; failures=$((failures + 1)); }

if [ "$failures" -ne 0 ]; then
  echo "$failures run review test(s) failed"
  exit 1
fi
echo "All run review tests passed"
