import { ROUTES } from '@/routes/paths'
import { CATALOGUE_SIZE } from '@/features/services/data/catalogue.data'
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
    eyebrow: 'NOIDA, INDIA — EST. 2020',
    headline: 'We build the digital backbone of your',
    // Gradient + italic — the only italic in the system.
    headlineAccent: 'business.',
    description:
      'From SEO audits to AI automation, Authentic Media delivers IT solutions that actually move the needle — not just reports that sit in a drawer.',
    primaryCta: { label: 'See Our Services', to: ROUTES.services },
    secondaryCta: { label: 'Talk to Us', to: ROUTES.contact },
    socialProof: {
      avatars: [{ initials: 'PS' }, { initials: 'RK' }, { initials: 'AM' }, { initials: 'VT' }],
      highlight: '500+ clients',
      rest: 'trust Authentic Media',
    },
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
    label: `Explore all ${CATALOGUE_SIZE} services`,
    to: ROUTES.services,
  },
}
