import { Mail, MapPin, Phone } from 'lucide-react'

import { Section } from '@/components/layout'
import { SITE } from '@/lib/site'
import { POLICY_META } from '../content/policy-meta'
import { useDocumentMeta } from '../hooks/use-document-meta'
import type { PolicyDocument } from '../types'
import { InlineText, PolicyBlockView } from './policy-text'

/** Company identity block, driven entirely by the shared SITE config. */
function CompanyContactDetails() {
  return (
    <address className="space-y-2 rounded-card border border-border bg-surface p-5 text-[15px] text-text-muted not-italic">
      <p className="font-bold text-text">{SITE.legalName}</p>
      <p className="flex gap-2">
        <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary-mid" />
        {SITE.address.single}
      </p>
      <p className="flex gap-2">
        <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary-mid" />
        <a href={`mailto:${SITE.email}`} className="underline underline-offset-2 hover:text-text">
          {SITE.email}
        </a>
      </p>
      <p className="flex gap-2">
        <Phone aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary-mid" />
        <a href={`tel:${SITE.phone}`} className="underline underline-offset-2 hover:text-text">
          {SITE.phone}
        </a>
      </p>
    </address>
  )
}

/** One layout for every policy: title, version line, contents, numbered sections. */
export function LegalPageLayout({ doc }: { doc: PolicyDocument }) {
  useDocumentMeta(doc.metaTitle, doc.metaDescription, doc.path)
  const effective = POLICY_META.effectiveDate ?? 'to be confirmed on publication'

  return (
    <Section>
      <header className="max-w-3xl">
        <h1 className="text-[34px] lg:text-5xl">{doc.title}</h1>
        <p className="mt-4 text-[14px] text-text-subtle">
          Version {POLICY_META.version} · Prepared {POLICY_META.preparedOn} · Effective date:{' '}
          {effective}
        </p>
        <p className="mt-6 text-[17px] leading-[1.7] text-text-muted">
          <InlineText text={doc.intro} />
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label={`${doc.title} contents`} className="lg:sticky lg:top-24 lg:self-start">
          <details
            open
            className="rounded-card border border-border bg-surface p-4 lg:border-0 lg:bg-transparent lg:p-0"
          >
            <summary className="cursor-pointer text-[13px] font-bold tracking-[0.12em] text-primary-mid uppercase">
              Contents
            </summary>
            <ol className="mt-3 space-y-1.5 text-[14px] text-text-muted">
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="rounded-sm hover:text-text">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </nav>

        <div className="max-w-3xl space-y-10">
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2 id={`${s.id}-h`} className="text-[22px] lg:text-[26px]">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-4 space-y-4 text-[16px] leading-[1.75] text-text-muted">
                {s.blocks.map((b, j) => (
                  <PolicyBlockView key={j} block={b} />
                ))}
                {s.id === 'contact' && <CompanyContactDetails />}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Section>
  )
}
