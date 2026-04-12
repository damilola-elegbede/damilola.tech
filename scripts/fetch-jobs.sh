#!/usr/bin/env bash
# fetch-jobs.sh — Pull job listings from 5 target company ATS feeds and score each
#                 via the damilola.tech score_job API.
#
# Usage:
#   DAMILOLA_SCORE_API_KEY=dk_live_xxx bash scripts/fetch-jobs.sh
#
# Output:
#   .tmp/analysis/scored-jobs-YYYY-MM-DD.md — Markdown table of scored listings
#
# Prerequisites:
#   - DAMILOLA_SCORE_API_KEY env var: a dk_live_* key from damilola.tech admin
#   - curl, jq, python3 (all standard on macOS)
#   - damilola.tech PR #118 merged to production (score_job endpoint live)
#
# API key provisioning: if you don't have a key, retrieve one from the
# Vercel project KV dashboard or damilola.tech admin endpoints.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

API_KEY="${DAMILOLA_SCORE_API_KEY:-}"
API_URL="${SCORE_JOB_API_URL:-https://www.damilola.tech/api/v1/score-job}"
OUTPUT_DATE=$(date +%Y-%m-%d)
OUTPUT_FILE=".tmp/analysis/scored-jobs-${OUTPUT_DATE}.md"
MAX_ROLES_PER_COMPANY=5
ROLE_KEYWORDS="staff engineer|principal engineer|senior staff|distinguished|infrastructure engineer|platform engineer|ai engineer|ml engineer|machine learning|backend engineer|software engineer|senior engineer|staff software"

WORKDIR="/tmp/fetch-jobs-$$"

# ── Preflight ─────────────────────────────────────────────────────────────────

if [[ -z "$API_KEY" ]]; then
  echo "ERROR: DAMILOLA_SCORE_API_KEY is not set." >&2
  echo "  Export it: export DAMILOLA_SCORE_API_KEY=dk_live_..." >&2
  exit 1
fi

for cmd in curl python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found" >&2
    exit 1
  fi
done

mkdir -p .tmp/analysis "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

echo "fetch-jobs.sh -- ${OUTPUT_DATE}"
echo "  API endpoint: ${API_URL}"
echo "  Output: ${OUTPUT_FILE}"
echo ""

# ── ATS feed definitions ──────────────────────────────────────────────────────
# Each entry: "company_name|ats_type|feed_url"

FEEDS=(
  "Kindo|greenhouse|https://boards-api.greenhouse.io/v1/boards/kindo/jobs?content=true"
  "Pulumi|greenhouse|https://boards-api.greenhouse.io/v1/boards/pulumicorporation/jobs?content=true"
  "Anthropic|greenhouse|https://boards-api.greenhouse.io/v1/boards/anthropic/jobs?content=true"
  "Vercel|greenhouse|https://boards-api.greenhouse.io/v1/boards/vercel/jobs?content=true"
  "LlamaIndex|ashby|https://api.ashbyhq.com/posting-api/job-board/llamaindex"
)

# Python script to parse Greenhouse feed — args: feed_file role_keywords max_roles
PARSE_GREENHOUSE_PY="$WORKDIR/parse_greenhouse.py"
cat > "$PARSE_GREENHOUSE_PY" << 'PYEOF'
import json, re, sys

feed_file, role_pattern_str, max_roles_str = sys.argv[1], sys.argv[2], sys.argv[3]
role_pattern = re.compile(role_pattern_str, re.IGNORECASE)
max_roles = int(max_roles_str)

with open(feed_file) as f:
    data = json.load(f)

matched = []
for job in data.get("jobs", []):
    title = job.get("title", "")
    if role_pattern.search(title):
        url = job.get("absolute_url", job.get("url", ""))
        if url:
            matched.append(title + "\t" + url)
    if len(matched) >= max_roles:
        break

print("\n".join(matched))
PYEOF

# Python script to parse Ashby feed — same args
PARSE_ASHBY_PY="$WORKDIR/parse_ashby.py"
cat > "$PARSE_ASHBY_PY" << 'PYEOF'
import json, re, sys

feed_file, role_pattern_str, max_roles_str = sys.argv[1], sys.argv[2], sys.argv[3]
role_pattern = re.compile(role_pattern_str, re.IGNORECASE)
max_roles = int(max_roles_str)

with open(feed_file) as f:
    data = json.load(f)

jobs = []
if isinstance(data, list):
    jobs = data
elif isinstance(data, dict):
    jobs = data.get("jobPostings", data.get("jobs", []))

matched = []
for job in jobs:
    title = job.get("title", job.get("jobTitle", ""))
    if role_pattern.search(title):
        url = job.get("applyUrl", job.get("jobUrl", ""))
        job_id = job.get("id", job.get("jobId", ""))
        if not url and job_id:
            url = "https://jobs.ashbyhq.com/llamaindex/" + str(job_id)
        if url:
            matched.append(title + "\t" + url)
    if len(matched) >= max_roles:
        break

print("\n".join(matched))
PYEOF

