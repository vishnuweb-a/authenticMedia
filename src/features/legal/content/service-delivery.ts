import { SITE } from '@/lib/site'
import type { PolicyDocument } from '../types'

const MAIL = `[${SITE.email}](mailto:${SITE.email})`

export const SERVICE_DELIVERY: PolicyDocument = {
  title: 'Service Delivery Policy',
  metaTitle: 'Service Delivery Policy — Authentic Media',
  metaDescription:
    'How Authentic Media delivers its IT and digital services after you order: confirmation, start of work, communication, delays and completion.',
  path: '/service-delivery-policy',
  intro: `Everything ${SITE.legalName} sells on ${SITE.website} is a digital or IT service delivered electronically and fulfilled by our team by hand. This page explains what happens after you pay. It forms part of our [Terms & Conditions](/terms).`,
  sections: [
    {
      id: 'nature',
      title: 'Nature of Our Services',
      blocks: [
        'Our Services are one-time, fixed-price digital and IT services such as audits, reviews, configuration, integrations, support, automation, branding and consulting. They are delivered remotely and electronically, for example by report, written advice, configuration work on your systems, or files sent to you. We ship no physical goods, so there are no shipping charges or delivery addresses.',
        'Fulfilment is manual. The Website does not deliver a Service automatically when you pay.',
      ],
    },
    {
      id: 'confirmation',
      title: 'Order Confirmation',
      blocks: [
        'After you pay, the order page checks your payment with the payment gateway and shows whether it has been confirmed. That page is your confirmation on screen, with your order reference. At present the Website does not send an automatic confirmation email, so please keep your order reference. If you do not hear from us, contact us.',
      ],
    },
    {
      id: 'commencement',
      title: 'Service Commencement',
      blocks: [
        'Work starts manually once your payment is confirmed, we have accepted the Order, and we have the information and access we need from you. Payment confirmation alone does not mean the Service is complete or has begun. We will contact you using the email or phone you gave at checkout.',
      ],
    },
    {
      id: 'communication',
      title: 'Customer Communication',
      blocks: [
        `We communicate mainly by email, and sometimes by phone, using the contact details you gave at checkout. You can reach us at ${MAIL} or ${SITE.phone}. Please quote your order reference. Please tell us if your contact details change.`,
      ],
    },
    {
      id: 'information',
      title: 'Information We May Need From You',
      blocks: [
        'Depending on the Service, we may need: your website or system address; the access we need to work on it (given only for systems you own or may authorise); descriptions of the issue or goal; brand materials or content; and decisions at agreed points. Never send card numbers, UPI PINs, OTPs or bank passwords.',
      ],
    },
    {
      id: 'scope',
      title: 'Scope Confirmation',
      blocks: [
        'The Service page gives a summary. Where the Service needs more precise definition, we will confirm the scope with you in writing before or when we start. Anything beyond the confirmed scope is a change request that we will discuss with you first.',
      ],
    },
    {
      id: 'delivery-methods',
      title: 'Delivery Methods',
      blocks: [
        'We deliver by whichever method suits the Service: a written report or document sent by email or shared link; changes made directly in your systems with the access you give us; or recorded recommendations and calls. We will tell you how your particular Deliverables will be provided.',
      ],
    },
    {
      id: 'timelines',
      title: 'Timelines',
      blocks: [
        'We have not published fixed delivery times for catalogue Services, because the time needed depends on the Service and on you. When we confirm the scope, we will tell you the expected timing where we can give one, and any timeline we agree with you in writing is the one that applies.',
      ],
    },
    {
      id: 'delays',
      title: 'Delays and Dependencies',
      blocks: [
        'Delivery can be delayed if we are waiting for information, access or approvals from you, if a third-party provider (hosting, domain, API or platform) is slow or unavailable, or because of technical issues or events outside our reasonable control. We will tell you when we expect a significant delay. If a Service cannot be delivered, you may be entitled to a refund under the [Refund & Cancellation Policy](/refund).',
      ],
    },
    {
      id: 'completion',
      title: 'Service Completion',
      blocks: [
        'A Service is complete when the agreed Deliverables have been provided to you. We will tell you when we consider the work delivered. Please review the Deliverables promptly and tell us of any material problem so we can address it. Milestones or Deliverables you approve in writing are treated as accepted.',
      ],
    },
    {
      id: 'support',
      title: 'Support and Escalation',
      blocks: [
        `If you have a question or a problem with a delivered Service, email ${MAIL} with your order reference. If the response does not resolve it, follow the escalation steps in the [Refund & Cancellation Policy](/refund).`,
      ],
    },
    {
      id: 'refunds',
      title: 'Cancellations and Refunds',
      blocks: [
        'If you want to cancel or have a delivery problem, see the [Refund & Cancellation Policy](/refund). Whether work has started, as recorded by us, affects what can be refunded.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact Details',
      blocks: ['You can contact us using the details below.'],
    },
  ],
}
