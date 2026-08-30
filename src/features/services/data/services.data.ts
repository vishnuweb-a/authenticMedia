import type { ServicesContent } from '../types/services.types'

/**
 * Services page copy.
 *
 * Every string is transcribed from inspiration/services(iPhone 14 Pro Max).png
 * — the hero eyebrow, heading and sub-copy, and both section headings, are read
 * off the capture rather than reused from Home. The micro-services heading and
 * sub-copy happen to match Home's word for word, which the capture confirms.
 */
export const SERVICES_CONTENT: ServicesContent = {
  hero: {
    eyebrow: 'COMPLETE SERVICE CATALOGUE',
    title: 'Our',
    titleAccent: 'Services',
    description:
      'From foundational tech maintenance to AI-powered automation — everything your business needs to grow, stay secure, and move fast.',
  },

  coreOfferings: {
    eyebrow: 'CORE OFFERINGS',
    title: 'Core',
    titleAccent: 'Services',
    description:
      'End-to-end digital services built for modern businesses — strategic, scalable, and results-driven.',
  },

  microServices: {
    eyebrow: 'QUICK FIXES & MORE',
    title: 'Website & Digital',
    titleAccent: 'Micro-Services',
    description:
      'Focused, affordable micro-services to keep your digital presence running at peak performance.',
  },
}
