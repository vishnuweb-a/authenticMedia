/**
 * Structured logging (AIPAY-DOCS §9.8, §20).
 *
 * Field NAMES and shape categories are safe and are the single most useful
 * thing to see when diagnosing a callback. The VALUES beside them are a
 * customer's phone, email and VPA.
 *
 * Never logged, anywhere: credentials, derived keys, encdata/response blobs,
 * access tokens, and any callback field value.
 */
export type LogMeta = Readonly<Record<string, string | number | boolean | null | undefined>>

export function logEvent(event: string, meta: LogMeta = {}): void {
  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined) safe[key] = value
  }
  console.log(JSON.stringify({ event, ...safe }))
}
