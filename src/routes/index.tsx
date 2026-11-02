import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout'
import { AboutPage } from './pages/about-page'
import { ContactPage } from './pages/contact-page'
import { HomePage } from './pages/home-page'
import { LegalPageLayout, PRIVACY, REFUND, SERVICE_DELIVERY, TERMS } from '@/features/legal'
import { NotFoundPage } from './pages/not-found-page'
import { OrderSuccessPage } from './pages/order-success-page'
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
      { path: ROUTES.terms, element: <LegalPageLayout doc={TERMS} /> },
      { path: ROUTES.privacy, element: <LegalPageLayout doc={PRIVACY} /> },
      { path: ROUTES.refund, element: <LegalPageLayout doc={REFUND} /> },
      { path: ROUTES.serviceDelivery, element: <LegalPageLayout doc={SERVICE_DELIVERY} /> },
      { path: ROUTES.orderSuccess, element: <OrderSuccessPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
