// Administrative account provisioning (docs/AUTH-SETUP.md).
//
//   node --env-file=.env scripts/provision-user.mjs
//
// Run by an operator on their own machine with SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY set. Creates ONE verified account. This is the only
// way to create a verified account until an email-verification service exists;
// no HTTP endpoint can do it. The password is typed at a hidden prompt, never
// passed as an argument (shell history) and never printed.
import { createInterface } from 'node:readline/promises'

import { hash } from '@node-rs/argon2'
import { createClient } from '@supabase/supabase-js'

import { validateEmail, validateName, validatePassword } from '../src/features/auth/lib/validation.ts'

// The project URL is public; local .env files often carry only the VITE_ copy.
const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. node --env-file=.env ...).')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
const fullName = (await rl.question('Full name: ')).trim()
const email = (await rl.question('Email: ')).trim().toLowerCase()

process.stdout.write('Password (hidden): ')
rl._writeToOutput = () => {} // mute echo while the password is typed
const password = await rl.question('')
rl.close()
process.stdout.write('\n')

const problem = validateName(fullName) ?? validateEmail(email) ?? validatePassword(password)
if (problem) {
  console.error(problem)
  process.exit(1)
}

// Same library defaults as api/_lib/auth.ts hashPassword (Argon2id).
const passwordHash = await hash(password)
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await db.rpc('auth_create_user', {
  p_full_name: fullName,
  p_email: email,
  p_password_hash: passwordHash,
  p_verified: true,
})

if (error) {
  console.error(`Failed: ${error.code ?? 'unknown error'}`)
  process.exit(1)
}
console.log(data ? 'Verified account created.' : 'An account with that email already exists.')
