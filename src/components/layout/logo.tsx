import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

/**
 * Monogram mark + thin rule + stacked wordmark, as composed in the reference
 * header: "AUTHENTIC" sits noticeably larger than "MEDIA" beneath it.
 *
 * The mark is inline SVG so it inherits currentColor and needs no asset. The
 * real brand mark should replace this glyph when supplied.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5 rounded-md', className)}
      aria-label="Authentic Media — go to homepage"
    >
      <svg viewBox="0 0 28 24" aria-hidden="true" className="h-6 w-7 shrink-0" fill="none">
        <path
          d="M2 21 10 4l4 8.5L18 4l8 17"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text"
        />
      </svg>

      <span aria-hidden="true" className="h-7 w-px bg-text/25" />

      <span aria-hidden="true" className="flex flex-col text-text">
        <span className="text-[13px] leading-tight font-bold tracking-[0.16em] uppercase">
          Authentic
        </span>
        <span className="text-[9px] leading-tight font-semibold tracking-[0.26em] text-text-muted uppercase">
          Media
        </span>
      </span>
    </Link>
  )
}
