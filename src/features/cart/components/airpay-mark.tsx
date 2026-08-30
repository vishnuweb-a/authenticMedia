/**
 * The "SECURED BY airpay" lockup in the drawer footer.
 *
 * Text-only and purely presentational: it is a trust mark, not an integration.
 * The wordmark colour (#0066A6) and its ~79px width are measured from
 * cart(screenshot).png. No provider SDK, script, or credential is involved.
 */
export function AirpayMark() {
  return (
    <div>
      <p className="text-[10px] leading-none font-semibold tracking-[0.12em] text-text-subtle uppercase">
        Secured by
      </p>
      <p className="mt-1.5 text-[22px] leading-none font-bold tracking-tight text-[#0066A6]">
        airpay
      </p>
    </div>
  )
}
