#!/usr/bin/env bash
# Runs the read-only PR review with OpenCode 2.x and extracts its text.
# Usage: run-review.sh <prompt file> <work dir>; runs in the pull request checkout.
# Env: MODEL, OPENCODE_TIMEOUT (default 12m); OPENCODE_CONFIG_CONTENT holds the read-only permissions.
# Writes <work dir>/review.md. Sets quota-exceeded=true in $GITHUB_OUTPUT when the free model quota
# is exhausted: OpenCode Zen refuses such a request before the model runs, so the run is not counted.
# Exit codes: 0 review ready, 1 failure.
set -uo pipefail

prompt="$1"
work="$2"
here="$(cd "$(dirname "$0")" && pwd)"
events="$work/review-events.jsonl"
log="$work/opencode.log"

# The answer text is separated from tool output and errors by the JSON events; OpenCode's own
# diagnostics go to stderr and are kept for the log, never used as the review. The time limit stays
# well below the job timeout so the cause is reported instead of the job being cancelled.
status=0
timeout "${OPENCODE_TIMEOUT:-12m}" opencode run --format json -m "$MODEL" "Выполни ревью по инструкции ниже." \
  < "$prompt" > "$events" 2> "$log" || status=$?
if [ "$status" -eq 124 ]; then
  echo "::error::opencode run did not finish in ${OPENCODE_TIMEOUT:-12m}."
  tail -n 50 "$log"
  exit 1
fi

# The reviewer must not have changed anything.
if [ -n "$(git status --porcelain)" ]; then
  echo "::error::The review changed files in the checkout."
  git status --porcelain
  exit 1
fi

result=0
node "$here/review-output.mjs" "$events" > "$work/review.md" 2> "$work/review-error.txt" || result=$?
if [ "$result" -eq 3 ]; then
  echo "quota-exceeded=true" >> "$GITHUB_OUTPUT"
  echo "::error::$(cat "$work/review-error.txt") The run is not counted against the pull request's limit."
  exit 1
fi
if [ "$status" -ne 0 ]; then
  echo "::error::opencode run failed with exit code $status. $(cat "$work/review-error.txt")"
  tail -n 50 "$log"
  exit 1
fi
if [ "$result" -ne 0 ]; then
  echo "::error::$(cat "$work/review-error.txt")"
  tail -n 50 "$log"
  exit 1
fi
