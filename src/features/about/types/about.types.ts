import type { ServiceIconName } from '@/components/shared'

/** Eyebrow + split heading + sub-copy, matching the shared section pattern. */
export interface AboutSectionContent {
  eyebrow: string
  /** Heading text preceding the gradient accent. */
  title: string
  /** Gradient-filled accent fragment, rendered inside the same heading. */
  titleAccent: string
  description?: string
}

/** The About page hero — carries the single <h1>. */
export interface AboutHeroContent {
  eyebrow: string
  title: string
  titleAccent: string
  description: string
}

/** The left-aligned narrative block: heading plus its prose paragraphs. */
export interface AboutNarrativeContent {
  title: string
  titleAccent: string
  paragraphs: readonly string[]
}

/** A capability card in the "What We Do" grid. */
export interface AboutCapability {
  id: string
  icon: ServiceIconName
  title: string
  description: string
}

/** A numbered step in the "How We Work" sequence. */
export interface AboutApproachStep {
  id: string
  /** Rendered as the violet step index, e.g. "01". */
  step: string
  title: string
  description: string
}

/** A CTA in the closing band. `to` is an in-app route. */
export interface AboutCta {
  label: string
  to: string
}

export interface AboutClosingContent {
  title: string
  description: string
  primaryCta: AboutCta
  secondaryCta: AboutCta
}

export interface AboutContent {
  hero: AboutHeroContent
  narrative: AboutNarrativeContent
  capabilities: AboutSectionContent
  approach: AboutSectionContent
  closing: AboutClosingContent
}
