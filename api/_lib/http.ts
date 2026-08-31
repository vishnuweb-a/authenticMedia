import { timingSafeEqual } from 'node:crypto'

/**
 * Minimal Vercel-style request/response shapes.
 *
 * Declared locally rather than depending on @vercel/node so the api/ tree
 * typechecks and tests without a platform SDK installed.
 */
export interface ApiRequest {
  method?: string | undefined
  url?: string | undefined
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

export interface ApiResponse {
  status(code: number): ApiResponse
  setHeader(name: string, value: string): ApiResponse
  json(body: unknown): void
  send(body: string): void
  end(): void
}

export function header(req: ApiRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

/**
 * Constant-time string comparison (§15, §16).
 *
 * Length is checked first because timingSafeEqual throws on a length mismatch.
 * Comparing lengths is not itself a leak worth avoiding: both values here are
 * fixed-length tokens.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function noStore(res: ApiResponse): void {
  res.setHeader('Cache-Control', 'no-store')
}
