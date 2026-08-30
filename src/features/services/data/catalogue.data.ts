import type { Service } from '@/types'

/**
 * The service catalogue.
 *
 * Titles, descriptions, prices, icons, badges and feature lists below are
 * transcribed from inspiration/home.png and
 * inspiration/services(iPhone 14 Pro Max).png — they are content, not invented
 * placeholder copy.
 *
 * Owned by the Services feature because both Home and Services render from it
 * (SCREEN-MAP.md → Services → Relationship between categories). Services renders
 * the full list; Home renders a curated subset through the same card
 * components.
 */

/**
 * Core services, in the order verified on the Services capture.
 *
 * The first six are the set Home also renders, in the same order and at the
 * same prices. Entries 7–12 appear only on Services: the capture shows one
 * continuous list under a single "Core Services" heading rather than a separate
 * "additional catalogue" section. Every title, description, price and badge
 * below was read off the capture. [VERIFIED]
 */
export const CORE_SERVICES: readonly Service[] = [
  {
    id: 'tech-maintenance',
    title: 'Tech Maintenance',
    description:
      'Professional tech maintenance service providing regular updates, quick fixes, security monitoring, and reliable support to keep your systems running smoothly.',
    price: 849,
    tier: 'core',
    icon: 'wrench',
  },
  {
    id: 'fintech-partner',
    title: 'Fintech Partner',
    description:
      'Trusted fintech partner delivering secure, scalable financial technology solutions, seamless integrations, compliance support, and continuous innovation to drive business growth.',
    price: 499,
    tier: 'core',
    icon: 'card',
  },
  {
    id: 'collection-partner',
    title: 'Collection Partner',
    description:
      'Reliable collection partner providing efficient recovery solutions, ethical follow-ups, transparent reporting, and improved cash flow while maintaining strong customer relationships.',
    price: 999,
    tier: 'core',
    icon: 'box',
  },
  {
    id: 'software-orchestration',
    title: 'Software Orchestration',
    description:
      'Software orchestration enables seamless coordination of applications, services, and workflows to automate processes, improve scalability, and ensure smooth system operations.',
    price: 899,
    tier: 'core',
    icon: 'sync',
  },
  {
    id: 'cyber-security-basics',
    title: 'Cyber & Security Basics',
    description:
      'Cybersecurity basics focus on protecting systems, networks, and data from digital threats through secure practices, awareness, and essential defense technologies.',
    price: 499,
    tier: 'core',
    icon: 'shield',
  },
  {
    id: 'data-automation-basics',
    title: 'Data & Automation Basics',
    description:
      'Data and automation basics cover collecting and analyzing data, automating repetitive tasks, and using insights to improve efficiency, accuracy, and decision-making.',
    price: 999,
    tier: 'core',
    icon: 'chart',
  },
  {
    id: 'business-consulting',
    title: 'Business Consulting',
    description:
      'Strategic business consulting focused on solving real challenges, improving operations, and accelerating growth. From market positioning and sales strategy to process optimization.',
    price: 899,
    tier: 'core',
    icon: 'target',
  },
  {
    id: 'branding-content',
    title: 'Branding & Content',
    description:
      'Build a powerful brand presence with strategic design and engaging content. From visuals and messaging to social media and ad creatives, we help you stand out and drive consistent growth.',
    price: 499,
    tier: 'core',
    icon: 'palette',
    // The only badged card in the capture — a gradient pill in the top-right.
    badge: 'POPULAR',
  },
  {
    id: 'ai-automation',
    title: 'AI & Automation',
    description:
      'Streamline your business with intelligent AI and automation solutions. From chatbots and CRM workflows to data-driven systems, we help you reduce manual work, improve efficiency, and scale operations effortlessly.',
    price: 999,
    tier: 'core',
    icon: 'bot',
  },
  {
    id: 'website-security-audit',
    title: 'Website Security Audit',
    description:
      'Protect your website from security threats, vulnerabilities, and malware. Our comprehensive security audit identifies weaknesses in your WordPress or WooCommerce site with actionable recommendations.',
    // The cheapest entry, matching Home's "Starting from ₹149".
    price: 149,
    tier: 'core',
    icon: 'lock',
  },
  {
    id: 'seo-audit-service',
    title: 'SEO Audit Service',
    description:
      'Get a complete SEO health check for your website. Identifies technical issues, on-page optimization gaps, performance bottlenecks, and ranking opportunities with a detailed actionable report.',
    price: 349,
    tier: 'core',
    icon: 'seo',
  },
  {
    id: 'ai-automation-advanced',
    title: 'AI & Automation Advanced',
    description:
      'Advanced AI and automation solutions for complex operations. Custom CRM integrations, data pipeline automation, and intelligent workflow systems designed to scale your business operations.',
    price: 999,
    tier: 'core',
    icon: 'bolt',
  },
]

