import { ROUTES } from '@/routes/paths'
import { SITE } from '@/lib/site'
import type {
  AboutApproachStep,
  AboutCapability,
  AboutContent,
} from '../types/about.types'

/**
 * About page copy.
 *
 * Provenance is mixed and deliberately annotated, because roughly half of
 * inspiration/about-us(screenshot).png did not render
 * (REFERENCE-LIMITATIONS.md → About Blank Region):
 *
 *   [VERIFIED]      transcribed directly from the capture.
 *   [RECONSTRUCTED] written to fill the blank region. Every claim is restated
 *                   from the verified narrative or the existing catalogue — no
 *                   history, statistics, clients, awards, headcount or
 *                   certifications are invented.
 */
export const ABOUT_CONTENT: AboutContent = {
  // [VERIFIED] — eyebrow pill, two-line heading with "Authentic Media"
  // gradient-filled, centred sub-copy, then the short gradient rule.
  hero: {
    eyebrow: 'WHO WE ARE',
    title: 'About',
    titleAccent: SITE.shortName,
    description:
      'A forward-thinking technology company built to help businesses grow, adapt, and stay secure in a fast-evolving digital world.',
  },

  // [VERIFIED] — left-aligned heading with "Us" gradient-filled, two paragraphs.
  narrative: {
    title: 'About',
    titleAccent: 'Us',
    paragraphs: [
      `${SITE.legalName} is a forward-thinking technology company built to help businesses grow, adapt, and stay secure in a fast-evolving digital world. We focus on creating practical, scalable, and reliable technology solutions that solve real business problems — not just today, but for the long term.`,
      "Our approach is simple: understand the client's challenges, design smart systems, and deliver solutions that are efficient, secure, and easy to manage. From software solutions and system orchestration to fintech support, data, automation, and cybersecurity basics, we act as a complete technology partner rather than just a service provider.",
    ],
  },

  // [RECONSTRUCTED] — the six areas are exactly the ones the verified narrative
  // enumerates ("software solutions and system orchestration to fintech
  // support, data, automation, and cybersecurity basics"), and each maps to a
  // service that already exists in the catalogue.
  capabilities: {
    eyebrow: 'WHAT WE DO',
    title: 'A Complete Technology',
    titleAccent: 'Partner',
    description:
      'The areas we cover for our clients — end to end, rather than one project at a time.',
  },

  // [RECONSTRUCTED] — the four steps restate the verified sentence "understand
  // the client's challenges, design smart systems, and deliver solutions that
  // are efficient, secure, and easy to manage", split into its own clauses.
  approach: {
    eyebrow: 'HOW WE WORK',
    title: 'Our',
    titleAccent: 'Approach',
    description:
      'Simple by design: understand the problem, design the system, deliver it, and keep it running.',
  },

  // [VERIFIED] — full-bleed violet band with a faint grid, white heading with no
  // gradient accent and no eyebrow, muted sub-copy, then a gradient
  // "Get In Touch" pill above an outlined "View Services" pill.
  closing: {
    title: 'Ready to work with us?',
    description:
      'Whether you have a project in mind or just want to explore options, our team is here to help.',
    primaryCta: { label: 'Get In Touch', to: ROUTES.contact },
    secondaryCta: { label: 'View Services', to: ROUTES.services },
  },
}

/**
 * [RECONSTRUCTED] Capability cards.
 *
 * Titles and scope come from the verified narrative's own list; the
 * descriptions restate that list rather than adding new claims.
 */
export const ABOUT_CAPABILITIES = [
  {
    id: 'software',
    icon: 'app',
    title: 'Software Solutions',
    description:
      'Practical, scalable software built around the problem a business actually has, not around a template.',
  },
  {
    id: 'orchestration',
    icon: 'sync',
    title: 'System Orchestration',
    description:
      'Connecting the tools and systems already in place so they work as one, instead of as isolated parts.',
  },
  {
    id: 'fintech',
    icon: 'card',
    title: 'Fintech Support',
    description:
      'Payment and collection workflows set up to run reliably, with the operational detail handled.',
  },
  {
    id: 'data',
    icon: 'chart',
    title: 'Data',
    description:
      'Turning the information a business already produces into something it can read and act on.',
  },
  {
    id: 'automation',
    icon: 'bot',
    title: 'Automation',
    description:
      'Removing the repetitive work from day-to-day operations so the team spends its time elsewhere.',
  },
  {
    id: 'security',
    icon: 'shield',
    title: 'Cybersecurity Basics',
    description:
      'The essential protections every business needs in place before anything else is built on top.',
  },
] as const satisfies readonly AboutCapability[]

/**
 * [RECONSTRUCTED] The four steps are the clauses of the verified approach
 * sentence, in the order the narrative states them.
 */
export const ABOUT_APPROACH_STEPS = [
  {
    id: 'understand',
    step: '01',
    title: 'Understand',
    description:
      "We start with the client's challenges — what is slowing the business down, and what it needs to do next.",
  },
  {
    id: 'design',
    step: '02',
    title: 'Design',
    description:
      'We design smart systems around those challenges: practical, scalable, and built to last beyond today.',
  },
  {
    id: 'deliver',
    step: '03',
    title: 'Deliver',
    description:
      'We deliver solutions that are efficient and secure, and that fit the way the business already works.',
  },
  {
    id: 'maintain',
    step: '04',
    title: 'Maintain',
    description:
      'We keep them easy to manage, so the systems stay reliable long after they go live.',
  },
] as const satisfies readonly AboutApproachStep[]
