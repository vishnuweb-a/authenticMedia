/**
 * Authentication feature (custom server-side auth at /api/auth, behind AuthService).
 * Browsing is public; starting a payment requires a signed-in account (the cart's
 * checkout step, enforced server-side by the payment-creation endpoints).
 */
export type { AuthRouteState } from './components/route-guards'
export { AccountPanel } from './components/account-panel'
export { ForgotPasswordForm } from './components/forgot-password-form'
export { LoginForm } from './components/login-form'
export { RegisterForm } from './components/register-form'
export { GuestOnly, RequireAuth } from './components/route-guards'
export { useSignOut } from './hooks/use-sign-out'
export { AUTH_FEATURES } from './config'