/**
 * The subset Home renders under "Our Core Services" — the first six entries, in
 * the order verified on inspiration/home.png. Services renders CORE_SERVICES in
 * full, so this slice is what keeps the two pages from duplicating data.
 */
export const HOME_CORE_SERVICES: readonly Service[] = CORE_SERVICES.slice(0, 6)

/**
 * Website & digital micro-services.
 *
 * The first four are fully verified. "Cloud & Hosting" is cut off by the
 * 16384px capture ceiling mid-card: its title, subtitle and first two features
 * are verified, but its third feature and price are **inferred** — the capture
 * never reached them (REFERENCE-LIMITATIONS.md → Screenshot Truncation).
 */
export const MICRO_SERVICES: readonly Service[] = [
  {
    id: 'website-health-check',
    title: 'Website Health Check',
    description: 'A focused audit of the speed, search and security basics of your site.',
    subtitle: 'Speed, SEO & Security',
    features: [
      'Broken Link Check & Fix (basic)',
      'Mobile Responsiveness Audit',
      'SSL Installation Assistance',
    ],
    price: 999,
    tier: 'micro',
    icon: 'audit',
  },
  {
    id: 'tech-support-maintenance',
    title: 'Tech Support & Maintenance',
    description: 'Hands-on fixes and updates that keep an existing site running.',
    subtitle: 'Keep it running smooth',
    features: [
      'One-Time Website Error Fix (minor)',
      'Plugin / Theme Update Service',
      'CMS Login & Access Recovery',
    ],
    price: 999,
    tier: 'micro',
    icon: 'support',
  },
  {
    id: 'api-tech-integrations',
    title: 'API & Tech Integrations',
    description: 'Connect payments and third-party services to your product.',
    subtitle: 'Starter package',
    features: [
      'Payment Gateway Integration Review',
      'API Connectivity Check',
      'Webhook Setup (Basic)',
    ],
    price: 799,
    tier: 'micro',
    icon: 'integration',
  },
  {
    id: 'app-ui-support',
    title: 'App & UI Support',
    description: 'Audit and triage the interface issues affecting your app.',
    subtitle: 'Fix & audit your app',
    features: ['UI Bug Reporting (Audit)', 'App Crash Log Review (Basic)', 'Screen Flow Review'],
    price: 650,
    tier: 'micro',
    icon: 'app',
  },
  {
    id: 'cloud-hosting',
    title: 'Cloud & Hosting',
    description: 'Right-size your hosting and get the domain configuration right.',
    subtitle: 'Optimize your infrastructure',
    features: [
      'Hosting Comparison & Recommendation',
      'Domain & DNS Configuration Help',
      // [INFERRED] The capture is truncated before the third feature.
      'Server Performance Review (Basic)',
    ],
    // [INFERRED] Price never rendered — sits within the ₹650–₹999 micro-service band.
    price: 899,
    tier: 'micro',
    icon: 'cloud',
  },
]

/** Every catalogue entry in page order: core offerings, then micro-services. */
export const ALL_SERVICES: readonly Service[] = [...CORE_SERVICES, ...MICRO_SERVICES]

/**
 * Total catalogue size, stated by Home's "Explore all 18 services" link.
 *
 * The transcribed entries come to 17 (12 core + 5 micro). The 18th sits below
 * the 16384px capture ceiling on both Home and Services, so rather than invent
 * a service to pad the list, the stated total stays the advertised figure and
 * the catalogue holds only what the captures actually show
 * (REFERENCE-LIMITATIONS.md → Screenshot Truncation).
 */
export const CATALOGUE_SIZE = 18
