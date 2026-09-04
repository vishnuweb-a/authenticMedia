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
  // ⚠ This route is the receiver for BOTH merchants (§2.4). MID 368250 has
  // always delivered here; MID 362380 now registers this same URL in its own
  // Airpay dashboard instead of posting to KKChat directly, so this
  // application is the sole receiver for both and forwards both onward.
  //
  // The ACCEPTED SET is stated by the route; the individual merchant is never
  // taken as an instruction from the payload. A delivery is matched to one
  // accepted credential set by its stated MID — compared against the server's
  // own environment — and, when an envelope is present, only a key that
  // actually OPENS it is accepted. So the decryption key is still never chosen
  // from the unauthenticated bytes. A MID belonging to neither merchant is
  // rejected before anything is opened, and is never relayed.
  //
  // Forwarding does NOT depend on a local order existing: an external payment
  // taken on either MID by another portal is parsed, settles to unknown_order
  // with no database write, and is forwarded to KKChat regardless.
  //
  // Deliberately no method gate. Airpay posts here, and the browser leg may
  // arrive as a GET; answering 405 to either is the failure this route exists
  // to fix. An unrecognised method still parses to nothing and gets a safe 2xx.
  await handleAirpayCallback(req, res, { relay: true })
}
