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

  const { state, amount, testMode } = useOrderStatus(orderRef, token)

  if (!orderRef || !token) {
    if (params.get('status') === 'unverified') {
      return (
        <Outcome
          icon={<AlertCircle aria-hidden="true" className="size-10 text-amber-600" />}
          title="We could not verify the gateway response"
          body="The payment gateway's reply could not be verified, so nothing has been recorded against it. If you were charged, contact us and we will check it with the gateway."
        />
      )
    }
    return (
      <Outcome
        icon={<SearchX aria-hidden="true" className="size-10 text-text-muted" />}
        title="We could not find that order"
        body="The link is missing its order reference. Check the link you were given, or contact us with your order number."
      />
    )
  }

  // ISGPay UAT: say so on every state, so a test can never read as a purchase.
  const note = testMode
    ? 'ISGPay sandbox test transaction — not a real purchase. No real money moves and no service is delivered.'
    : undefined

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
          note={note}
          busy
        />
      )

    case 'paid':
      return testMode ? (
        <Outcome
          icon={<CheckCircle2 aria-hidden="true" className="size-10 text-emerald-600" />}
          title="Sandbox test payment verified"
          body={`The ISGPay sandbox confirmed this test payment${amount > 0 ? ` of ${formatInr(amount)}` : ''} with a server-side status check.`}
          reference={orderRef}
          note={note}
        />
      ) : (
        <Outcome
          icon={<CheckCircle2 aria-hidden="true" className="size-10 text-emerald-600" />}
          title="Payment confirmed"
          body={`We have received ${amount > 0 ? formatInr(amount) : 'your payment'}. Our team will contact you using the details you gave at checkout to get started.`}
          reference={orderRef}
          note={note}
        />
      )

    case 'declined':
      return (
        <Outcome
          icon={<AlertCircle aria-hidden="true" className="size-10 text-red-600" />}
          title="Payment not approved"
          body="The gateway reports that this payment was declined or cancelled. You can try again from your cart. If your account was debited, contact us with your order reference."
          reference={orderRef}
          note={note}
        />
      )

    case 'failed':
      return (
        <Outcome
          icon={<AlertCircle aria-hidden="true" className="size-10 text-red-600" />}
          title="That payment did not go through"
          body="We could not confirm this payment. If your account was debited, your bank normally reverses it automatically; please check your statement and contact us with your order reference if the amount is not returned. You can also try again from your cart. See our Refund & Cancellation Policy for details."
          reference={orderRef}
          note={note}
        />
      )

    case 'requires-review':
      return (
        <Outcome
          icon={<Clock aria-hidden="true" className="size-10 text-amber-600" />}
          title="Your payment needs a quick check"
          body="We have received a payment but the amount did not match your order, so our team is reviewing it manually. We will contact you shortly — please do not pay again."
          reference={orderRef}
          note={note}
        />
      )

    case 'unresolved':
      // ⚠ Never reported as "failed": a polling budget running out is not an
      // answer, and inventing an outcome is the bug this design avoids.
      return (
        <Outcome
          icon={<Clock aria-hidden="true" className="size-10 text-amber-600" />}
          title="Still confirming your payment"
          body="This is taking longer than usual. Your payment may still complete — please do not pay again. Refresh this page in a few minutes, or contact us with your order reference."
          reference={orderRef}
          note={note}
        />
      )

    case 'not-found':
      return (
        <Outcome
          icon={<SearchX aria-hidden="true" className="size-10 text-text-muted" />}
          title="We could not find that order"
          body="This link may have expired or been mistyped. Contact us with your order reference and we will look it up."
          reference={orderRef}
          note={note}
        />
      )
  }
}

interface OutcomeProps {
  icon: React.ReactNode
  title: string
  body: string
  reference?: string
  /** Sandbox notice, shown above the heading. */
  note?: string | undefined
  busy?: boolean
}

function Outcome({ icon, title, body, reference, note, busy }: OutcomeProps) {
  return (
    <Section>
      <Container>
        <div
          className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center"
          role="status"
          aria-live="polite"
          aria-busy={busy ? 'true' : undefined}
        >
          {note && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] font-semibold text-amber-800">
              {note}
            </p>
          )}
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
