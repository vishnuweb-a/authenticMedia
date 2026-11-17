import { noStore, type ApiRequest, type ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig } from '../../_lib/isgpay-config.js'
import { readForm, refFromGatewayPost } from '../../_lib/isgpay-http.js'
import { settleIsgpayOrder } from '../../_lib/isgpay-settle.js'
import { logEvent } from '../../_lib/log.js'

/**
 * POST /api/payments/isgpay/callback — ISGPay push response (v1.6 §3.6).
 *
 * The callback is a PROMPT: its TxnRefNo triggers a Status Query and that
 * alone decides. Never forwarded to the Airpay/KKChat relay.
 *
 * Ack (§3.6.2: MerchantId, TerminalId, BankId, Acknowledgement=Received). Wire
 * encoding UNCONFIRMED (docs Q8); k=v& is used. No ack on an unreadable
 * envelope or a server error, so ISGPay reposts (max 3, 30 min apart).
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  let config
  try {
    config = loadIsgpayConfig()
  } catch {
    res.status(503).json({ error: 'unavailable' })
    return
  }

  const ref = refFromGatewayPost(config, await readForm(req))
  if (ref.ok === false) {
    logEvent('isgpay.callback.unreadable', { reason: ref.reason })
    res.status(400).json({ error: 'invalid_request' })
    return
  }

  try {
    const result = await settleIsgpayOrder(config, ref.txnRefNo)
    logEvent('isgpay.callback', { txnRefNo: ref.txnRefNo, outcome: result.outcome })
  } catch {
    logEvent('isgpay.callback.settle_error', { txnRefNo: ref.txnRefNo })
    res.status(500).json({ error: 'retry' })
    return
  }

  res.setHeader('Content-Type', 'application/x-www-form-urlencoded')
  res.status(200).send(
    new URLSearchParams({
      MerchantId: config.merchantId,
      TerminalId: config.terminalId,
      BankId: config.bankId,
      Acknowledgement: 'Received',
    }).toString(),
  )
}
