import { ChevronRight, Globe, Mail, Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Container } from './container'
import { Logo } from './logo'
import { LEGAL, SITE } from '@/lib/site'
import { FOOTER_LINKS } from '@/routes/paths'

/** Violet uppercase tracked heading — eyebrow treatment minus the pill. */
function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold tracking-[0.12em] text-primary-mid uppercase">
      {children}
    </h2>
  )
}

/**
 * Global footer, present on every page.
 *
 * Canonical reference: contact-us(screenshot).png — the only capture that
 * reaches the footer in full. Its absence on Home and Services is a truncation
 * artifact, not evidence those pages lack one (REFERENCE-LIMITATIONS.md).
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 pt-16 pb-8">
      <Container>
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-5">
            <Logo />
            <p className="max-w-sm text-[15px] text-text-muted">
              {SITE.legalName} — {SITE.description}
            </p>
          </div>

          {/* Quick links */}
          <nav aria-labelledby="footer-quick-links" className="flex flex-col gap-4">
            <span id="footer-quick-links">
              <FooterHeading>Quick Links</FooterHeading>
            </span>
            <ul className="flex flex-col gap-2.5">
              {FOOTER_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center gap-1.5 rounded-md text-[15px] text-text-muted transition-colors hover:text-text"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary-mid"
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Registered office */}
          <section className="flex flex-col gap-4">
            <FooterHeading>Registered Office</FooterHeading>
            <address className="text-[15px] leading-relaxed text-text-muted not-italic">
              {LEGAL.registeredOffice ?? SITE.address.single}
            </address>
          </section>

          {/* Contact info */}
          <section className="flex flex-col gap-4">
            <FooterHeading>Contact Info</FooterHeading>
            <ul className="flex flex-col gap-3 text-[15px] text-text-muted">
              <ContactRow icon={<Phone className="size-4" />}>
                <a href={`tel:${SITE.phone}`} className="rounded-md hover:text-text">
                  {SITE.phone}
                </a>
              </ContactRow>
              <ContactRow icon={<Mail className="size-4" />}>
                <a href={`mailto:${SITE.email}`} className="rounded-md hover:text-text">
                  {SITE.email}
                </a>
              </ContactRow>
              <ContactRow icon={<Globe className="size-4" />}>
                <a
                  href={`https://${SITE.website}`}
                  className="rounded-md hover:text-text"
                  rel="noreferrer"
                >
                  {SITE.website}
                </a>
              </ContactRow>
            </ul>
          </section>
        </div>

        <div className="mt-14 border-t border-border/60 pt-6">
          {/* Statutory identifiers render only once supplied — see LEGAL in site.ts. */}
          {(LEGAL.cin || LEGAL.gstin) && (
            <p className="mb-2 text-center text-sm text-text-muted">
              {LEGAL.cin && <span>CIN: {LEGAL.cin}</span>}
              {LEGAL.cin && LEGAL.gstin && <span aria-hidden="true"> · </span>}
              {LEGAL.gstin && <span>GSTIN: {LEGAL.gstin}</span>}
            </p>
          )}
          <p className="text-center text-sm text-text-subtle">
            Copyright {SITE.copyrightYear} © {SITE.legalName}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  )
}

function ContactRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-1 shrink-0 text-primary-mid">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}
