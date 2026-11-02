import { SITE } from '@/lib/site'
import type { PolicyDocument } from '../types'

const MAIL = `[${SITE.email}](mailto:${SITE.email})`

export const REFUND: PolicyDocument = {
  title: 'Refund & Cancellation Policy',
  metaTitle: 'Refund & Cancellation Policy — Authentic Media',
  metaDescription:
    'How cancellations, refunds, failed, pending and duplicate payments are handled for services bought from Authentic Media and IT Sector Private Limited.',
  path: '/refund',
  intro: `This policy explains how we handle cancellation requests and refunds for Services bought on ${SITE.website}. Refunds and cancellations are handled by our team on request by email; there is no automatic or self-service refund or cancellation feature on the Website yet. This policy is part of our [Terms & Conditions](/terms).`,
  sections: [
    {
      id: 'applicability',
      title: 'Introduction and Applicability',
      blocks: [
        `This policy applies to every Service you buy from ${SITE.legalName} through the Website. Our Services are one-time, fixed-price digital and IT services delivered electronically. Nothing is shipped, and there are no recurring subscriptions, so there is no automatic renewal to cancel.`,
      ],
    },
    {
      id: 'principles',
      title: 'General Refund Principles',
      blocks: [
        'We assess each request fairly, on the facts of your Order: what you paid, whether work has started, what has been delivered, and the reason you give. We will not keep money for work we have not done.',
        'Being eligible for a refund and receiving the money are two separate steps. Eligibility is our decision on your request; the money then has to be returned through the payment gateway and your bank, which takes additional time (see section 16). This policy does not reduce any right you have under applicable consumer protection law.',
      ],
    },
    {
      id: 'before-work',
      title: 'Cancellation Before Work Begins',
      blocks: [
        'If you ask to cancel before we have started work on your Order, you are entitled to a refund of the amount you paid for the cancelled Service. We do not apply an arbitrary cancellation fee. If a payment-gateway or bank charge was irretrievably incurred on your transaction and cannot be recovered, we will tell you before deducting anything and show the amount.',
        'Work is treated as having started when our team has begun performing the Service for your Order, for example by accessing your systems, starting the audit or configuration, or delivering a first output. We record that start date and will tell you what it is if you ask. Merely receiving your payment or sending you a question does not mean work has started.',
      ],
    },
    {
      id: 'after-work',
      title: 'Cancellation After Work Begins',
      blocks: [
        'If you cancel after work has begun, we will assess how much of the Service has been performed. You may be refunded the portion that relates to work not yet performed. We may retain a fair, itemised amount that reflects work actually done, milestones you have approved in writing, and third-party costs we have genuinely incurred for your Order, subject to the agreement we have with you and to applicable law.',
        'We will explain our calculation in writing and you may question it. Where the Service has been only slightly started, the deduction will be correspondingly small.',
      ],
    },
    {
      id: 'completed',
      title: 'Completed Services',
      blocks: [
        'Once a Service has been fully delivered in line with the agreed scope, the price is generally not refundable, because the work has been done. This does not apply where the Service is materially deficient or does not conform to what was agreed. In that case we will first try to put it right by correcting or re-doing the work, and if we cannot do so within a reasonable time you may be entitled to a full or partial refund.',
      ],
    },
    {
      id: 'technology-consulting',
      title: 'Technology and Consulting Services',
      blocks: [
        'Our offerings include maintenance and support, security and SEO audits, website health checks, integrations and webhook set-up, cloud and hosting guidance, app and UI support, automation and AI work, branding and content, and business consulting. These are time-based or output-based professional services, so the refund usually depends on how far the work has progressed:',
        {
          list: [
            'Audits and reports: refundable in full before analysis starts; once the report or findings are delivered, treated as completed.',
            'Support, maintenance and fixes: refundable for the part of the engagement not yet carried out; a fix that has been applied and works as agreed is treated as performed.',
            'Integrations and automation: refundable in proportion to the work not yet done, after taking account of approved milestones and third-party costs actually incurred.',
            'Consulting and advice: sessions or advice already given are treated as performed; unused sessions or work are refundable.',
          ],
        },
        'A Service that does not produce the business result you hoped for (for example a search ranking, or a security finding you did not expect) is not by that fact a deficient Service, if we delivered what was agreed with reasonable skill and care.',
      ],
    },
    {
      id: 'delivery-issues',
      title: 'Digital Service Delivery Issues',
      blocks: [
        'If you have paid but we have not started or cannot deliver the Service, if it was supplied incorrectly, or if what you received is materially different from the approved scope, tell us. Where the problem is ours, we will either correct it within a reasonable time or refund the affected amount, at your choice if we cannot correct it.',
      ],
    },
    {
      id: 'failed-payments',
      title: 'Failed Payment Transactions',
      blocks: [
        'If your payment shows as failed but money has left your account, do not assume that no money was collected. The Website\'s status reflects what the payment gateway has confirmed to us, and a failure on screen does not prove your bank did not debit you. Banks and payment systems normally reverse an unsuccessful debit automatically; under Reserve Bank of India rules the outer time limits for many such reversals are measured in days, not minutes.',
        `Please wait for the automatic reversal. If the amount has not returned to your account within the period your bank or payment provider quotes, email ${MAIL} with your order reference (if you have one), the date and amount, and your bank or UPI transaction reference, and we will help check the transaction with the payment gateway. For a debit not yet reversed by your bank, you can also raise the matter with your bank.`,
      ],
    },
    {
      id: 'pending-payments',
      title: 'Pending Transactions',
      blocks: [
        'Sometimes the gateway takes longer than usual to confirm a payment. Your Order will then show that we are still confirming it. Please do not pay again; our systems re-check pending payments, and we also run a periodic check of unresolved payments. If the status is still unresolved after a reasonable time, or your account has been debited and you have heard nothing, email us with your order reference and transaction details and we will investigate.',
      ],
    },
    {
      id: 'duplicate-payments',
      title: 'Duplicate Payments',
      blocks: [
        'If you were charged twice (or more) for one Order, for example by paying again while the first payment was pending, tell us. We will check our records and the gateway\'s, and where we confirm that more than was due was collected, we will refund the excess to you, or arrange a reversal, through the original payment channel.',
      ],
    },
    {
      id: 'wrong-amount',
      title: 'Incorrect Payment Amounts',
      blocks: [
        'We compare the amount actually received with the amount due for your Order. If they do not match, we hold the Order for manual review instead of treating it as simply paid or failed, and we will contact you. If you paid too much, we refund the difference. If you paid too little, we will ask whether you want to pay the balance or cancel with a refund. We will not start work on an Order whose amount is in dispute until it is sorted out, unless you ask us to.',
      ],
    },
    {
      id: 'company-cancellation',
      title: 'Company-Initiated Cancellation',
      blocks: [
        'If we cannot deliver a Service you have paid for, or we decline an Order, we will tell you and refund everything you paid for it, with no deduction, unless we have delivered part of it, in which case we will refund the portion not delivered. Where we stop work because of your breach of the Terms or because you have not given the information or access we need, we will deal with accepted payments fairly as set out in the Terms, and not retain money for work we did not do.',
      ],
    },
    {
      id: 'request-procedure',
      title: 'Refund Request Procedure',
      blocks: [
        `To request a refund or cancellation, email ${MAIL}. Please include only what is needed:`,
        {
          list: [
            'your name;',
            'your order reference (shown on the order page) and the Service you bought;',
            'the payment date and the amount paid;',
            'the reason for your request; and',
            'any supporting evidence, such as a screenshot of the error or a bank statement line.',
          ],
        },
        'Never send us your OTP, UPI PIN, password, full card number or CVV. We will never ask for them. There is no refund form on the Website at present; email is the channel. Please also use the order reference to avoid delay.',
      ],
    },
    {
      id: 'review',
      title: 'Review and Approval',
      blocks: [
        'Requests are reviewed by our team. We check the payment record, the state of the Order and how much work has been done, and then tell you our decision and, if a deduction applies, how it was calculated. There is no automated approval: each request is looked at by a person.',
      ],
    },
    {
      id: 'partial-refunds',
      title: 'Partial Refunds',
      blocks: [
        'Where a Service has been partly delivered, the refund is the amount you paid less a fair amount for work already performed and approved, plus any genuine and documented third-party costs we incurred for your Order. We will show how we reached each figure. We do not add penalty charges.',
      ],
    },
    {
      id: 'processing',
      title: 'Refund Processing',
      blocks: [
        'A refund passes through several stages: we receive your request; we review eligibility; we approve (and tell you the amount); we initiate the refund; the payment gateway and your bank or payment provider process it; and finally the money is credited to you. We control the first four stages. The last two depend on the gateway and your bank, and can take several working days after we initiate the refund.',
        'We aim to acknowledge requests and decide them promptly and will keep you informed. Specific turnaround times will be published here once confirmed. Refunds are currently initiated manually; the Website does not yet show live refund tracking, so please contact us for the status of your request.',
      ],
    },
    {
      id: 'destination',
      title: 'Refund Destination',
      blocks: [
        'We aim to refund through the same payment method you used, which is normally the best way to return money safely. This depends on what the payment gateway and your bank support. If the original method cannot receive a refund, we will agree an alternative with you, but only against proper verification of the account holder.',
      ],
    },
    {
      id: 'non-refundable',
      title: 'Non-Refundable Circumstances',
      blocks: [
        'Subject to your statutory rights, a refund is generally not available where:',
        {
          list: [
            'the Service has been fully delivered as agreed;',
            'you ask for a refund because you changed your mind after the work has been done;',
            'work could not proceed because information or access we reasonably asked for was not provided, and we have already performed work for which we are entitled to be paid;',
            'the Service was used unlawfully or you breached the Terms; or',
            'the amount relates to genuine third-party costs already incurred for your Order and disclosed to you.',
          ],
        },
        'None of these excludes a remedy you are entitled to by law, for example for a Service that is deficient or not as described.',
      ],
    },
    {
      id: 'unauthorized',
      title: 'Unauthorized Transactions and Chargebacks',
      blocks: [
        'If you did not authorise a transaction, report it to your bank or card issuer immediately and email us with the details so we can look into it. You may have a right to dispute a transaction with your bank; the bank\'s or payment provider\'s process runs alongside this policy. If a chargeback is raised, we will respond to it with our records. We would be grateful if you contact us first, since we can often resolve a problem faster directly.',
      ],
    },
    {
      id: 'consumer-rights',
      title: 'Consumer Rights',
      blocks: [
        'This policy does not remove or reduce any rights you have as a consumer under the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020 (as amended) or other applicable law. If this policy and a mandatory legal right ever conflict, the legal right prevails.',
      ],
    },
    {
      id: 'escalation',
      title: 'Grievance Escalation',
      blocks: [
        `Start with ${MAIL}, quoting your order reference. If you are not satisfied with the response, you may escalate to the same address, marking the subject "Escalation", and you may use the remedies available to you by law, including the National Consumer Helpline (1915 or consumerhelpline.gov.in) and the Consumer Disputes Redressal Commission. For a transaction problem with your bank you may also approach your bank's grievance process and, if unresolved, the RBI Ombudsman.`,
      ],
    },
    {
      id: 'changes',
      title: 'Policy Modifications',
      blocks: [
        'We may update this policy. The version appears at the top of this page. An update applies to Orders placed after it is published; Orders already placed continue under the policy you accepted at checkout, unless the change is more favourable to you or the law requires otherwise.',
      ],
    },
    {
      id: 'contact',
      title: 'Business Contact Details',
      blocks: ['Refund and cancellation requests can be sent to the contact below.'],
    },
    {
      id: 'effective-date',
      title: 'Effective Date',
      blocks: [
        'The current version and date of this policy appear at the top of this page. An effective date will be published when this policy is approved.',
      ],
    },
  ],
}
