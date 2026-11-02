import { useEffect } from 'react'

function setTag(
  selector: string,
  create: () => HTMLElement,
  attr: string,
  value: string,
): () => void {
  let el = document.head.querySelector<HTMLElement>(selector)
  const created = !el
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  const previous = el.getAttribute(attr)
  el.setAttribute(attr, value)
  return () => {
    if (created) el?.remove()
    else if (previous !== null) el?.setAttribute(attr, previous)
  }
}

/** Sets title, description and canonical for a route; restores them on leave. */
export function useDocumentMeta(title: string, description: string, path: string) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title
    const restoreDesc = setTag(
      'meta[name="description"]',
      () => Object.assign(document.createElement('meta'), { name: 'description' }),
      'content',
      description,
    )
    const restoreCanon = setTag(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
      'href',
      `https://authenticmedia.fun${path}`,
    )
    return () => {
      document.title = previousTitle
      restoreDesc()
      restoreCanon()
    }
  }, [title, description, path])
}
