import { SITE } from '@/lib/site'
import type { PolicyDocument } from '../types'

const CO = SITE.legalName

export const TERMS: PolicyDocument = {
  title: 'Terms & Conditions',
  metaTitle: 'Terms & Conditions — Authentic Media',
  metaDescription:
    'The terms that apply when you browse authenticmedia.fun and order IT and digital services from Authentic Media and IT Sector Private Limited.',
  path: '/terms',
  intro: `These Terms & Conditions govern your use of ${SITE.website} and your purchase of services from ${CO}. Please read them together with our [Refund & Cancellation Policy](/refund), [Privacy Policy](/privacy) and [Service Delivery Policy](/service-delivery-policy).`,
  sections: [
    {
      id: 'introduction',
      title: 'Introduction',
      blocks: [
        `This website, ${SITE.website}, is operated by ${CO} (trading as ${SITE.shortName}). In these Terms, "we", "us" and "our" mean the Company, and "you" means the person using the Website or placing an Order.`,
        'These Terms are the general terms for the Website and for services bought through it. Where we and you sign or exchange a separate written service agreement, proposal or statement of work for a particular project, that document governs the project-specific matters it covers (such as detailed scope, milestones and fees), and these Terms continue to apply to everything else. If the two conflict on a project-specific matter, the written service agreement prevails.',
      ],
    },
    {
      id: 'definitions',
      title: 'Definitions',
      blocks: [
        {
          list: [
            '"Company" means Authentic Media and IT Sector Private Limited.',
            '"Website" means authenticmedia.fun and its pages.',
            '"User" means anyone who visits or uses the Website; "Customer" means a User who places an Order.',
            '"Services" means the IT, technology, consulting, audit, integration, automation, branding and related digital services listed on the Website from time to time.',
            '"Digital Services" means Services delivered electronically, such as reports, configuration, advice, remote support and digital files, with no physical goods.',
            '"Order" means a request for one or more Services submitted through the Website checkout.',
            '"Payment" means the amount paid for an Order through our third-party payment gateway.',
            '"Deliverables" means the reports, recommendations, configurations, files or other outputs we agree to provide for an Order.',
            '"Service Agreement" means any separate written agreement, proposal or statement of work between you and the Company.',
            '"Cancellation" means a request to stop an Order or Service before it is completed; "Refund" means the return of all or part of a Payment.',
          ],
        },
      ],
    },
    {
      id: 'acceptance',
      title: 'Acceptance of Terms',
      blocks: [
        'Browsing the Website does not by itself amount to your agreement to these Terms. When you place an Order, the checkout asks you to tick an unticked box confirming that you have read and agree to these Terms and acknowledge the Refund & Cancellation Policy. You cannot start a payment until you have ticked it.',
        'If you do not agree with these Terms, please do not place an Order. You may keep reading the Website and contact us with questions first.',
      ],
    },
    {
      id: 'company-information',
      title: 'Company Information',
      blocks: [
        `The Website is operated by ${CO}. Our published address is ${SITE.address.single}. You can reach us at [${SITE.email}](mailto:${SITE.email}) or on [${SITE.phone}](tel:${SITE.phone}). Full details appear in section 26 below.`,
      ],
    },
    {
      id: 'scope-of-services',
      title: 'Scope of Services',
      blocks: [
        'The Website lists fixed-price, one-time IT and digital services. At the date of these Terms they fall into the following groups:',
        {
          list: [
            'Technology support and maintenance (for example Tech Maintenance, Tech Support & Maintenance, Cloud & Hosting).',
            'Security and audit services (for example Cyber & Security Basics, Website Security Audit, SEO Audit Service, Website Health Check).',
            'Software, data, automation and integration services (for example Software Orchestration, Data & Automation Basics, AI & Automation, AI & Automation Advanced, API & Tech Integrations, App & UI Support).',
            'Business and brand services (for example Fintech Partner, Collection Partner, Business Consulting, Branding & Content).',
          ],
        },
        'The description, price and feature list on a Service page is a catalogue summary. It is not a detailed project scope. Where a Service needs a more specific scope (for example which website, system or accounts are covered), we will confirm that scope with you in writing, including by email, before or when work begins. The Services are one-time engagements; the Website does not sell recurring subscriptions.',
      ],
    },
    {
      id: 'eligibility',
      title: 'Customer Eligibility',
      blocks: [
        'You must be able to enter into a legally binding contract under Indian law to place an Order. If you order on behalf of a business, you confirm you are authorised to bind it.',
        'You agree to provide accurate and current contact details and information, to use the Services lawfully, and to be responsible for the information and access you give us. You do not need to create an account to order; checkout is as a guest.',
      ],
    },
    {
      id: 'ordering',
      title: 'Service Ordering',
      blocks: [
        'To order, you add one or more Services to your cart, enter your contact details (an email address or phone number is required; a name is optional), choose the available payment option, accept these Terms and start the payment. We create an Order record when you start a payment.',
        'An Order is complete from the point of sale only once your Payment has been confirmed by us (see section 9). Our acceptance of the Order, and the manual start of work, follow payment confirmation. We may decline or cancel an Order, for example where a Service cannot be provided as described, in which case we will refund any amount you paid for it as set out in the Refund & Cancellation Policy.',
      ],
    },
    {
      id: 'pricing',
      title: 'Pricing and Taxes',
      blocks: [
        'Prices are shown in Indian Rupees (INR). The amount charged is calculated by our systems from the current price of the Services in your cart at the time you pay; the total shown in your cart before payment is the amount you will be asked to pay.',
        'We may change prices at any time, but a change does not affect an Order for which Payment has already been confirmed. Where taxes (such as GST) or other fees apply to an Order, they will be disclosed to you as required by law. If a price is shown to you in error, we will tell you and give you the choice to proceed at the correct price or cancel with a full refund.',
      ],
    },
    {
      id: 'payment',
      title: 'Payment Terms',
      blocks: [
        'Payments are processed by Airpay, a third-party payment gateway, on its own hosted payment page. We do not receive or store your card number, UPI PIN, net-banking credentials or OTP. Airpay and your bank or wallet provider have their own terms.',
        'A message from your bank or a debit alert shows that money has left your account; it does not by itself mean we have confirmed your Payment. We treat a Payment as confirmed only after we have verified the transaction directly with the payment gateway and checked that the amount matches your Order. Until then, the Order may show as pending. If your account has been debited but the Website shows a failed or pending status, please see our [Refund & Cancellation Policy](/refund) and contact us with your order reference; do not pay again.',
      ],
    },
    {
      id: 'commencement',
      title: 'Service Commencement',
      blocks: [
        'Payment confirmation means we have received your money; it does not mean the Service has been performed. Work is started manually by our team after the Order is accepted and we have the information and access we need from you.',
        'We will contact you using the email address or phone number you gave at checkout if we need more information. The date on which work actually begins is recorded by us and matters for cancellation and refunds (see the Refund & Cancellation Policy).',
      ],
    },
    {
      id: 'customer-responsibilities',
      title: 'Customer Responsibilities',
      blocks: [
        'To allow us to perform a Service you agree to:',
        {
          list: [
            'give accurate, complete requirements and respond to our questions in reasonable time;',
            'grant the access we reasonably need (for example to a website, hosting or admin account) and only to systems you own or are authorised to give us access to;',
            'obtain any third-party permissions, licences or consents needed for us to work on your systems or content;',
            'keep your own backups before we make changes, unless the agreed scope says otherwise; and',
            'never share card numbers, UPI PINs, OTPs or passwords for your bank accounts with us. We will never ask for them.',
          ],
        },
        'Where we need credentials for a third-party system, you should share them securely, grant the minimum access necessary, and change or revoke them when the work ends.',
      ],
    },
    {
      id: 'scope-deliverables',
      title: 'Project Scope and Deliverables',
      blocks: [
        'The agreed scope is the Service description on the Website as confirmed or refined in writing with you. Deliverables are the outputs we agree to provide for that scope. We have not set a fixed number of revisions or fixed deadlines for catalogue Services; where revisions, milestones or timelines apply, they will be agreed with you in writing for that Order.',
        'Where work is delivered in milestones, we will tell you when a milestone is ready. Please review and respond within a reasonable time; a milestone you have approved in writing is treated as accepted. A request that goes beyond the agreed scope is a change request: we will tell you whether it can be done and whether it needs additional fees or time, and we will not start it until you agree.',
      ],
    },
    {
      id: 'technical-services',
      title: 'Technical Services',
      blocks: [
        'Our technical Services include software assistance, maintenance and support, security and SEO audits, API and payment-gateway integrations, automation and AI workflows, cloud and hosting guidance, and consulting. We perform them with reasonable skill and care.',
        'Technology outcomes depend on factors outside our control. We do not guarantee that a website or system will be free of vulnerabilities or attacks, that an audit will find every issue, that a particular search ranking or business result will be achieved, or that a solution will be compatible with every device, browser, plugin or third-party system. Audits and reviews reflect the state of the system at the time we examine it.',
      ],
    },
    {
      id: 'third-parties',
      title: 'Third-Party Dependencies',
      blocks: [
        'Some Services rely on third parties we do not control, such as hosting and cloud providers, domain registrars, plugin and theme authors, external APIs, and payment processors. Their availability, pricing, terms and changes can affect a Service. We are not responsible for failures of third-party services, but we will tell you if we become aware of one that affects your Order and will work with you on reasonable alternatives. Fees charged by third parties (for example hosting or domain renewals) are not included in our Service price unless stated.',
      ],
    },
    {
      id: 'intellectual-property',
      title: 'Intellectual Property',
      blocks: [
        'We keep ownership of our pre-existing materials, tools, methods, templates and know-how. You keep ownership of the content, data, logos and systems you give us, and you confirm you have the right to give them to us for the purpose of the Service.',
        'Third-party software, fonts, images and plugins remain subject to their own licences. Unless a written Service Agreement says otherwise, Deliverables created specifically for you are licensed for your use for the purpose for which they were commissioned once you have paid for them; a written Service Agreement may assign ownership differently.',
      ],
    },
    {
      id: 'confidentiality',
      title: 'Confidentiality',
      blocks: [
        'We treat the non-public business, technical and personal information you give us for a Service as confidential. We use it only to perform and support the Service, share it only with people and providers who need it for that purpose and are bound to appropriate confidentiality, and will not disclose it except as you permit or the law requires. This does not apply to information that is public, already known to us, or independently developed. Our handling of personal data is described in the [Privacy Policy](/privacy).',
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable Use',
      blocks: [
        'You must not use the Website or the Services to:',
        {
          list: [
            'commit fraud, including using a payment instrument you are not authorised to use;',
            'gain or attempt unauthorised access to any system, account or data, or ask us to do so;',
            'distribute malware or interfere with the Website, our systems or other users;',
            'engage in any unlawful activity or infringe anyone else\'s rights; or',
            'misrepresent your identity or ownership of a system we are asked to work on.',
          ],
        },
        'We may refuse or stop a Service, and where the law requires we may report misuse to the authorities.',
      ],
    },
    {
      id: 'delivery-delays',
      title: 'Service Delivery and Delays',
      blocks: [
        'Our Services are fulfilled manually by our team; delivery is electronic and nothing is shipped. Timelines depend on the nature of the Service, how quickly you provide information and access, and technical or third-party factors. We have not published fixed turnaround times for catalogue Services; any timeline will be one we have agreed with you in writing. We will keep you informed if we expect a significant delay. Details are in the [Service Delivery Policy](/service-delivery-policy).',
      ],
    },
    {
      id: 'refund-cancellation',
      title: 'Refund and Cancellation',
      blocks: [
        'Cancellations and refunds are governed by our [Refund & Cancellation Policy](/refund), which forms part of these Terms. Nothing in these Terms or that policy limits any right you have under applicable consumer protection law.',
      ],
    },
    {
      id: 'limitations',
      title: 'Service Limitations',
      blocks: [
        'Support is provided for the scope of the Service you bought and for a reasonable period afterwards to correct material errors in the Deliverables; it is not open-ended maintenance unless you have bought a maintenance Service. We do not promise uninterrupted availability of the Website. We do not guarantee security outcomes, business results, rankings or regulatory approvals. Advice we give is general professional advice for your situation as described to us and is not legal, tax or financial advice.',
      ],
    },
    {
      id: 'suspension-termination',
      title: 'Suspension and Termination',
      blocks: [
        'We may suspend or end work on an Order if you breach these Terms, use the Services unlawfully, fail to provide information or access we reasonably need after a reasonable reminder, or if we are unable to continue for reasons beyond our control. You may ask us to stop work at any time.',
        'Where an Order ends, we will account for any amount you have paid: we will refund amounts for work not performed, and we may retain a fair, itemised amount for work properly performed or approved third-party costs actually incurred, as described in the Refund & Cancellation Policy and subject to your statutory rights. We will not retain money for work we did not do.',
      ],
    },
    {
      id: 'warranties-liability',
      title: 'Warranties and Liability',
      blocks: [
        'We will provide the Services with reasonable skill and care and substantially in line with the agreed scope. Except for that and anything the law does not allow us to exclude, the Services are provided on an "as available" basis without other warranties.',
        'To the extent permitted by law, we are not liable for indirect or consequential loss, loss of profits or data, or for loss caused by third-party services, by information or access you did not provide correctly, or by events outside our reasonable control. Our total liability for a claim relating to an Order is limited to the amount you paid for that Order, except where the law does not permit such a limit (for example for fraud or for liability that cannot lawfully be excluded). Nothing in these Terms waives your rights as a consumer under the Consumer Protection Act, 2019 or other mandatory law.',
      ],
    },
    {
      id: 'disputes',
      title: 'Complaints and Dispute Resolution',
      blocks: [
        `If you have a complaint, please write to [${SITE.email}](mailto:${SITE.email}) with your order reference and details, and we will try to resolve it in good faith. Please also see the escalation section of the [Refund & Cancellation Policy](/refund).`,
        'If a complaint is not resolved, you may use the remedies available to you under Indian law, including approaching the appropriate Consumer Disputes Redressal Commission or the National Consumer Helpline (1915) if you are a consumer. Subject to those rights and to any court or forum that has mandatory jurisdiction, courts at Noida, Uttar Pradesh, have jurisdiction over disputes under these Terms.',
      ],
    },
    {
      id: 'changes',
      title: 'Policy Changes',
      blocks: [
        'We may update these Terms from time to time. The version and date are shown at the top of this page. A change applies to Orders placed after it is published. For an Order already placed, the Terms in force when you accepted them continue to apply unless you agree to the change or the law requires otherwise.',
      ],
    },
    {
      id: 'governing-law',
      title: 'Governing Law',
      blocks: [
        'These Terms are governed by the laws of India, including the Indian Contract Act, 1872, the Information Technology Act, 2000 and the Consumer Protection Act, 2019, subject to any mandatory consumer-protection and jurisdiction provisions that apply to you.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact Details',
      blocks: ['You can contact us using the details below.'],
    },
    {
      id: 'version',
      title: 'Effective Date and Version',
      blocks: [
        'The current version and date of these Terms appear at the top of this page. We will publish an effective date when these Terms are approved for publication.',
      ],
    },
  ],
}
