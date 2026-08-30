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
