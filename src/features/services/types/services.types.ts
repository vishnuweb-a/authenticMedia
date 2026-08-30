import type { Service } from '@/types'

/** What a catalogue card needs in order to render and add itself to the cart. */
export interface ServiceCardProps {
  service: Service
}

/** Eyebrow + split heading + sub-copy for a Services section. */
export interface ServicesSectionContent {
  eyebrow: string
  /** Heading text preceding the gradient accent. */
  title: string
  /** Gradient-filled accent fragment, rendered inside the same heading. */
  titleAccent: string
  description: string
}

export interface ServicesContent {
  /** The page hero — carries the single <h1>. */
  hero: ServicesSectionContent
  coreOfferings: ServicesSectionContent
  microServices: ServicesSectionContent
}
