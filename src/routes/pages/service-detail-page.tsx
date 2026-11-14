import { ArrowLeft, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Section } from '@/components/layout'
import { ServiceIcon, isServiceIconName } from '@/components/shared'
import { Button, Card } from '@/components/ui'
import { ABOUT_APPROACH_STEPS } from '@/features/about'
import { useDocumentMeta } from '@/features/legal'
import { CatalogueError, useAddToCart, useService } from '@/features/services'
import { formatInr } from '@/lib/format'
import { ROUTES, servicePath } from '@/routes/paths'
import type { Service } from '@/types'
import { NotFoundPage } from './not-found-page'

const LINK = 'rounded-sm text-text-lavender underline underline-offset-2 hover:text-text'

/**
 * One service. Everything specific to the service comes from its catalogue row;
 * everything else is restated from the Terms and Service Delivery Policy, which
 * apply to every service. Scope, timelines and revisions the merchant has not
 * published are described as "confirmed in writing", never invented
 * (docs/SERVICE-VERIFICATION.md §3 lists what is still missing per service).
 */
export function ServiceDetailPage() {
  const { slug = '' } = useParams()
  const { service, isLoading, error } = useService(slug)

  if (isLoading) {
    return (
      <Section>
        <p role="status" className="sr-only">
          Loading service
        </p>
        <div aria-hidden="true" className="h-[420px] animate-pulse rounded-card bg-surface-subtle" />
      </Section>
    )
  }
  if (error) {
    return (
      <Section>
        <h1 className="sr-only">Service unavailable</h1>
        <CatalogueError message={error} />
      </Section>
    )
  }
  if (!service) return <NotFoundPage />

  return <ServiceDetail service={service} />
}

function ServiceDetail({ service }: { service: Service }) {
  const { isAdded, add } = useAddToCart(service)
  useDocumentMeta(
    `${service.title} — Authentic Media`,
    `${service.title}: ${service.subtitle ?? service.description}`.slice(0, 160),
    servicePath(service.id),
  )

  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Pricing', value: 'One-time fixed price, paid online in advance' },
    { label: 'Category', value: service.tier === 'core' ? 'Core service' : 'Website & digital micro-service' },
    { label: 'Who it is for', value: 'Businesses ordering IT and digital services online' },
    { label: 'Delivery', value: 'Remote and electronic, by our team. Nothing is shipped.' },
    {
      label: 'Timeline',
      value: (
        <>
          No fixed time is published. The expected timing is given when the scope is confirmed — see
          the{' '}
          <Link to={`${ROUTES.serviceDelivery}#timelines`} className={LINK}>
            Service Delivery Policy
          </Link>
          .
        </>
      ),
    },
    {
      label: 'Revisions',
      value: (
        <>
          No fixed number. Any revisions are agreed with you in writing — see the{' '}
          <Link to={ROUTES.terms} className={LINK}>
            Terms &amp; Conditions
          </Link>
          .
        </>
      ),
    },
  ]

  return (
    <Section>
      <Link
        to={ROUTES.services}
        className="inline-flex items-center gap-1.5 rounded-md text-[15px] font-semibold text-primary-mid hover:text-primary-end"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All services
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        <div className="min-w-0">
          <header>
            {isServiceIconName(service.icon) && <ServiceIcon name={service.icon} tile />}
            <h1 className="mt-6 text-[34px] lg:text-5xl">{service.title}</h1>
            {service.subtitle && (
              <p className="mt-3 text-[17px] font-medium text-primary-mid">{service.subtitle}</p>
            )}
          </header>

          <DetailSection title="Overview">
            <p>{service.description}</p>
          </DetailSection>

          <DetailSection title="Scope and deliverables">
            {service.features && service.features.length > 0 && (
              <ul className="flex flex-col gap-2.5">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check aria-hidden="true" className="mt-1.5 size-4 shrink-0 text-primary-mid" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            <p>
              {service.features?.length
                ? 'These are the items covered by this service. '
                : 'The summary above describes this service. '}
              The exact scope — for example which website or system is covered — is confirmed with you
              in writing before or when work begins. Anything beyond it is discussed with you first and
              never charged without your agreement.
            </p>
          </DetailSection>

          <DetailSection title="How it works">
            <ol className="flex flex-col gap-4">
              {ABOUT_APPROACH_STEPS.map((step) => (
                <li key={step.id} className="flex gap-4">
                  <span aria-hidden="true" className="gradient-text w-8 shrink-0 font-bold">
                    {step.step}
                  </span>
                  <span>
                    <strong className="block text-text">{step.title}</strong>
                    {step.description}
                  </span>
                </li>
              ))}
            </ol>
          </DetailSection>

          <DetailSection title="Information we may need from you">
            <ul className="list-disc space-y-1.5 pl-6 marker:text-primary-mid">
              <li>Your website or system address</li>
              <li>Access to work on it, only for systems you own or may authorise</li>
              <li>A description of the issue or goal</li>
              <li>Brand materials or content, where relevant</li>
              <li>Decisions at agreed points</li>
            </ul>
            <p>Never send card numbers, UPI PINs, OTPs or bank passwords.</p>
          </DetailSection>

          <DetailSection title="Cancellations, refunds and terms">
            <p>
              If work has not started, cancelling entitles you to a refund of the amount paid for the
              service; if it has started, the part not yet performed is refunded. Full details are in
              the <Link to={ROUTES.refund} className={LINK}>Refund &amp; Cancellation Policy</Link>,{' '}
              <Link to={ROUTES.serviceDelivery} className={LINK}>Service Delivery Policy</Link> and{' '}
              <Link to={ROUTES.terms} className={LINK}>Terms &amp; Conditions</Link>.
            </p>
          </DetailSection>
        </div>

        <aside aria-label="Order summary" className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <p className="text-sm font-semibold text-text-muted">Price</p>
            <p className="mt-1 text-4xl font-bold text-text">{formatInr(service.price)}</p>
            <Button
              variant="primary"
              className="mt-6 w-full"
              onClick={add}
              disabled={isAdded}
              aria-label={isAdded ? `${service.title} added to cart` : `Add ${service.title} to cart, ${formatInr(service.price)}`}
            >
              {isAdded ? 'Added to cart' : 'Add to Cart'}
            </Button>
            <dl className="mt-6 divide-y divide-border border-t border-border">
              {facts.map((fact) => (
                <div key={fact.label} className="py-3">
                  <dt className="text-sm font-semibold text-text">{fact.label}</dt>
                  <dd className="mt-0.5 text-[14px] leading-relaxed text-text-muted">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[14px] text-text-muted">
              Questions first? <Link to={ROUTES.contact} className={LINK}>Contact us</Link>.
            </p>
          </Card>
        </aside>
      </div>
    </Section>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[22px] lg:text-[26px]">{title}</h2>
      <div className="mt-4 space-y-4 text-[16px] leading-[1.75] text-text-muted">{children}</div>
    </section>
  )
}
