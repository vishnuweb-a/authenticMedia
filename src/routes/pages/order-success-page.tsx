import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock, Loader2, SearchX } from 'lucide-react'

import { Container, Section } from '@/components/layout'
import { formatInr } from '@/lib/format'
import { useOrderStatus } from '@/features/cart'

/**
 * The post-payment landing page.
 *
 * ⚠ The URL that lands the shopper here carries NO claim about the payment
 * (AIPAY-DOCS §14.1). A redirect proves only that a browser was pointed at a
 * URL — anyone can type one. This page therefore starts in "checking" and asks
 * the server, which asks Airpay's Order Confirmation. Nothing here decides
 * whether the order is paid.
 *
 * Because Airpay delivers its callback to KKChat rather than to this
 * application, this poll is also what TRIGGERS settlement for most orders.
 */
export function OrderSuccessPage() {
  const [params] = useSearchParams()
  const orderRef = params.get('ref')
  const token = params.get('t')

  const { state, amount } = useOrderStatus(orderRef, token)

  if (!orderRef || !token) {
    return (
      <Outcome
        icon={<SearchX aria-hidden="true" className="size-10 text-text-muted" />}
        title="We could not find that order"
        body="The link is missing its order reference. Check the link from your confirmation email, or contact us with your order number."
      />
    )
  }

  switch (state) {
    case 'checking':
      return (
        <Outcome
          icon={
            <Loader2 aria-hidden="true" className="size-10 animate-spin text-text-muted" />
          }
          title="Confirming your payment"
          body="We are checking with the payment gateway. This usually takes a few seconds — please do not close this page."
          reference={orderRef}
          busy
        />
      )

    case 'paid':
      return (
        <Outcome
          icon={<CheckCircle2 aria-hidden="true" className="size-10 text-emerald-400" />}
          title="Payment confirmed"
          body={`We have received ${amount > 0 ? formatInr(amount) : 'your payment'}. We will be in touch shortly to get started.`}
          reference={orderRef}
        />
      )

    case 'failed':
      return (
        <Outcome
          icon={<AlertCircle aria-hidden="true" className="size-10 text-red-400" />}
          title="That payment did not go through"
          body="No money has been taken. You can try again from your cart, or contact us if you think this is a mistake."
          reference={orderRef}
        />
      )

    case 'requires-review':
      return (
        <Outcome
          icon={<Clock aria-hidden="true" className="size-10 text-amber-400" />}
          title="Your payment needs a quick check"
          body="We have received a payment but the amount did not match your order, so our team is reviewing it manually. We will contact you shortly — please do not pay again."
          reference={orderRef}
        />
      )

    case 'unresolved':
      // ⚠ Never reported as "failed": a polling budget running out is not an
      // answer, and inventing an outcome is the bug this design avoids.
      return (
        <Outcome
          icon={<Clock aria-hidden="true" className="size-10 text-amber-400" />}
          title="Still confirming your payment"
          body="This is taking longer than usual. Your payment may still complete — please do not pay again. Refresh this page in a few minutes, or contact us with your order reference."
          reference={orderRef}
        />
      )

    case 'not-found':
      return (
        <Outcome
          icon={<SearchX aria-hidden="true" className="size-10 text-text-muted" />}
          title="We could not find that order"
          body="This link may have expired or been mistyped. Contact us with your order reference and we will look it up."
          reference={orderRef}
        />
      )
  }
}

interface OutcomeProps {
  icon: React.ReactNode
  title: string
  body: string
  reference?: string
  busy?: boolean
}

function Outcome({ icon, title, body, reference, busy }: OutcomeProps) {
  return (
    <Section>
      <Container>
        <div
          className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center"
          role="status"
          aria-live="polite"
          aria-busy={busy ? 'true' : undefined}
        >
          {icon}
          <h1 className="text-2xl font-bold text-text sm:text-3xl">{title}</h1>
          <p className="text-[15px] leading-relaxed text-text-muted">{body}</p>
          {reference && (
            <p className="mt-2 text-[13px] text-text-muted">
              Order reference: <span className="font-mono text-text">{reference}</span>
            </p>
          )}
        </div>
      </Container>
    </Section>
  )
}
