/**
 * Version metadata shared by every policy and by the checkout consent line.
 *
 * DRAFT: the business owner has not approved these texts, so no "effective
 * date" is claimed. When approved, set `effectiveDate` and bump `version`.
 */
export const POLICY_META: {
  readonly version: string
  readonly preparedOn: string
  readonly effectiveDate: string | null
} = {
  version: '1.0-draft',
  preparedOn: '2 November 2026',
  effectiveDate: null,
}
