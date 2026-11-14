import { ChevronDown, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'

import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { FAQ_GROUPS } from '@/features/faq/data/faq.data'
import { InlineText, useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

/**
 * FAQ (audit report §4.4). Native <details> gives keyboard and screen-reader
 * disclosure behaviour for free, and keeps every answer in the DOM for search.
 */
export function FaqPage() {
  useDocumentMeta(
    'FAQs — Authentic Media',
    'Answers about Authentic Media services, ordering, payments, delivery, refunds, cancellations, support and complaints.',
    ROUTES.faq,
  )
  const [query, setQuery] = useState('')
  const searchId = useId()
  const term = query.trim().toLowerCase()
  const groups = FAQ_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      [item.question, ...item.answer].some((text) => text.toLowerCase().includes(term)),
    ),
  })).filter((group) => group.items.length > 0)
  const matchCount = groups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="HELP CENTRE"
        rule
        title={
          <>
            Frequently Asked <GradientText>Questions</GradientText>
          </>
        }
        description="Services, ordering, payments, delivery, refunds and support — answered in line with our published policies."
      />

      <div className="mx-auto mt-14 flex max-w-3xl flex-col gap-12">
        <div role="search" aria-label="Search FAQs" className="flex flex-col gap-2">
          <label htmlFor={searchId} className="text-sm font-semibold text-text">
            Search the FAQs
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-subtle"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. refund, delivery, complaint"
              className="h-12 w-full rounded-input border border-border bg-surface pr-4 pl-11 text-base text-text placeholder:text-text-subtle focus-visible:border-primary-mid"
            />
          </div>
          <p role="status" className="text-sm text-text-subtle">
            {term ? `${matchCount} matching question${matchCount === 1 ? '' : 's'}` : ''}
          </p>
        </div>

        {groups.length === 0 && (
          <p className="rounded-card border border-border bg-surface px-6 py-10 text-center text-[16px] text-text-muted">
            No questions match &ldquo;{query.trim()}&rdquo;.{' '}
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-sm font-semibold text-text-lavender underline underline-offset-2 hover:text-text"
            >
              Clear search
            </button>
          </p>
        )}

        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`faq-${group.id}`}>
            <h2 id={`faq-${group.id}`} className="text-[22px] lg:text-[26px]">
              {group.title}
            </h2>

            <div className="mt-5 flex flex-col gap-3">
              {group.items.map((item) => (
                <details
                  key={item.id}
                  id={item.id}
                  className="group rounded-card border border-border bg-surface"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-card px-6 py-5 text-[17px] font-semibold text-text [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDown
                      aria-hidden="true"
                      className="mt-1 size-5 shrink-0 text-primary-mid transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="space-y-3 px-6 pb-6 text-[16px] leading-[1.75] text-text-muted">
                    {item.answer.map((paragraph) => (
                      <p key={paragraph}>
                        <InlineText text={paragraph} />
                      </p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <p className="rounded-card border border-border-strong bg-surface-badge px-6 py-5 text-[16px] text-text-muted">
          Didn&rsquo;t find your answer?{' '}
          <Link
            to={ROUTES.contact}
            className="rounded-sm font-semibold text-text-lavender underline underline-offset-2 hover:text-text"
          >
            Contact us
          </Link>{' '}
          and we will help.
        </p>
      </div>
    </Section>
  )
}
