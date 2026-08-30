import { ChevronRight, Globe, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Container } from './container'
import { Logo } from './logo'
import { SITE, SOCIAL_LINKS } from '@/lib/site'
import { FOOTER_LINKS } from '@/routes/paths'

/** Violet uppercase tracked heading — eyebrow treatment minus the pill. */
function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold tracking-[0.12em] text-primary-mid uppercase">
      {children}
    </h2>
  )
}

const SOCIAL_ICONS = {
  linkedin: Linkedin,
  instagram: Instagram,
  x: XIcon,
} as const

/** Lucide has no X/Twitter glyph, so the wordmark is drawn inline. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
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

            <ul className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => {
                const Icon = SOCIAL_ICONS[social.icon]
                return (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      aria-label={social.label}
                      className="inline-flex size-12 items-center justify-center rounded-tile border border-border bg-surface text-text-muted transition-colors hover:text-text"
                    >
                      <Icon className="size-5" />
                    </a>
                  </li>
                )
              })}
            </ul>
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
              {SITE.address.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </section>

          {/* Contact info */}
          <section className="flex flex-col gap-4">
            <FooterHeading>Contact Info</FooterHeading>
            <ul className="flex flex-col gap-3 text-[15px] text-text-muted">
              <ContactRow icon={<MapPin className="size-4" />}>
                {SITE.address.single}
              </ContactRow>
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
