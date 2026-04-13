---
title: "Building a Multi-Agent Fleet Dispatch System"
subtitle: "Eight root causes in one incident, and what it taught me about running a dozen LLM agents on one laptop"
date: "2026-04-12"
tags: ["ai-infrastructure", "reliability", "distributed-systems", "post-mortem"]
author: "Damilola Elegbede"
---

## The Setup

I run a fleet of ~12 LLM agents on a single Mac Studio. Each agent has its own
GitHub identity, its own credentials, its own role (frontend, backend, devops,
security, a chief of staff, a distinguished engineer). They coordinate through a
shared state layer — one JSONL activity stream, a few markdown "current state"
files regenerated every 30 minutes by a heartbeat skill, plus Slack, Notion, and
a handful of purpose-built channels. The agents run in three shapes:

- **Long-lived daemons** — `dara-telegram`, `dara-slack`, `clara-telegram` —
  each owns a tmux session, holds a Socket Mode or Bot API client open, and
  dispatches incoming messages into a fresh, ephemeral `claude -p` per turn.
- **Cron-triggered workflows** — hourly execution phases, 4-hour planning
  phases, an hourly heartbeat — scheduled via `launchctl` and fired into a
  target tmux session with `tmux send-keys`.
- **Ad-hoc interactive sessions** — me at the keyboard, talking to any agent
  directly for architecture decisions or one-off work.

Three shapes, one substrate: the tmux session acting as the REPL terminal that
`claude -p` attaches to. That choice — tmux as the universal claude host —
lets one Terminal-rooted process grant TCC permissions (Full Disk Access,
Accessibility, Network) to every cron and daemon that executes inside it. No
keychain prompts mid-run, no permission popups from launchd, no secrets in
plaintext anywhere. It's a beautifully elegant boundary.

It's also a single point of failure with teeth I didn't fully appreciate until
04:02 MT on April 12, 2026.

## The Incident

At 04:02 MT, a planning cron fired a ~6 KB planning prompt into the
`dara-daemon` tmux session. Five minutes later, the hourly execute cron fired
its own prompt into the same session, unaware the planner was still mid-key-send.
Three seconds after that, a third cron piled on. By 04:06 all three jobs were
wedged: tmux had interleaved their keystrokes into a single corrupted blob, and
`claude -p` was trying to parse a prompt that now read, roughly:

```text
/work-session-plan { Scan actiload current-state.md and advance up to 3 ta...
```

The prompt never completed. Claude waited on stdin that was never coming. The
cron wrapper waited on a `DARA_FIRE_DONE` marker that would never be written.
The next scheduled fire saw a lock file, assumed the previous run was still
healthy, and skipped. The one after that: skipped. The one after that: skipped.

I woke up at 11:13 MT to a fleet that had silently gone dark seven hours earlier.

## Eight Root Causes

The post-incident investigation turned up **eight distinct root causes**, all
contributing. This is the part that mattered most — not the fix, but
understanding that a single user-visible failure mode ("fleet is silent") had
nothing to do with any one bug. It was a stack.

### 1. `tmux send-keys` corrupts multi-KB payloads

tmux is a terminal multiplexer. `send-keys` shoves characters into a pty
read buffer. It was never designed to deliver atomic multi-KB payloads — it
has no transactional boundary. A 6 KB prompt takes tmux ~40 ms to deliver;
any other `send-keys` call within that window gets interleaved byte-for-byte.

### 2. No dispatch serialization

I had `flock` guarding a sentinel file, but only around the final marker-write
step — not around the `send-keys` call itself. Two jobs could race into
`send-keys` concurrently and both "succeed."

### 3. The lock file semantics lied

The session-level lock file was supposed to mean "a run is in flight." But
since runs wedged mid-prompt, the lock persisted indefinitely. The lock
semantically meant "we started a run and didn't crash cleanly" — which in a
wedged-process world is forever.

### 4. Heartbeat idleness detection was blind

The heartbeat skill wrote a timestamp every 30 minutes. A watchdog checked
that the timestamp was fresh. But when the heartbeat *process itself* had
wedged inside a jammed dispatch, the timestamp never updated, and the
watchdog's `except` block swallowed the resulting parse error as "file doesn't
exist yet — can't fire an alert on first boot."

