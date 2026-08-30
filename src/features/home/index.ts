/**
 * Home feature.
 *
 * Reference: inspiration/home.png (truncated at the 16384px capture ceiling —
 * no footer captured; the global footer comes from AppShell).
 *
 * Composition: Hero → Our Core Services → Website & Digital Micro-Services.
 * The catalogue data and both card components are owned by features/services
 * and shared, so the Services page renders the same entries through the same
 * cards — Home shows a six-entry subset, Services the full list.
 */
export { CoreServicesSection, Hero, MicroServicesSection } from './components'
export { HOME_CONTENT } from './data/home.data'
export type * from './types/home.types'
