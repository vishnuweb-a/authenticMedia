/**
 * Footer lockup while the ISGPay sandbox is selected — same slot and type
 * scale as AirpayMark, labelled as a test so it never reads as a live gateway.
 */
export function IsgpayMark() {
  return (
    <div>
      <p className="text-[10px] leading-none font-semibold tracking-[0.12em] text-amber-600 uppercase">
        Sandbox test
      </p>
      <p className="mt-1.5 text-[22px] leading-none font-bold tracking-tight text-text">ISGPay</p>
    </div>
  )
}