### 5. `bash 3.2` silently converts empty array expansions to size 1

macOS still ships bash 3.2 in 2026. `"${arr[@]:-}"` on an empty array expands
to a single empty string, not zero elements. My "no heartbeat events" branch
checked `[ ${#errors[@]} -gt 0 ]`, got 1 (for the empty-string element),
wrote an event signifying "things went wrong," and the alert fell on the
floor because the event's body was empty.

### 6. Subshell `$$` is parent PID in bash 3.2

I was using `$$` inside `$(...)` subshells to generate per-run IDs. In bash
3.2, `$$` always returns the parent shell's PID. Two concurrent runs got
identical IDs and stomped each other's state files. I've since fixed this to
`$$.${RANDOM}` — ugly but correct.

### 7. perl `alarm(); exec` is unreliable for Node.js child processes

My wedge-recovery logic used `perl -e 'alarm(30); exec("node", ...)'` to
time out hung Node processes. Turns out perl's `alarm()` signal doesn't
always reach Node's event loop in time — SIGALRM hits perl, perl is blocked
waiting on the exec'd child, child keeps running past the deadline.

### 8. Out-of-band monitoring was in-band

My "dead-man's switch" monitor — the thing that was supposed to scream when
the fleet went silent — lived in the same tmux session as the fleet itself.
When dispatch wedged, the monitor wedged. A watchdog that shares substrate
with the thing it watches fails with it.

## The Fix

Each root cause got a targeted fix, most under ten lines. Taken together:

- `send-keys` payloads dropped from 6 KB to ~200 bytes by writing the actual
  prompt to a temp file and passing the filename — tmux only has to deliver
  the path.
- A single shared `flock` wraps the entire dispatch transaction, not just the
  marker write. No two jobs can race into `send-keys`.
- The lock file gained a stale-age override: locks older than 90 minutes are
  forcibly broken with an audit-log event, because "wedged process" beats
  "never runs again."
- The watchdog's exception handler now distinguishes "file never existed"
  (first boot, ok) from "file exists but can't parse" (something is actively
  wrong, escalate).
- Every bash 3.2 gotcha that burned me got a memory note and a lint rule.
- The out-of-band dead-man's switch is moving to healthchecks.io this week —
  an external service pinged on every heartbeat, paging me if the ping
  stops. If my fleet wedges, something outside my fleet notices.

## What It Taught Me

Three lessons, in decreasing order of transferability:

**Infrastructure has to fail loudly.** Silent failure modes kill fleets. The
second-worst thing about this incident was that it ran for seven hours before
I noticed. The worst is that all eight root causes were visible in the state
files — I just didn't have an alert that would have told me.

**Every watchdog needs an out-of-process fallback in a disjoint failure
domain.** If your monitor and the thing it monitors share a process tree,
a filesystem, a tmux session, a keychain, a power supply — it is not really
a second opinion. It's a second copy of the same opinion. I'd known this
intellectually. I now know it viscerally.

**Root-causing deep stacks is a staff+ skill and it compounds.** The eight
root causes didn't all surface in the first pass — I thought I'd found it at
three, at five, at seven. What kept me going was a discipline of writing each
candidate cause in a scratch file with a one-line test that would have caught
it in isolation, then asking "if I'd only had this fix, would the incident
still have happened?" Four times out of eight, the answer was yes. That's
the signal to keep digging.

## The Compounding Part

The reason I'm writing this post is that this fleet is, for me, a compounding
platform. Every incident I survive gets turned into two things: a fix, and a
memory note that the next incarnation of any agent in the fleet inherits the
moment it boots. The `dara-fleet-gotchas.md` file is at sixteen entries now.
Four of them came from this incident. They are all one-sentence rules in the
form "if you see *shape of thing*, check *specific cause* before anything
else." They are cheap to write, cheap to read, and they compound: every
future agent I spawn already knows about bash 3.2's empty-array trap,
already knows not to trust tmux's atomicity, already knows that watchdogs
must live elsewhere.

That's the thesis, really. Infrastructure work is unglamorous, but the
agents I build on top of it get smarter every week because the substrate
gets harder to break. In a year, the fleet will be boring. That is what
"boring" means for AI infrastructure: wedges you don't notice because they
don't happen, not because the alerts are broken.
