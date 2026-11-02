/** A paragraph (string, supports `[label](/path)` links) or a bullet list. */
export type PolicyBlock = string | { readonly list: readonly string[] }

export interface PolicySection {
  readonly id: string
  readonly title: string
  readonly blocks: readonly PolicyBlock[]
}

export interface PolicyDocument {
  readonly title: string
  readonly metaTitle: string
  readonly metaDescription: string
  readonly path: string
  readonly intro: string
  readonly sections: readonly PolicySection[]
}
