/**
 * Authentication feature (custom server-side auth at /api/auth, behind AuthService).
 * Payment flows are intentionally independent of it: guest checkout stays open.
 */
export { AccountPanel } from './components/account-panel'
export { ForgotPasswordForm } from './components/forgot-password-form'
export { LoginForm } from './components/login-form'
export { RegisterForm } from './components/register-form'
export { GuestOnly, RequireAuth } from './components/route-guards'
export { useSignOut } from './hooks/use-sign-out'
export { AUTH_FEATURES } from './config'
