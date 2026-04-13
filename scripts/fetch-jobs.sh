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
#   - DAMILOLA_SCORE_API_KEY env var: a dk_live_* key, sourced from the Vercel
#     project environment variables (never commit keys, never paste live keys
#     into shell history or config files)
#   - curl, jq, python3 (all standard on macOS)
#   - damilola.tech PR #118 merged to production (score_job endpoint live)
#   - score_job endpoint supports optional `job_content` body field so the server
#     can skip the URL fetch (required because Greenhouse/Ashby anti-bot blocks
#     server-side scraping). This script pre-fetches each job's HTML from the
#     ATS feed and forwards it as `job_content`.
#
# Secret policy (repo rule):
#   - API keys live in Vercel environment variables ONLY. Do not commit them.
#   - Career/STAR/sensitive narrative data lives in Vercel Blob ONLY. Never
#     commit career-data content to this public repo.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

API_KEY="${DAMILOLA_SCORE_API_KEY:-}"
API_URL="${SCORE_JOB_API_URL:-https://www.damilola.tech/api/v1/score-job}"
OUTPUT_DATE=$(date +%Y-%m-%d)
OUTPUT_FILE=".tmp/analysis/scored-jobs-${OUTPUT_DATE}.md"
MAX_ROLES_PER_COMPANY=5
ROLE_KEYWORDS="staff engineer|principal engineer|senior staff|distinguished|infrastructure engineer|platform engineer|ai engineer|ml engineer|machine learning|backend engineer|software engineer|senior engineer|staff software"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/fetch-jobs.XXXXXX")"

# ── Preflight ─────────────────────────────────────────────────────────────────

if [[ -z "$API_KEY" ]]; then
  echo "ERROR: DAMILOLA_SCORE_API_KEY is not set." >&2
  echo "  Export it: export DAMILOLA_SCORE_API_KEY=dk_live_..." >&2
  exit 1
fi

if [[ "$API_KEY" != dk_* ]]; then
  echo "ERROR: DAMILOLA_SCORE_API_KEY must start with 'dk_'." >&2
  echo "  Valid keys are minted via the damilola.tech admin UI; export a dk_ token." >&2
  exit 1
fi

for cmd in curl python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found" >&2
    exit 1
  fi
done

mkdir -p .tmp/analysis "$WORKDIR"
chmod 700 "$WORKDIR"
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

# Python script to parse Greenhouse feed — args: feed_file role_keywords max_roles out_dir
# Writes one <out_dir>/job-<n>.json per matching role with {title, url, content} and
# prints "<json_path>\t<title>\t<url>" lines on stdout (tab-separated for easy bash read).
PARSE_GREENHOUSE_PY="$WORKDIR/parse_greenhouse.py"
cat > "$PARSE_GREENHOUSE_PY" << 'PYEOF'
import json, os, re, sys

feed_file, role_pattern_str, max_roles_str, out_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
role_pattern = re.compile(role_pattern_str, re.IGNORECASE)
max_roles = int(max_roles_str)

with open(feed_file) as f:
    data = json.load(f)

matched = 0
for job in data.get("jobs", []):
    title = str(job.get("title") or "")
    if not role_pattern.search(title):
        continue
    url = str(job.get("absolute_url") or job.get("url") or "")
    if not url:
        continue
    # Greenhouse ?content=true returns HTML-escaped job description in "content" field
    raw_content = job.get("content")
    content = raw_content if isinstance(raw_content, str) else ""
    out_path = os.path.join(out_dir, f"job-{matched}.json")
    with open(out_path, "w") as out:
        json.dump({"title": title, "url": url, "content": content}, out)
    print(f"{out_path}\t{title}\t{url}")
    matched += 1
    if matched >= max_roles:
        break
PYEOF

# Python script to parse Ashby feed — args: feed_file role_keywords max_roles out_dir
# Ashby job-board API returns {title, jobUrl, descriptionHtml, descriptionPlain, ...}
# Writes one JSON per matching role and prints "<json_path>\t<title>\t<url>" lines.
PARSE_ASHBY_PY="$WORKDIR/parse_ashby.py"
cat > "$PARSE_ASHBY_PY" << 'PYEOF'
import json, os, re, sys

feed_file, role_pattern_str, max_roles_str, out_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
role_pattern = re.compile(role_pattern_str, re.IGNORECASE)
max_roles = int(max_roles_str)

with open(feed_file) as f:
    data = json.load(f)

jobs = []
if isinstance(data, list):
    jobs = data
elif isinstance(data, dict):
    jobs = data.get("jobPostings", data.get("jobs", []))

