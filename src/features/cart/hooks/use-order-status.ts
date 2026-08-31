import { useEffect, useState } from 'react'

import { fetchOrderStatus, type OrderPaymentState } from '@/services'

/**
 * Polls the authoritative order-status endpoint (AIPAY-DOCS §15.1).
 *
 * ⚠ This poll is the PRIMARY settlement trigger in this integration. Airpay
 * delivers its callback to KKChat rather than to this application, so no
 * webhook ever prompts a check. The server settles inline while the shopper
 * waits here, verifying against Airpay Order Confirmation.
 *
 * Start in 'checking', never in a success state: the redirect that landed the
 * shopper on this page carries no claim about the payment (§14.1).
 */

const POLL_INTERVAL_MS = 3_000
const MAX_ATTEMPTS = 20 // ~60 s

export interface UseOrderStatusResult {
  readonly state: OrderPaymentState
  readonly amount: number
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useOrderStatus(
  orderRef: string | null,
  accessToken: string | null,
): UseOrderStatusResult {
  const [state, setState] = useState<OrderPaymentState>('checking')
  const [amount, setAmount] = useState(0)

  useEffect(() => {
    if (!orderRef || !accessToken) return

    let cancelled = false

    // The polling loop is an external system this effect synchronises with;
    // every state update below happens after an await, never synchronously
    // during the effect.
    async function run(): Promise<void> {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const result = await fetchOrderStatus(orderRef as string, accessToken as string).catch(
          () => null,
        )

        if (cancelled) return

        if (result) {
          setAmount(result.amount)
          // 'settled' includes requires_review: the shopper should stop seeing
          // a spinner even though the order is not finished — it waits on a
          // human, and no amount of polling will change it.
          if (result.settled) {
            setState(result.state)
            return
          }
        }

        await wait(POLL_INTERVAL_MS)
        if (cancelled) return
      }

      // Budget exhausted. Report 'unresolved', NOT 'failed': a transient fetch
      // failure is not an answer, and inventing an outcome is exactly the bug
      // this design avoids (edge case 39).
      setState('unresolved')
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [orderRef, accessToken])

  return { state, amount }
}
