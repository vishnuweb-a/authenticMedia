import { handleAirpayCallback } from '../../../_lib/callback-flow.js'
import type { ApiRequest, ApiResponse } from '../../../_lib/http.js'

/**
 * POST|GET /callback/cpm/arp_frontiva/collection   (AIPAY-DOCS §8)
 *
 * Airpay's Response URL AND IPN URL for this MID, both registered in the
 * Airpay dashboard as:
 *
 *     https://authenticmedia.fun/callback/cpm/arp_frontiva/collection
 *
 * ⚠ §8.1 — Airpay calls the URL registered in its DASHBOARD, not one this
 * application sends at transaction time. The dashboard is not ours to change,
 * so the application moves to meet it. Before this route existed, `/callback/…`
 * fell through the SPA catch-all rewrite and was served statically: GET
 * returned index.html and POST got 405, so nothing Airpay sent ever reached a
 * handler and a real payment was stranded exactly that way.
 *
 * The vercel.json rewrite that exposes this file MUST stay ABOVE the SPA
 * catch-all.
 *
 * One URL, two kinds of caller (§8.2): the browser return and Airpay's IPN
 * daemon both arrive here. Both settle identically and unconditionally through
 * the shared pipeline; only the reply shape differs.
 *
 * ⚠ A callback is a prompt to go and check, never proof of payment (§0). This
 * route contains no settlement logic, no verification and no database write of
 * its own — it delegates to the one settleOrder, which decides solely on
 * Airpay's Order Confirmation.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  // Deliberately no method gate. Airpay posts here, and the browser leg may
  // arrive as a GET; answering 405 to either is the failure this route exists
  // to fix. An unrecognised method still parses to nothing and gets a safe 2xx.
  await handleAirpayCallback(req, res, { relay: true })
}