matched = 0
for job in jobs:
    title = str(job.get("title") or job.get("jobTitle") or "")
    if not role_pattern.search(title):
        continue
    url = str(job.get("applyUrl") or job.get("jobUrl") or "")
    job_id = job.get("id", job.get("jobId", ""))
    if not url and job_id:
        url = "https://jobs.ashbyhq.com/llamaindex/" + str(job_id)
    if not url:
        continue
    # Ashby exposes HTML or plain text description directly in the feed
    raw_content = (
        job.get("descriptionHtml")
        or job.get("descriptionPlain")
        or job.get("description")
    )
    content = raw_content if isinstance(raw_content, str) else ""
    out_path = os.path.join(out_dir, f"job-ashby-{matched}.json")
    with open(out_path, "w") as out:
        json.dump({"title": title, "url": url, "content": content}, out)
    print(f"{out_path}\t{title}\t{url}")
    matched += 1
    if matched >= max_roles:
        break
PYEOF

# Python script to score a job via REST API.
# Args: api_url job_url title company [content_json_file]
# When content_json_file is provided, its "content" field is forwarded to the endpoint
# as job_content so the server can skip the URL fetch (required for Greenhouse/Ashby
# anti-bot blocking).
SCORE_JOB_PY="$WORKDIR/score_job.py"
cat > "$SCORE_JOB_PY" << 'PYEOF'
import json, os, sys, time, urllib.request, urllib.error

api_url, job_url, title, company = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
content_file = sys.argv[5] if len(sys.argv) > 5 else ""
api_key = os.environ["DAMILOLA_SCORE_API_KEY"]

body = {"url": job_url, "title": title, "company": company}
if content_file and os.path.exists(content_file):
    with open(content_file) as f:
        job_meta = json.load(f)
    content = job_meta.get("content")
    if isinstance(content, str) and content.strip():
        body["job_content"] = content

payload = json.dumps(body).encode()
req = urllib.request.Request(api_url, data=payload, method="POST")
req.add_header("Content-Type", "application/json")
req.add_header("X-API-Key", api_key)

for attempt in range(3):
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            d = json.loads(resp.read())
        data = d["data"]
        score = data["currentScore"]["total"]
        max_score = data["maxPossibleScore"]
        rec = data["recommendation"]
        print(f"OK|{score}|{max_score}|{rec}")
        break
    except urllib.error.HTTPError as e:
        if e.code == 429 and attempt < 2:
            raw_retry_after = e.headers.get("Retry-After", "60")
            try:
                retry_after = max(1, int(raw_retry_after))
            except (TypeError, ValueError):
                retry_after = 60
            time.sleep(retry_after)
            continue
        body = e.read().decode()
        try:
            err_msg = json.loads(body).get("error", {}).get("message", f"HTTP {e.code}")
        except Exception:
            err_msg = f"HTTP {e.code}"
        print(f"ERROR|0|{err_msg}|N/A")
        break
    except Exception as e:
        print(f"ERROR|0|{e}|N/A")
        break
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
  if ! curl -fsS --max-time 15 "$feed_url" > "$feed_file" 2>/dev/null; then
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

  jobs_dir="$WORKDIR/jobs-${company}"
  mkdir -p "$jobs_dir"

  if [[ "$ats" == "greenhouse" ]]; then
    if ! matching_jobs=$(python3 "$PARSE_GREENHOUSE_PY" "$feed_file" "$ROLE_KEYWORDS" "$MAX_ROLES_PER_COMPANY" "$jobs_dir" 2>/dev/null); then
      echo "  WARNING: Failed to parse ${company} feed" >&2
      ERRORS=$((ERRORS + 1))
      continue
    fi
  elif [[ "$ats" == "ashby" ]]; then
    if ! matching_jobs=$(python3 "$PARSE_ASHBY_PY" "$feed_file" "$ROLE_KEYWORDS" "$MAX_ROLES_PER_COMPANY" "$jobs_dir" 2>/dev/null); then
      echo "  WARNING: Failed to parse ${company} feed" >&2
      ERRORS=$((ERRORS + 1))
      continue
    fi
  else
    echo "  WARNING: Unknown ATS type: ${ats}" >&2
    ERRORS=$((ERRORS + 1))
    continue
  fi

  if [[ -z "$matching_jobs" ]]; then
    echo "  No matching roles found"
    continue
  fi

  while IFS=$'\t' read -r content_file title job_url; do
    [[ -z "$title" || -z "$job_url" ]] && continue
    TOTAL_FETCHED=$((TOTAL_FETCHED + 1))
    echo "  Scoring: ${title}"

    result=$(DAMILOLA_SCORE_API_KEY="$API_KEY" python3 "$SCORE_JOB_PY" "$API_URL" "$job_url" "$title" "$company" "$content_file" 2>/dev/null || echo "ERROR|0|scoring failed|N/A")

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
    safe_company="${company//|/\\|}"
    safe_title="${title//|/\\|}"
    safe_rec="${rec//|/\\|}"
    echo "| ${safe_company} | ${safe_title} | ${score} | ${safe_rec} | [view](${url}) |"
  done < "$RESULTS_FILE"
} > "$OUTPUT_FILE"

echo "Report written: ${OUTPUT_FILE}"
