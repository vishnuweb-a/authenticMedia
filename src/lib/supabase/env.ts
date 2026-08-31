/**
 * Frontend-safe Supabase configuration.
 *
 * Only the project URL and the anon (publishable) key belong here — both are
 * designed to ship to browsers, and RLS is what actually protects the data. A
 * service-role key must never be referenced in this directory (CLAUDE.md §14).
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether the app has credentials to talk to Supabase at all.
 *
 * Absent configuration is a supported state, not a crash: the catalogue falls
 * back to its bundled static copy so the site still renders in a checkout of
 * the repo with no .env.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const SUPABASE_URL = url ?? ''
export const SUPABASE_ANON_KEY = anonKey ?? ''

/**
 * A production build with no Supabase credentials is always a misconfiguration.
 *
 * Without this the failure is silent and looks like success: the catalogue
 * repository falls back to the bundled copy, every page renders, and the site
 * serves a stale hardcoded catalogue that quietly omits anything added to
 * public.services since the last release. That is exactly how a live catalogue
 * entry came to be invisible in production while the database, RLS and the
 * query were all correct — the deployed bundle had simply been built without
 * VITE_SUPABASE_ANON_KEY and never asked Supabase anything.
 *
 * The fallback itself is deliberately left intact: it is what lets a fresh
 * checkout with no .env render. Only the silence is fixed.
 */
if (import.meta.env.PROD && !isSupabaseConfigured) {
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY in this ' +
      'production build. The catalogue is serving the bundled fallback copy and ' +
      'will not reflect public.services.',
  )
}
