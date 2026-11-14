import { ROUTES } from '@/routes/paths'
import type { HomeContent } from '../types/home.types'

/**
 * Home page copy.
 *
 * Every string is transcribed from inspiration/home.png — headings, sub-copy,
 * CTA labels and the social-proof line are all verified against the capture.
 * Kept out of JSX so the components stay presentational (AGENTS.md §13).
 */
export const HOME_CONTENT: HomeContent = {
  hero: {
    // "EST. 2020" removed: no incorporation evidence in the repo (audit §4.7).
    eyebrow: 'NOIDA, INDIA',
    headline: 'We build the digital backbone of your',
    // Gradient + italic — the only italic in the system.
    headlineAccent: 'business.',
    description:
      'From SEO and security audits to maintenance and AI automation, Authentic Media delivers fixed-price IT and digital services for businesses — ordered online and delivered remotely by our team.',
    primaryCta: { label: 'See Our Services', to: ROUTES.services },
    secondaryCta: { label: 'Talk to Us', to: ROUTES.contact },
  },

  coreServices: {
    eyebrow: 'WHAT WE OFFER',
    title: 'Our Core',
    titleAccent: 'Services',
    description:
      'End-to-end digital services tailored for modern businesses — from branding to AI automation. Starting from ₹149.',
  },

  microServices: {
    eyebrow: 'QUICK FIXES & MORE',
    title: 'Website & Digital',
    titleAccent: 'Micro-Services',
    description:
      'Focused, affordable micro-services to keep your digital presence running at peak performance.',
  },

  catalogueLink: {
    // No count: the live catalogue is in Supabase and its size changes (production has 17, not 18).
    label: 'View all services',
    to: ROUTES.services,
  },
}
