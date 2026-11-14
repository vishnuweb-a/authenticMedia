import { ArrowRight, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Section, SectionHeading } from '@/components/layout'
import { Card, GradientText } from '@/components/ui'
import { POLICIES, POLICY_META, useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

/**
 * Policies hub. Each card's summary is the policy's own metaDescription, so the
 * hub never restates (or drifts from) the policy text itself.
 */
export function PoliciesPage() {
  useDocumentMeta(
    'Policies — Authentic Media',
    'Terms, privacy, refund and cancellation, service delivery and grievance redressal policies of Authentic Media and IT Sector Private Limited.',
    ROUTES.policies,
  )

  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="LEGAL"
        rule
        title={
          <>
            Our <GradientText>Policies</GradientText>
          </>
        }
        description="The terms that apply when you order from us, and how we handle your data, refunds, delivery and complaints."
      />

      <ul className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
        {POLICIES.map((policy) => (
          <li key={policy.path} className="flex">
            <Card interactive className="relative flex w-full flex-col">
              <span
                aria-hidden="true"
                className="inline-flex size-12 items-center justify-center rounded-tile bg-surface-badge text-primary-mid"
              >
                <FileText className="size-5" />
              </span>
              <h2 className="mt-5 text-xl">
                {/* The stretched link makes the whole card clickable with one tab stop. */}
                <Link
                  to={policy.path}
                  className="rounded-sm after:absolute after:inset-0 after:rounded-card"
                >
                  {policy.title}
                </Link>
              </h2>
              <p className="mt-3 text-[15px] text-text-muted">{policy.metaDescription}</p>
              <p className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[15px] font-semibold text-primary-mid">
                Read policy <ArrowRight aria-hidden="true" className="size-4" />
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mx-auto mt-10 max-w-5xl text-center text-[14px] text-text-subtle">
        Version {POLICY_META.version} · Prepared {POLICY_META.preparedOn} · Effective date:{' '}
        {POLICY_META.effectiveDate ?? 'to be confirmed on publication'}
      </p>
    </Section>
  )
}
