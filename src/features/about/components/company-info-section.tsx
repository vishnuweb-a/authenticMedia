import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Section, SectionHeading } from '@/components/layout'
import { Card, GradientText } from '@/components/ui'
import { LEGAL, SITE } from '@/lib/site'
import { ROUTES } from '@/routes/paths'

/**
 * Company identity, business model and leadership (audit report §4.1, §4.2).
 *
 * Statutory identifiers and directors come only from LEGAL in site.ts and are
 * rendered only once supplied — nothing here is a placeholder or a guess.
 */
export function CompanyInfoSection() {
  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Registered name', value: SITE.legalName },
    { label: 'Company type', value: 'Private limited company, incorporated in India' },
    {
      label: 'Nature of business',
      value:
        'Provider of IT and digital services to businesses: tech maintenance, security and SEO audits, website support, integrations and software orchestration, data and AI automation, branding and content, and business consulting.',
    },
    {
      label: 'Business model',
      value: (
        <>
          Customers order one-time, fixed-price services on this website and pay online through a
          payment gateway. There are no subscriptions and nothing is shipped: our team confirms the
          scope with each customer and delivers the work remotely. See our{' '}
          <Link
            to={ROUTES.serviceDelivery}
            className="rounded-sm text-text-lavender underline underline-offset-2 hover:text-text"
          >
            Service Delivery Policy
          </Link>
          .
        </>
      ),
    },
    ...(LEGAL.cin ? [{ label: 'CIN', value: LEGAL.cin }] : []),
    ...(LEGAL.gstin ? [{ label: 'GSTIN', value: LEGAL.gstin }] : []),
  ]

  return (
    <Section className="pb-0">
      <SectionHeading
        eyebrow="COMPANY INFORMATION"
        title={
          <>
            Who we are, <GradientText>officially</GradientText>
          </>
        }
        description="The legal identity and business model behind Authentic Media."
      />

      <Card className="mx-auto mt-14 max-w-4xl p-0">
        <dl className="divide-y divide-border">
          {facts.map((fact) => (
            <div key={fact.label} className="grid gap-1 px-6 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
              <dt className="text-sm font-semibold text-text">{fact.label}</dt>
              <dd className="text-[15px] leading-relaxed text-text-muted">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {LEGAL.directors.length > 0 && (
        <div className="mx-auto mt-14 max-w-4xl">
          <h3 className="text-center text-2xl">Leadership</h3>
          <ul className="mt-8 grid gap-6 md:grid-cols-2">
            {LEGAL.directors.map((director) => (
              <li key={director.name} className="flex">
                <Card className="w-full">
                  <p className="text-xl font-bold text-text">{director.name}</p>
                  <p className="mt-1 text-sm font-semibold text-primary-mid">
                    {director.designation}
                    {director.din && ` · DIN ${director.din}`}
                  </p>
                  <p className="mt-3 text-[15px] text-text-muted">{director.background}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}
