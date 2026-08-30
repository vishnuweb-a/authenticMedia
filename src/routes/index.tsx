import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout'
import { AboutPage } from './pages/about-page'
import { ContactPage } from './pages/contact-page'
import { HomePage } from './pages/home-page'
import { LegalPage } from './pages/legal-page'
import { NotFoundPage } from './pages/not-found-page'
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
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.services, element: <ServicesPage /> },
      { path: ROUTES.about, element: <AboutPage /> },
      { path: ROUTES.contact, element: <ContactPage /> },
      { path: ROUTES.terms, element: <LegalPage title="Terms & Conditions" /> },
      { path: ROUTES.privacy, element: <LegalPage title="Privacy Policy" /> },
      { path: ROUTES.refund, element: <LegalPage title="Refund & Cancellation" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
