import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout'
import { AUTH_FEATURES, GuestOnly, RequireAuth } from '@/features/auth'
import { AccountPage } from './pages/account-page'
import { ForgotPasswordPage } from './pages/forgot-password-page'
import { LoginPage } from './pages/login-page'
import { RegisterPage } from './pages/register-page'
import { AboutPage } from './pages/about-page'
import { ContactPage } from './pages/contact-page'
import { HomePage } from './pages/home-page'
import {
  GRIEVANCE,
  LegalPageLayout,
  PRIVACY,
  REFUND,
  SERVICE_DELIVERY,
  TERMS,
} from '@/features/legal'
import { FaqPage } from './pages/faq-page'
import { NotFoundPage } from './pages/not-found-page'
import { OrderSuccessPage } from './pages/order-success-page'
import { PoliciesPage } from './pages/policies-page'
import { ServiceDetailPage } from './pages/service-detail-page'
import { ServicesPage } from './pages/services-page'
import { ROUTES } from './paths'

/**
 * All routes render inside AppShell so the header, footer and hero backdrop are
 * defined once. The cart is not routed — it is a global drawer.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: ROUTES.terms, element: <LegalPageLayout doc={TERMS} /> },
      { path: ROUTES.privacy, element: <LegalPageLayout doc={PRIVACY} /> },
      { path: ROUTES.refund, element: <LegalPageLayout doc={REFUND} /> },
      { path: ROUTES.serviceDelivery, element: <LegalPageLayout doc={SERVICE_DELIVERY} /> },
      { path: ROUTES.grievance, element: <LegalPageLayout doc={GRIEVANCE} /> },
      { path: ROUTES.policies, element: <PoliciesPage /> },
      // Payment return: a shopper coming back from the gateway may be signed out. Stays public;
      // the page shows only what the order's own access token unlocks (checked by the API).
      { path: ROUTES.orderSuccess, element: <OrderSuccessPage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: ROUTES.login, element: <LoginPage /> },
          { path: ROUTES.register, element: <RegisterPage /> },
          // Hidden until an email service exists (AUTH_FEATURES).
          ...(AUTH_FEATURES.passwordRecovery
            ? [{ path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> }]
            : []),
        ],
      },
      // Site content is members-only. Legal/policy pages above stay public (gateway
      // compliance). UX gate only — the API enforces real access.
      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.home, element: <HomePage /> },
          { path: ROUTES.services, element: <ServicesPage /> },
          { path: `${ROUTES.services}/:slug`, element: <ServiceDetailPage /> },
          { path: ROUTES.about, element: <AboutPage /> },
          { path: ROUTES.contact, element: <ContactPage /> },
          { path: ROUTES.faq, element: <FaqPage /> },
          { path: ROUTES.account, element: <AccountPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
