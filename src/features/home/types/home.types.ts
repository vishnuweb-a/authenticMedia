/** The location line above the hero heading, e.g. "NOIDA, INDIA". */
export interface HeroEyebrow {
  text: string
}

/** A hero call-to-action. `to` is an in-app route. */
export interface HeroCta {
  label: string
  to: string
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
