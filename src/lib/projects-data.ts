import type { Project } from "@/types";

export const projectsData: Project[] = [
  {
    id: "cortex-agent-fleet",
    name: "Cortex Agent Fleet",
    subtitle: "Production multi-agent AI system with autonomous task orchestration",
    description:
      "Designed and operate a production multi-agent AI system with 7+ specialized AI agents (coordinator, frontend, backend, devops, security, QA, docs), autonomous work sessions driven by launchd cron (Execute + Plan phases), and a cohesion architecture based on semantic event streaming (activity.jsonl). Built to be observable, fault-tolerant, and operationally self-sufficient.",
    techStack: [
      "Claude SDK",
      "Next.js",
      "TypeScript",
      "Notion API",
      "Slack API",
      "GitHub App",
      "launchd",
      "tmux",
      "zsh",
    ],
    links: [
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede-org/cortex",
        icon: "github",
      },
      {
        label: "Activity",
        url: "/projects/cortex/activity",
        icon: "external",
      },
    ],
    highlights: [
      "Activity stream as cross-session memory primitive: semantic events shared across all components, no live shared memory",
      "Fault-tolerant cron dispatch: solved multi-KB tmux send-keys corruption under concurrent load via temp-script + flock model, N=10 stress-tested clean",
      "Per-agent GitHub App identity: installation tokens minted per-invocation, age-encrypted at rest, never shared across agents",
      "Observable by design: heartbeat JSONL, session markdown logs, semantic activity stream with 15+ event types",
      "Two-phase autonomous work cycle: Plan phase (task creation, Backlog\u2192Ready promotion) + Execute phase (advance up to 3 tasks/run, PR follow-through gate)",
      "Production incident: diagnosed 7h11m dual-fleet cron outage (2026-04-10) via activity stream divergence; root cause fixed and stress-tested in same incident window",
    ],
    stats: {
      label: "System Scale",
      items: [
        "7+ specialized AI agents with domain-isolated toolsets and distinct GitHub App identities",
        "4 launchd cron jobs: execute (hourly), plan (4x/day), PR digest (2x/day), heartbeat (every 30min)",
        "2 long-lived daemons: Telegram DM handler, Slack event listener (Socket Mode)",
      ],
    },
    categories: [
      {
        title: "Orchestration Architecture",
        items: [
          "Coordinator agent (Dara): architects, delegates, verifies \u2014 never implements directly",
          "Specialist agents: domain-isolated toolsets, strict file ownership to prevent conflicts",
          "Analyzer agents: read-only (code-reviewer, security-auditor) \u2014 cannot write code or open PRs",
          "Two-phase autonomy: Plan phase creates tasks; Execute phase advances them \u2014 never mixed",
        ],
      },
      {
        title: "Observability & Cohesion",
        items: [
          "activity.jsonl: append-only semantic event log, 15+ event types at medium granularity",
          "current-state.md: rolling 30-min regenerated fleet summary (heartbeat skill)",
          "Cross-session memory: every component reads activity stream + current-state at startup",
          "Heartbeat monitoring: silent on success, alerts to Slack + Telegram on anomaly",
        ],
      },
      {
        title: "Fault Tolerance",
        items: [
          "Lock file protocol: started_epoch + 90-min expiry + unconditional release \u2014 no hung locks",
          "Cron dispatch: temp-script model + flock serialization prevents concurrent send-keys corruption",
          "Out-of-band monitoring: heartbeat in disjoint launchd process from monitored components",
          "Queue-based dispatch: P1 rollout replaces direct tmux with durable queue (2026-04-11)",
        ],
      },
      {
        title: "Security & Identity",
        items: [
          "10 distinct GitHub App identities; per-agent installation tokens, never shared",
          "age encryption for all credentials at rest; decrypted per-invocation only",
          "Wrapper scripts as sole auth path: no bare curl against external APIs",
          "gitleaks gate on every PR: blocks merge if secrets detected in diff",
        ],
      },
    ],
  },
  {
    id: "forge-intel",
    name: "Forge Intel",
    subtitle: "AI-powered competitive intelligence and job matching platform",
    description:
      "Production agent intelligence pipeline: scrapes, scores, and ranks job postings against D's profile using Claude. Built with audit trails, validate-briefs CI workflow, and SECURITY.md-gated deployment.",
    techStack: ["TypeScript", "Claude API", "GitHub Actions", "Node.js"],
    links: [
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede-org/forge-intel",
        icon: "github",
      },
    ],
    highlights: [
      "Claude-powered scoring: 100-point rubric across role alignment, company mission, location, career ceiling",
      "Batch processing: scores 20 roles per run with structured JSON output and audit trail",
      "CI pipeline: validate-briefs workflow enforces schema on all agent task briefs",
      "Production hardening: SECURITY.md, post-merge runbook, branch protection rules",
    ],
  },
  {
    id: "fleet-incident-2026-04-10",
    name: "Fleet-Wide Outage: Root Cause & Fix",
    subtitle: "Production incident response \u2014 7h11m dual-fleet cron outage, diagnosed and resolved",
    description:
      "A case study in AI system reliability: silent 7-hour outage across two autonomous agent fleets (Dara + Clara). Three distinct tmux send-keys failure modes converged simultaneously. Diagnosed via semantic activity stream analysis. Fixed, tested to N=10 concurrent fires, and hardened with queue-based dispatch.",
    techStack: ["Shell", "tmux", "launchd", "flock", "Python", "zsh"],
    links: [],
    highlights: [
      "Root cause: multi-KB payload corruption + concurrent-race + single-shot drop in tmux send-keys across 9 cron jobs",
      "Diagnosis: activity.jsonl stream divergence between fleets revealed failure modes invisible to error logs",
      "Fix: temp-script model (write to file, send filename) + flock serialization + pre-send guard",
      "Verification: N=10 concurrent dara-fire.sh stress test, all clean; Clara wedge-probe added",
      "Follow-up: queue-based dispatch (Stage 2) deployed 2026-04-11 \u2014 removes tmux as scaling ceiling",
      "Cross-fleet coordination: dara-slack listener (alive throughout) carried Clara's handoff to fresh ephemeral instance \u2014 first real stress test of cohesion architecture",
    ],
  },
  {
    id: "alo-cubano",
    name: "A Lo Cubano Boulder Fest",
    subtitle: "Full-stack event management platform for Latin dance festivals",
    description:
      "Complete ticketing and event management system built from scratch to handle multi-tier pricing, payment processing, and attendee check-in.",
    techStack: ["JavaScript", "Node.js", "Vercel", "Stripe", "Brevo", "Turso"],
    links: [
      {
        label: "Live Site",
        url: "https://alocubanoboulderfest.org",
        icon: "external",
      },
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/alocubano.boulderfest",
        icon: "github",
      },
    ],
    stats: {
      label: "Technical Achievements",
      items: [
        "451K lines of code across 931 JavaScript files",
        "3,229 tests at 92% coverage with 71 DB migrations",
        "Significant revenue processed at inaugural event",
      ],
    },
    highlights: [
      "Circuit breaker pattern with automatic database failover and health monitoring",
      "Multi-tier caching (Redis L2 + Memory L1) with intelligent promotion",
      "Live scoring system with real-time WebSocket updates for competitions",
      "3-tier disaster recovery: PITR (24h) + daily backups (30d) + monthly snapshots",
      "Apple Wallet and Google Wallet pass generation with JWT-based QR codes",
    ],
    categories: [
      {
        title: "Ticketing & Payments",
        items: [
          "Stripe Checkout integration with tiered pricing (Early Bird, Regular, Door)",
          "PayPal support for customers preferring alternative payment methods",
          "Unified cart system supporting multiple ticket types in single transaction",
          "Automatic promo code validation with percentage and fixed discounts",
        ],
      },
      {
        title: "Attendee Management",
        items: [
          "Unique QR codes generated for each ticket purchase",
          "Real-time check-in dashboard with search and manual override",
          "Duplicate scan prevention with visual/audio feedback",
          "Export attendee lists for venue coordination",
        ],
      },
      {
        title: "Email Automation",
        items: [
          "Brevo integration for transactional emails",
          "Branded confirmation emails with QR codes and event details",
          "Reminder emails 48 hours before event",
          "Post-event thank you with photo gallery links",
        ],
      },
      {
        title: "Admin Dashboard",
        items: [
          "Real-time sales analytics and revenue tracking",
          "Ticket inventory management with capacity limits",
          "Promo code creation and usage analytics",
          "Attendee search with purchase history",
        ],
      },
      {
        title: "Infrastructure",
        items: [
          "Vercel deployment with automatic preview environments",
          "Serverless API routes for payment webhooks",
          "Secure environment variable management",
          "Mobile-responsive admin interface",
        ],
      },
      {
        title: "Mobile & Security",
        items: [
          "Apple Wallet and Google Wallet pass generation",
          "JWT-based QR codes with dual caching (24h HTTP + 7d client)",
          "Three-tier database backup strategy with Turso PITR",
        ],
      },
    ],
  },
  {
    id: "damilola-tech",
    name: "Personal Website for Damilola Elegbede",
    subtitle: "This site — AI-powered career landing page",
    description:
      "Personal portfolio with an AI chatbot that answers recruiter questions about experience, skills, and role fit using Claude with full context.",
    techStack: [
      "Next.js",
      "TypeScript",
      "Tailwind CSS",
      "Claude API",
      "Vercel",
    ],
    links: [
      {
        label: "Live Site",
        url: "https://damilola.tech",
        icon: "external",
      },
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/damilola.tech",
        icon: "github",
      },
    ],
    stats: {
      label: "Technical Metrics",
      items: [
        "13K source LOC with 48% test-to-code ratio",
        "34 unit tests + 6 E2E suites across 5 browsers",
        "36 React components with 21 API routes (12 public + 9 admin)",
      ],
    },
    highlights: [
      "Full-context LLM (no RAG) with Anthropic prompt caching for cost optimization",
      "Production admin portal: JWT auth, 10 pages, real-time analytics dashboard",
      "Distributed rate limiting: Redis + circuit breaker with graceful degradation",
      "Comprehensive audit system: 18 event types with IP anonymization",
      "Recruiter-ready resume generator: Claude-powered tailoring with PDF export",
      "Security hardening: CSRF, SSRF prevention, timing-safe comparisons",
      "UTM traffic tracking: Full attribution with source/medium/campaign analytics",
      "Private content submodule: Git submodule with Vercel Blob sync workflows",
      "Deterministic resume scoring: Reproducible algorithm with weighted criteria",
    ],
  },
  {
    id: "pipedream-automation",
    name: "Pipedream Automation Suite",
    subtitle: "AI-powered productivity automation with bidirectional sync",
    description:
      "10 production workflows with custom CI/CD pipeline (1,634 LOC) solving Pipedream\u0027s missing deployment API. AI-powered task prioritization using Claude Opus 4.5.",
    techStack: [
      "Python",
      "Playwright",
      "Claude API",
      "Notion API",
      "Gmail API",
      "Pipedream",
    ],
    links: [
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/pipedream-automation",
        icon: "github",
      },
    ],
    stats: {
      label: "Technical Metrics",
      items: [
        "10 workflows with 8,620 LOC across 40 Python files",
        "6 APIs integrated with 60%+ test coverage enforced",
        "Custom deployment engine: 2,678 LOC browser automation",
      ],
    },
    highlights: [
      "Built CI/CD when vendor has no API: Playwright automation with Google SSO",
      "AI task scoring using Claude Opus 4.5 with batch processing (40 tasks/batch)",
      "Production resilience: 4 different rate limit strategies across services",
      "Bidirectional sync: Gmail/Notion/Tasks/Calendar with idempotency guarantees",
      "ThreadPoolExecutor parallelization: 6 Claude workers, 10 Notion workers",
    ],
  },
  {
    id: "claude-config",
    name: "Claude Configuration System",
    subtitle: "Enterprise-grade AI assistant customization framework",
    description:
      "Production AI orchestration framework: 12 agents (consolidated from 31) achieving 4-6x performance through multi-instance parallelization.",
    techStack: [
      "YAML",
      "Markdown",
      "Python",
      "Shell",
      "Claude Code",
      "GitHub Actions",
    ],
    links: [
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/claude-config",
        icon: "github",
      },
    ],
    stats: {
      label: "Framework Scale",
      items: [
        "107K+ lines with 80 automation scripts",
        "12 agents, 20 commands, 17 skills, 85+ docs",
        "Substantial performance improvement via multi-instance parallelization",
      ],
    },
    highlights: [
      "Strategic consolidation: 31 agents merged to 12 while maintaining full functionality",
      "SYSTEM BOUNDARY security architecture prevents unauthorized agent escalation",
      "Thinking-level calibration: ultrathink tokens (31,999) for complex reasoning",
      "One-command deployment (/sync) with automatic backup and rollback",
      "Three-tier execution model: Direct, Skills, Agents for optimal efficiency",
      "Composable workflows: /ship-it supports flags (-d -t -c -r -p -pr)",
    ],
  },
];
