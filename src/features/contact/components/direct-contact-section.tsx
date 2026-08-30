import { Section } from '@/components/layout'
import { GradientText, SectionEyebrow } from '@/components/ui'
import { SERVICE_ICONS } from '@/components/shared'
import { ContactChannelRow } from './contact-channel-row'
import {
  CONTACT_CHANNELS,
  CONTACT_DIRECT,
  CONTACT_RESPONSE_NOTICE,
} from '../data/contact.data'

/**
 * DIRECT CONTACT. **[VERIFIED against inspiration/contact-us(screenshot).png]**
 *
 * This section is **left aligned** — eyebrow, heading and body all sit at the
 * 24px page gutter. DESIGN-SYSTEM.md describes section headers as centred, but
 * the capture plainly shows otherwise here, and the screenshot is the visual
 * source of truth. It therefore does not use SectionHeading, which is centred
 * by design.
 *
 * Measured (CSS px, capture ÷ 3): eyebrow 153×33 at y≈522; H2 cap-height
 * y≈578–600 (≈31px type) with "conversation." gradient-filled; body three lines
 * from y≈630; the four rows from y≈740 on a 73px pitch; the notice card
 * 382×92 at y≈1105.
 *
 * The notice card is the one bordered surface here: fill #19123F, 1px #321C6A
 * border, lavender copy with "24 hours" bold — measured, and distinctly
 * lighter than the page's standard #160E35 card.
 */
export function DirectContactSection() {
  const ClockIcon = SERVICE_ICONS.clock

  return (
    <Section className="py-0">
      <div className="max-w-[382px] lg:max-w-none">
        <SectionEyebrow>{CONTACT_DIRECT.eyebrow}</SectionEyebrow>

        <h2 className="mt-[22px] text-[31px] sm:text-4xl lg:text-[40px]">
          {CONTACT_DIRECT.title} <GradientText>{CONTACT_DIRECT.titleAccent}</GradientText>
        </h2>

        <p className="mt-[26px] max-w-[382px] text-[17px] leading-[29px] text-text-muted sm:max-w-[62ch]">
          {CONTACT_DIRECT.description}
        </p>

        <ul className="mt-[38px] flex flex-col gap-[26px] sm:grid sm:grid-cols-2 sm:gap-x-10 lg:max-w-[860px]">
          {CONTACT_CHANNELS.map((channel) => (
            <ContactChannelRow key={channel.id} channel={channel} />
          ))}
        </ul>

        <p className="mt-[38px] flex max-w-[382px] items-start gap-2 rounded-card border border-[#321C6A] bg-[#19123F] px-[18px] py-[21px] text-[15px] leading-[1.6] text-text-lavender sm:max-w-[560px]">
          <ClockIcon aria-hidden="true" className="mt-[5px] size-4 shrink-0" />
          <span>
            {CONTACT_RESPONSE_NOTICE.before}
            <strong className="font-bold text-text">{CONTACT_RESPONSE_NOTICE.emphasis}</strong>
            {CONTACT_RESPONSE_NOTICE.after}
          </span>
        </p>
      </div>
    </Section>
  )
}
