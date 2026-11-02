import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { PolicyBlock } from '../types'

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g
const LINK_CLASS = 'rounded-sm text-text-lavender underline underline-offset-2 hover:text-text'

/** Renders `[label](href)` as a router Link (internal) or anchor (mailto/tel/http). */
export function InlineText({ text }: { text: string }) {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const [whole, label = '', href = ''] = m
    out.push(text.slice(last, m.index))
    out.push(
      href.startsWith('/') ? (
        <Link key={m.index} to={href} className={LINK_CLASS}>
          {label}
        </Link>
      ) : (
        <a key={m.index} href={href} className={LINK_CLASS}>
          {label}
        </a>
      ),
    )
    last = m.index + whole.length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

export function PolicyBlockView({ block }: { block: PolicyBlock }) {
  if (typeof block === 'string') {
    return (
      <p>
        <InlineText text={block} />
      </p>
    )
  }
  return (
    <ul className="list-disc space-y-1.5 pl-6 marker:text-primary-mid">
      {block.list.map((item) => (
        <li key={item}>
          <InlineText text={item} />
        </li>
      ))}
    </ul>
  )
}
