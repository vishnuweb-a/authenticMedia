import { Section } from '@/components/layout'

/**
 * Shared placeholder for the three footer legal routes. Their contents were
 * never captured (REFERENCE-LIMITATIONS.md → Missing Footer Areas), so they
 * await real copy rather than invented text.
 */
export function LegalPage({ title }: { title: string }) {
  return (
    <Section>
      <h1 className="text-[40px] lg:text-5xl">{title}</h1>
      <p className="mt-4 text-text-muted">This content has not been published yet.</p>
    </Section>
  )
}
