/**
 * About feature.
 *
 * Reference: inspiration/about-us(screenshot).png — roughly 49% of the page did
 * not render (y≈3068–10326 @3x). Verified from the capture: the hero, the
 * left-aligned "About Us" narrative, and the closing "Ready to work with us?"
 * CTA band above the footer. Everything between the narrative and that band is
 * reconstructed, and each reconstructed component says so in its own header.
 *
 * Composition: hero → narrative → What We Do → How We Work → closing CTA.
 *
 * No content renders behind a scroll animation — the blank region in the
 * capture is exactly that failure mode (REFERENCE-LIMITATIONS.md → Missing
 * Scroll-Reveal Content).
 */
export {
  AboutHero,
  AboutNarrative,
  ApproachSection,
  CapabilitiesSection,
  ClosingCtaSection,
} from './components'
export {
  ABOUT_APPROACH_STEPS,
  ABOUT_CAPABILITIES,
  ABOUT_CONTENT,
} from './data/about.data'
export type * from './types/about.types'
