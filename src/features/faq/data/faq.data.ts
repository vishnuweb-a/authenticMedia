import { SITE } from '@/lib/site'

export interface FaqItem {
  id: string
  question: string
  /** Paragraphs; `[label](/path)` renders as a link. */
  answer: readonly string[]
}

export interface FaqGroup {
  id: string
  title: string
  items: readonly FaqItem[]
}

const MAIL = `[${SITE.email}](mailto:${SITE.email})`

/**
 * FAQ content (audit report §4.4).
 *
 * Every answer restates the published policies or the actual checkout
 * behaviour — no payment method, refund timeframe or support SLA is stated
 * here that the policies do not state. If a policy changes, change the
 * matching answer in the same commit.
 */
export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: 'services',
    title: 'Services and ordering',
    items: [
      {
        id: 'what-services',
        question: 'What services does Authentic Media provide?',
        answer: [
          'We provide one-time, fixed-price IT and digital services for businesses, including tech maintenance, website security and SEO audits, website health checks and fixes, integrations, software orchestration, data and AI automation, branding and content, and business consulting. The full list, with prices, is on the [Services](/services) page.',
          'All services are delivered remotely and electronically — for example as a report, written advice, configuration work on your systems, or files sent to you. Nothing is shipped.',
        ],
      },
      {
        id: 'how-to-book',
        question: 'How do I book or request a service?',
        answer: [
          'Choose a service on the [Services](/services) page and add it to your cart. At checkout, enter your name, email and phone number, accept the policies, and pay on the payment gateway’s secure page. After your payment is confirmed, our team contacts you on the email or phone you gave to confirm the scope and start work.',
          `If you are not sure which service fits, or you need something that is not listed, [contact us](/contact) first at ${MAIL}.`,
        ],
      },
      {
        id: 'after-ordering',
        question: 'What happens after I order a service?',
        answer: [
          'The order page checks your payment with the payment gateway and shows whether it is confirmed, with your order reference. The Website does not send an automatic confirmation email at present, so please keep that reference.',
          'Fulfilment is manual: once your payment is confirmed and we have accepted the order, our team contacts you on the email or phone you gave to confirm the scope and ask for anything we need. Work starts once we have that information and access. See our [Service Delivery Policy](/service-delivery-policy).',
        ],
      },
      {
        id: 'custom-work',
        question: 'Can I request customised work?',
        answer: [
          `Catalogue services have a fixed price and the scope summarised on each service page. If you need something different or not listed, [contact us](/contact) at ${MAIL} before ordering and we will tell you whether we can help. Where we agree a separate written proposal or statement of work for a project, that document sets its scope, milestones and fees, as explained in our [Terms & Conditions](/terms).`,
        ],
      },
      {
        id: 'information-required',
        question: 'What information do you need to start a service?',
        answer: [
          'It depends on the service. We may need your website or system address, access to work on it (only for systems you own or may authorise), a description of the issue or goal, brand materials or content, and your decisions at agreed points. We will tell you exactly what we need when we confirm the scope.',
          'Never send us card numbers, UPI PINs, OTPs or bank passwords.',
        ],
      },
      {
        id: 'account',
        question: 'Do I need to create an account?',
        answer: [
          'No. Orders are placed as a guest, and you do not need an account or password. After paying, you receive an order reference on the order status page — please keep it, as it is how we find your order. How we handle the details you give at checkout is explained in our [Privacy Policy](/privacy).',
        ],
      },
      {
        id: 'pricing',
        question: 'How are service prices determined?',
        answer: [
          'Each catalogue service has a fixed price, shown on the service card and in your cart before you pay. The price covers the service as summarised on its card; where a service needs a more precise scope (for example, which website or system is covered), we confirm that scope with you in writing before or when work begins. Anything beyond the confirmed scope is discussed with you first and is never charged without your agreement.',
        ],
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments and delivery',
    items: [
      {
        id: 'payment-methods',
        question: 'How do I pay?',
        answer: [
          'Payment is made online through Airpay, a third-party payment gateway, on its own hosted payment page. The payment options available to you are shown on that page. We never receive or store your card number, UPI PIN, net-banking password or OTP, and we will never ask you for them.',
          'Your order is treated as paid only after we have verified the payment directly with the gateway and checked that the amount matches your order. See "Payment Terms" in our [Terms & Conditions](/terms).',
        ],
      },
      {
        id: 'payment-pending',
        question: 'My account was debited but the order shows pending or failed. What should I do?',
        answer: [
          'Please do not pay again. Pending payments are re-checked automatically. If the payment failed, your bank normally reverses the debit on its own. If the amount is not returned within the period your bank quotes, email us with your order reference, the date and amount, and your bank or UPI transaction reference. Details are in our [Refund & Cancellation Policy](/refund).',
        ],
      },
      {
        id: 'timelines',
        question: 'How long does delivery take?',
        answer: [
          'We do not publish fixed delivery times for catalogue services, because the time needed depends on the service and on how quickly we receive the information and access we need from you. When we confirm the scope with you, we tell you the expected timing, and any timeline agreed in writing is the one that applies. See our [Service Delivery Policy](/service-delivery-policy).',
        ],
      },
      {
        id: 'deliverables',
        question: 'How are deliverables shared?',
        answer: [
          'By whichever method suits the service: a written report or document sent by email or shared link, changes made directly in your systems with the access you give us, or recorded recommendations and calls. We tell you how your deliverables will be provided. See "Delivery Methods" in our [Service Delivery Policy](/service-delivery-policy).',
        ],
      },
      {
        id: 'remote',
        question: 'Which services are delivered remotely?',
        answer: [
          'All of them. Every service is delivered remotely and electronically by our team. We ship no physical goods, so there are no shipping charges or delivery addresses.',
        ],
      },
      {
        id: 'changes',
        question: 'Can I request changes?',
        answer: [
          'Yes. We have not set a fixed number of revisions for catalogue services; where revisions apply, they are agreed with you in writing for that order. A request that goes beyond the agreed scope is a change request: we tell you whether it can be done and whether it needs additional fees or time, and we do not start it until you agree. See our [Terms & Conditions](/terms).',
        ],
      },
    ],
  },
  {
    id: 'refunds',
    title: 'Cancellations and refunds',
    items: [
      {
        id: 'cancel',
        question: 'How can I cancel a service?',
        answer: [
          `Email ${MAIL} with your order reference. If work has not started, you are entitled to a refund of the amount paid for that service. If work has started, we refund the part not yet performed and explain any deduction in writing. There is no self-service cancellation on the website at present; email is the channel.`,
        ],
      },
      {
        id: 'refund-process',
        question: 'What is the refund process?',
        answer: [
          'Every request is reviewed by a person. We check the payment record and how much work has been done, tell you our decision and the amount, and then initiate the refund — normally to the same payment method you used. After we initiate it, the payment gateway and your bank need additional time to credit it. The full process, including partial refunds and non-refundable cases, is in our [Refund & Cancellation Policy](/refund).',
        ],
      },
      {
        id: 'refund-policy',
        question: 'Where can I read the refund policy?',
        answer: [
          'Our [Refund & Cancellation Policy](/refund) covers cancellations, refund eligibility, how to request a refund, how requests are reviewed, failed, pending and duplicate payments, and non-refundable cases. It is also linked from the footer and from the [Policies](/policies) page.',
        ],
      },
    ],
  },
  {
    id: 'support',
    title: 'Support and complaints',
    items: [
      {
        id: 'support',
        question: 'How do I contact support?',
        answer: [
          `Email ${MAIL} or call ${SITE.phone}, quoting your order reference if you have one. All our contact details are on the [Contact Us](/contact) page.`,
        ],
      },
      {
        id: 'complaint',
        question: 'How do I submit a complaint?',
        answer: [
          'Email us with the subject line "Grievance", or call us, with your name, order reference (if any), what happened and the outcome you are asking for. The full procedure is on our [Grievance Redressal](/grievance-redressal) page.',
        ],
      },
      {
        id: 'complaint-handling',
        question: 'How are complaints handled?',
        answer: [
          'Every complaint is read by a person, checked against our order and payment records, and answered with our findings and what we will do, within the time limits required by applicable law. If you are not satisfied, you can escalate it, and you keep every remedy available to you by law, including the National Consumer Helpline. See [Grievance Redressal](/grievance-redressal).',
        ],
      },
      {
        id: 'data-protection',
        question: 'How is my information protected?',
        answer: [
          'We use measures such as encrypted connections (HTTPS), restricted database access rules, server-side-only handling of payment secrets, and verification of payments with the gateway. We never receive your card number, UPI PIN or banking password — those are entered on the payment gateway’s own page. No online system is completely secure. What we collect, why, and your choices are explained in our [Privacy Policy](/privacy).',
        ],
      },
    ],
  },
]
