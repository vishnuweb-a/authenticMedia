import { LEGAL, SITE } from '@/lib/site'
import type { PolicyDocument } from '../types'

const MAIL = `[${SITE.email}](mailto:${SITE.email})`
const officer = LEGAL.grievanceOfficer

export const GRIEVANCE: PolicyDocument = {
  title: 'Grievance Redressal',
  metaTitle: 'Grievance Redressal — Authentic Media',
  metaDescription:
    'How to raise a complaint with Authentic Media and IT Sector Private Limited, who handles it, and how to escalate it.',
  path: '/grievance-redressal',
  intro: `This page explains how to raise a complaint about a Service, an Order, a payment or the handling of your personal data with ${SITE.legalName}, and how to escalate it if you are not satisfied. It forms part of our [Terms & Conditions](/terms).`,
  sections: [
    {
      id: 'officer',
      title: 'Grievance Officer',
      // Officer details come only from LEGAL in site.ts; nobody is named here
      // until the company has formally designated them.
      blocks: officer
        ? [
            {
              list: [
                `Name: ${officer.name}`,
                `Designation: ${officer.designation}`,
                `Email: [${officer.email}](mailto:${officer.email})`,
                `Phone: ${officer.phone}`,
              ],
            },
          ]
        : [
            `The name and direct contact details of our designated Grievance Officer will be published on this page. Until then, grievances are received and handled by the company at ${MAIL} and ${SITE.phone}, and are dealt with exactly as described below.`,
          ],
    },
    {
      id: 'what',
      title: 'What You Can Complain About',
      blocks: [
        'You can raise a grievance about any part of your dealings with us, including: a Service that was not delivered or not delivered as agreed; a payment that failed, is pending, or was taken twice; a refund or cancellation request; the conduct of our team; or how we collect and use your personal data.',
      ],
    },
    {
      id: 'how',
      title: 'How to Submit a Complaint',
      blocks: [
        `Email ${officer ? `[${officer.email}](mailto:${officer.email})` : MAIL} with the subject line "Grievance", or call ${officer ? officer.phone : SITE.phone}. To help us resolve it quickly, please include:`,
        {
          list: [
            'your name and the email or phone number you used at checkout;',
            'your order reference, if the complaint relates to an Order;',
            'what happened, and the date it happened; and',
            'what outcome you are asking for.',
          ],
        },
        'Never send us your OTP, UPI PIN, password, full card number or CVV. We will never ask for them.',
      ],
    },
    {
      id: 'handling',
      title: 'How Complaints Are Handled',
      blocks: [
        'Every complaint is read by a person, not an automated system. We will acknowledge your complaint, look into it using our Order and payment records, and reply with our findings and what we will do. We will acknowledge and resolve complaints within the time limits required by applicable law, including the Consumer Protection (E-Commerce) Rules, 2020. If we need more information from you, we will ask.',
      ],
    },
    {
      id: 'escalation',
      title: 'Escalation',
      blocks: [
        `If you are not satisfied with our response, ${officer ? `email our Grievance Officer at [${officer.email}](mailto:${officer.email})` : `reply to the same thread or email ${MAIL}`} marking the subject "Escalation", and it will be reviewed again. You may also use the remedies available to you by law, including the National Consumer Helpline (1915 or consumerhelpline.gov.in) and the Consumer Disputes Redressal Commission. For a problem with a bank transaction, you may also use your bank's grievance process and, if it remains unresolved, the RBI Ombudsman.`,
      ],
    },
    {
      id: 'related',
      title: 'Related Policies',
      blocks: [
        'Refunds and cancellations are covered by the [Refund & Cancellation Policy](/refund), service delivery by the [Service Delivery Policy](/service-delivery-policy), and personal data by the [Privacy Policy](/privacy).',
      ],
    },
    {
      id: 'contact',
      title: 'Company Contact Details',
      blocks: ['Complaints can also be sent by post to our registered office below.'],
    },
  ],
}
