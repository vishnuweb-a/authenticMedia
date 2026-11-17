import { Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Section, SectionHeading } from '@/components/layout'
import { Card, GradientText } from '@/components/ui'
import { InlineText } from '@/features/legal/components/policy-text'
import { LEGAL, SITE } from '@/lib/site'
import { ROUTES } from '@/routes/paths'
import { ABOUT_OPERATIONS } from '../data/about.data'

/** "Business Operations" — how ordering, payment, delivery and support actually run. */
export function OperationsSection() {
  return (
    <Section className="pt-0">
      <SectionHeading
        eyebrow="BUSINESS OPERATIONS"
        title={
          <>
            How we <GradientText>operate</GradientText>
          </>
        }
        description="The day-to-day rules behind every order, as set out in our published policies."
      />

      <ul className="mt-14 grid gap-6 md:grid-cols-2">
        {ABOUT_OPERATIONS.map((item) => (
          <li key={item.id} className="flex">
            <Card className="w-full">
              <h3 className="text-xl">{item.title}</h3>
              <p className="mt-3 text-base text-text-muted">
                <InlineText text={item.description} />
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** "Contact and Registered Office" — sourced only from SITE. */
export function ContactOfficeSection() {
  const row = 'flex gap-3 text-[15px] text-text-muted'
  const icon = 'mt-1 size-4 shrink-0 text-primary-mid'

  return (
    <Section>
      <SectionHeading
        eyebrow="GET IN TOUCH"
        title={
          <>
            Contact and <GradientText>Registered Office</GradientText>
          </>
        }
      />

      <Card className="mx-auto mt-14 grid max-w-4xl gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-lg">Registered office</h3>
          <address className={`mt-3 not-italic ${row}`}>
            <MapPin aria-hidden="true" className={icon} />
            <span>
              {SITE.legalName}
              <br />
              {LEGAL.registeredOffice ?? SITE.address.single}
            </span>
          </address>
        </div>
        <div>
          <h3 className="text-lg">Contact</h3>
          <ul className="mt-3 flex flex-col gap-3">
            <li className={row}>
              <Mail aria-hidden="true" className={icon} />
              <a href={`mailto:${SITE.email}`} className="underline underline-offset-2 hover:text-text">
                {SITE.email}
              </a>
            </li>
            <li className={row}>
              <Phone aria-hidden="true" className={icon} />
              <a href={`tel:${SITE.phone}`} className="underline underline-offset-2 hover:text-text">
                {SITE.phone}
              </a>
            </li>
          </ul>
          <p className="mt-4 text-[15px] text-text-muted">
            <Link to={ROUTES.contact} className="font-semibold text-text-lavender underline underline-offset-2 hover:text-text">
              Contact page
            </Link>{' '}
            ·{' '}
            <Link to={ROUTES.grievance} className="font-semibold text-text-lavender underline underline-offset-2 hover:text-text">
              Raise a complaint
            </Link>
          </p>
        </div>
      </Card>
    </Section>
  )
}
