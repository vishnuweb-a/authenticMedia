/**
 * Screens that are built but hidden until their backing services exist.
 *
 * Password recovery: off until a transactional email service exists
 * (docs/AUTH-SETUP.md). Registration is always routed; the server's
 * AUTH_PUBLIC_REGISTRATION=false kill switch closes it.
 */
export const AUTH_FEATURES = {
  passwordRecovery: false,
} as const
