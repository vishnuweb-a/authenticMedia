import { SERVICE_ICONS } from '@/components/shared'
import type { ContactChannel } from '../types/contact.types'

/**
 * One DIRECT CONTACT row. **[VERIFIED against
 * inspiration/contact-us(screenshot).png]**
 *
 * Measured (CSS px, capture ÷ 3): rounded icon tile 42×42 at the 24px gutter,
 * ~17px gap to the text column, label cap-height ~10px (≈15px semibold white),
 * value ≈17px muted on a ~28px baseline offset, rows on a ~73px pitch.
 *
 * These are plain rows, not cards: the capture shows no surface or border
 * behind them, unlike the notice card directly below.
 *
 * The value is a link wherever it resolves to one — mailto:, tel:, or the site
 * — and stays plain text for the address, which is not actionable.
 */
export function ContactChannelRow({ channel }: { channel: ContactChannel }) {
  const Icon = SERVICE_ICONS[channel.icon]

  return (
    <li className="flex items-start gap-[17px]">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-[42px] shrink-0 items-center justify-center rounded-[14px] border border-border-strong bg-[#1D1448] text-primary-mid"
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-[1.4] font-semibold text-text">{channel.label}</p>

        {channel.href ? (
          <a
            href={channel.href}
            {...(channel.external
              ? { target: '_blank', rel: 'noreferrer noopener' }
              : {})}
            // wrap-anywhere keeps the long email from overflowing at 360px.
            className="mt-1 block text-[17px] leading-[1.6] break-words text-text-muted transition-colors hover:text-text"
          >
            {channel.value}
          </a>
        ) : (
          <p className="mt-1 text-[17px] leading-[1.6] text-text-muted">{channel.value}</p>
        )}
      </div>
    </li>
  )
}