# Python script to score a job via REST API — args: api_url api_key job_url title company
SCORE_JOB_PY="$WORKDIR/score_job.py"
cat > "$SCORE_JOB_PY" << 'PYEOF'
import json, sys, urllib.request, urllib.error

api_url, api_key, job_url, title, company = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]

payload = json.dumps({"url": job_url, "title": title, "company": company}).encode()
req = urllib.request.Request(api_url, data=payload, method="POST")
req.add_header("Content-Type", "application/json")
req.add_header("X-API-Key", api_key)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        d = json.loads(resp.read())
    data = d["data"]
    score = data["currentScore"]["total"]
    max_score = data["maxPossibleScore"]
    rec = data["recommendation"]
    print(f"OK|{score}|{max_score}|{rec}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    try:
        err_msg = json.loads(body).get("error", {}).get("message", f"HTTP {e.code}")
    except Exception:
        err_msg = f"HTTP {e.code}"
    print(f"ERROR|0|{err_msg}|N/A")
except Exception as e:
    print(f"ERROR|0|{e}|N/A")
PYEOF

# ── Main loop ─────────────────────────────────────────────────────────────────

RESULTS_FILE="$WORKDIR/results.tsv"
: > "$RESULTS_FILE"  # empty the file

TOTAL_FETCHED=0
TOTAL_SCORED=0
ERRORS=0

for feed_def in "${FEEDS[@]}"; do
  company="${feed_def%%|*}"
  rest="${feed_def#*|}"
  ats="${rest%%|*}"
  feed_url="${rest#*|}"

  echo "Fetching: ${company} (${ats})"

  feed_file="$WORKDIR/feed-${company}.json"
  if ! curl -sS --max-time 15 "$feed_url" > "$feed_file" 2>/dev/null; then
    echo "  WARNING: Failed to fetch ${company} feed" >&2
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Check we got valid JSON
  if ! python3 -c "import json,sys; json.load(open('$feed_file'))" 2>/dev/null; then
    echo "  WARNING: Invalid JSON from ${company} feed" >&2
    ERRORS=$((ERRORS + 1))
    continue
  fi

  if [[ "$ats" == "greenhouse" ]]; then
    matching_jobs=$(python3 "$PARSE_GREENHOUSE_PY" "$feed_file" "$ROLE_KEYWORDS" "$MAX_ROLES_PER_COMPANY" 2>/dev/null || true)
  elif [[ "$ats" == "ashby" ]]; then
    matching_jobs=$(python3 "$PARSE_ASHBY_PY" "$feed_file" "$ROLE_KEYWORDS" "$MAX_ROLES_PER_COMPANY" 2>/dev/null || true)
  else
    echo "  WARNING: Unknown ATS type: ${ats}" >&2
    continue
  fi

  if [[ -z "$matching_jobs" ]]; then
    echo "  No matching roles found"
    continue
  fi

  while IFS=$'\t' read -r title job_url; do
    [[ -z "$title" || -z "$job_url" ]] && continue
    TOTAL_FETCHED=$((TOTAL_FETCHED + 1))
    echo "  Scoring: ${title}"

    result=$(python3 "$SCORE_JOB_PY" "$API_URL" "$API_KEY" "$job_url" "$title" "$company" 2>/dev/null || echo "ERROR|0|scoring failed|N/A")

    IFS='|' read -r status score max_or_err rec <<< "$result"

    if [[ "$status" == "OK" ]]; then
      TOTAL_SCORED=$((TOTAL_SCORED + 1))
      case "$rec" in
        strong_fit)                  rec_label="Strong fit" ;;
        marginal_improvement)        rec_label="Marginal" ;;
        full_generation_recommended) rec_label="Gap" ;;
        *)                           rec_label="$rec" ;;
      esac
      printf '%s\t%s\t%s/%s\t%s\t%s\n' "$company" "$title" "$score" "$max_or_err" "$rec_label" "$job_url" >> "$RESULTS_FILE"
    else
      ERRORS=$((ERRORS + 1))
      printf '%s\t%s\tERR\t%s\t%s\n' "$company" "$title" "$max_or_err" "$job_url" >> "$RESULTS_FILE"
    fi
  done <<< "$matching_jobs"
done

echo ""
echo "Done: ${TOTAL_SCORED} scored, ${ERRORS} errors"

# ── Write markdown report ─────────────────────────────────────────────────────

{
  echo "# Job Scoring Results -- ${OUTPUT_DATE}"
  echo ""
  echo "**Endpoint:** \`${API_URL}\`  "
  echo "**Fetched:** ${TOTAL_FETCHED} matching roles  "
  echo "**Scored:** ${TOTAL_SCORED} successfully  "
  echo "**Errors:** ${ERRORS}"
  echo ""
  echo "| Company | Role | Score | Recommendation | Link |"
  echo "|---------|------|-------|----------------|------|"

  while IFS=$'\t' read -r company title score rec url; do
    [[ -z "$company" ]] && continue
    echo "| ${company} | ${title} | ${score} | ${rec} | [view](${url}) |"
  done < "$RESULTS_FILE"
} > "$OUTPUT_FILE"

echo "Report written: ${OUTPUT_FILE}"
