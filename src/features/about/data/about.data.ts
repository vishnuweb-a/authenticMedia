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

  // The real order-to-delivery workflow, restated from the Service Delivery
  // Policy and the checkout code (audit §4.1 business model, §4.5 walkthrough).
  approach: {
    eyebrow: 'HOW IT WORKS',
    title: 'From order to',
    titleAccent: 'delivery',
    description:
      'The same process applies to every service we sell — from choosing it on this website to receiving the work.',
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
 * The engagement workflow. Each step describes what the website and the team
 * actually do (see the Service Delivery and Refund policies) — no turnaround
 * time is promised, because none has been confirmed.
 */
export const ABOUT_APPROACH_STEPS = [
  {
    id: 'choose',
    step: '01',
    title: 'Choose a service',
    description:
      'Pick a fixed-price service from our catalogue and add it to your cart. Not sure which fits? Contact us first and we will advise.',
  },
  {
    id: 'pay',
    step: '02',
    title: 'Pay securely',
    description:
      "Pay on the Airpay payment gateway's hosted page. Your order is confirmed only after we verify the payment with the gateway.",
  },
  {
    id: 'scope',
    step: '03',
    title: 'Confirm the scope',
    description:
      'Our team contacts you by email or phone to confirm the exact scope, the information or access we need, and the expected timing.',
  },
  {
    id: 'deliver',
    step: '04',
    title: 'Delivery and support',
    description:
      'We deliver remotely — a report, configuration on your systems, or files — and support you afterwards using your order reference.',
  },
] as const satisfies readonly AboutApproachStep[]

/**
 * Business operations. Each line restates the Terms, Service Delivery, Refund
 * or Grievance policy — no SLA, turnaround or guarantee is added.
 */
export const ABOUT_OPERATIONS = [
  {
    id: 'ordering',
    title: 'Ordering',
    description:
      'Customers order one-time, fixed-price services on this website as guests — no account or subscription. The price shown in the cart is the price charged. See the [Terms & Conditions](/terms).',
  },
  {
    id: 'payments',
    title: 'Payments',
    description:
      'Payment is taken on the Airpay payment gateway\u2019s hosted page. An order is treated as paid only after we verify the payment directly with the gateway and the amount matches.',
  },
  {
    id: 'delivery',
    title: 'Delivery',
    description:
      'Fulfilment is manual and remote. Our team confirms the scope, collects the information and access needed, and delivers by report, configuration or files. See the [Service Delivery Policy](/service-delivery-policy).',
  },
  {
    id: 'support',
    title: 'Support, refunds and complaints',
    description:
      'Support is by email and phone, quoting the order reference. Cancellations and refunds follow the [Refund & Cancellation Policy](/refund), and complaints the [Grievance Redressal](/grievance-redressal) procedure.',
  },
] as const satisfies readonly { id: string; title: string; description: string }[]
