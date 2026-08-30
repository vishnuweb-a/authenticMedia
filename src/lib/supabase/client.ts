import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env'

/**
 * The single Supabase client for the app.
 *
 * Null when the project is unconfigured, which repositories treat as "fall back
 * to the bundled catalogue" rather than as an error — the marketing pages must
 * still render in a fresh checkout with no .env.
 *
 * Sessions are not persisted because there is no authentication in this phase;
 * guest identity is carried by the guest token instead (see guest-token.ts).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

export { isSupabaseConfigured }
