/** The location line above the hero heading, e.g. "NOIDA, INDIA — EST. 2020". */
export interface HeroEyebrow {
  text: string
}

/** A hero call-to-action. `to` is an in-app route. */
export interface HeroCta {
  label: string
  to: string
}

/**
 * The overlapping avatar chips beside the client count. Initials only — the
 * reference shows no photography here.
 */
export interface AvatarChip {
  initials: string
}

export interface HeroSocialProof {
  avatars: readonly AvatarChip[]
  /** Bold white fragment, e.g. "500+ clients". */
  highlight: string
  /** Muted remainder, e.g. "trust Authentic Media". */
  rest: string
}

export interface HeroContent {
  eyebrow: string
  /** Heading text preceding the gradient accent word. */
  headline: string
  /** Gradient-filled, italic accent word — rendered inside the same <h1>. */
  headlineAccent: string
  description: string
  primaryCta: HeroCta
  secondaryCta: HeroCta
  socialProof: HeroSocialProof
}

/** Eyebrow + split heading + sub-copy for a Home section. */
export interface HomeSectionContent {
  eyebrow: string
  /** Heading text preceding the gradient accent. */
  title: string
  /** Gradient-filled accent fragment. */
  titleAccent: string
  description: string
}

/** The centered link between hairline rules under the core services grid. */
export interface CatalogueLink {
  label: string
  to: string
}

export interface HomeContent {
  hero: HeroContent
  coreServices: HomeSectionContent
  microServices: HomeSectionContent
  catalogueLink: CatalogueLink
}
