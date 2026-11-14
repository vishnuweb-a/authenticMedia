import { Link } from 'react-router-dom'

import { Section } from '@/components/layout'
import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

export function NotFoundPage() {
  useDocumentMeta('Page not found — Authentic Media', 'This page does not exist or has moved.', ROUTES.home)

  return (
    <Section className="text-center">
      <h1 className="text-[40px] lg:text-5xl">Page not found</h1>
      <p className="mt-4 text-text-muted">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        to={ROUTES.home}
        className="bg-gradient-primary shadow-glow-primary mt-8 inline-flex h-[62px] items-center rounded-pill px-8 font-bold text-on-primary"
      >
        Back to homepage
      </Link>
    </Section>
  )
}
