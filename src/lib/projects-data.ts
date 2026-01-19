import type { Project } from '@/types';

export const projectsData: Project[] = [
  {
    id: 'alo-cubano',
    name: 'A Lo Cubano Boulder Fest',
    subtitle: 'Full-stack event management platform for Latin dance festivals',
    description:
      'Complete ticketing and event management system built from scratch to handle multi-tier pricing, payment processing, and attendee check-in.',
    techStack: ['JavaScript', 'Node.js', 'Vercel', 'Stripe', 'Brevo'],
    links: [
      {
        label: 'Live Site',
        url: 'https://alocubanoboulder.com',
        icon: 'external',
      },
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/alo-cubano-boulder-fest',
        icon: 'github',
      },
    ],
    stats: {
      label: 'First Event Results',
      items: [
        '$3,850 gross revenue across 47 tickets sold',
        'QR code check-in system processed all attendees with zero issues',
        '100% email delivery rate via Brevo transactional emails',
      ],
    },
    categories: [
      {
        title: 'Ticketing & Payments',
        items: [
          'Stripe Checkout integration with tiered pricing (Early Bird, Regular, Door)',
          'PayPal support for customers preferring alternative payment methods',
          'Unified cart system supporting multiple ticket types in single transaction',
          'Automatic promo code validation with percentage and fixed discounts',
        ],
      },
      {
        title: 'Attendee Management',
        items: [
          'Unique QR codes generated for each ticket purchase',
          'Real-time check-in dashboard with search and manual override',
          'Duplicate scan prevention with visual/audio feedback',
          'Export attendee lists for venue coordination',
        ],
      },
      {
        title: 'Email Automation',
        items: [
          'Brevo integration for transactional emails',
          'Branded confirmation emails with QR codes and event details',
          'Reminder emails 48 hours before event',
          'Post-event thank you with photo gallery links',
        ],
      },
      {
        title: 'Admin Dashboard',
        items: [
          'Real-time sales analytics and revenue tracking',
          'Ticket inventory management with capacity limits',
          'Promo code creation and usage analytics',
          'Attendee search with purchase history',
        ],
      },
      {
        title: 'Infrastructure',
        items: [
          'Vercel deployment with automatic preview environments',
          'Serverless API routes for payment webhooks',
          'Secure environment variable management',
          'Mobile-responsive admin interface',
        ],
      },
    ],
  },
  {
    id: 'damilola-tech',
    name: 'damilola.tech',
    subtitle: 'AI-powered career landing page',
    description:
      'Personal portfolio with an AI chatbot that answers recruiter questions about experience, skills, and role fit using Claude with full context.',
    techStack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Claude API', 'Vercel'],
    links: [
      {
        label: 'Live Site',
        url: 'https://damilola.tech',
        icon: 'external',
      },
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/damilola.tech',
        icon: 'github',
      },
    ],
    highlights: [
      'Full context window approach - no RAG, entire resume and STAR stories in prompt',
      'Prompt caching enabled for cost and latency optimization',
      'Fit Assessment feature analyzes job descriptions and provides honest match analysis',
      'TDD development with Vitest, React Testing Library, and Playwright',
      'McKinsey-inspired design system with dark mode and accessibility focus',
    ],
  },
  {
    id: 'pipedream-automation',
    name: 'Pipedream Automation Suite',
    subtitle: 'Serverless workflow automation for personal productivity',
    description:
      'Collection of automated workflows connecting various APIs and services to streamline recurring tasks and data synchronization.',
    techStack: ['Pipedream', 'Node.js', 'REST APIs', 'Cron'],
    links: [
      {
        label: 'Pipedream',
        url: 'https://pipedream.com',
        icon: 'external',
      },
    ],
    highlights: [
      'Automated expense tracking from email receipts to spreadsheet',
      'Calendar sync between personal and work accounts with conflict detection',
      'Social media cross-posting with platform-specific formatting',
      'Webhook endpoints for custom integrations with IoT devices',
      'Scheduled data backups with error notification via SMS',
      'API rate limiting and retry logic for reliable execution',
    ],
  },
  {
    id: 'claude-config',
    name: 'Claude Configuration System',
    subtitle: 'Structured AI assistant customization framework',
    description:
      'Personal CLAUDE.md configuration system that defines operating principles, delegation frameworks, and quality standards for Claude Code.',
    techStack: ['Markdown', 'Claude Code', 'Git'],
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/claude-config',
        icon: 'github',
      },
    ],
    highlights: [
      'Binary delegation framework for task classification (direct vs agent delegation)',
      'Orchestration patterns for parallel, pipeline, and analyze-then-execute workflows',
      'Quality gates enforcement - never bypass git hooks or skip tests',
      'Specialized agent routing based on task complexity and domain',
      'Consistent file organization with .tmp/ for working documents',
    ],
  },
];
