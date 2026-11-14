import { GRIEVANCE } from './grievance'
import { PRIVACY } from './privacy'
import { REFUND } from './refund'
import { SERVICE_DELIVERY } from './service-delivery'
import { TERMS } from './terms'
import type { PolicyDocument } from '../types'

/**
 * Every published policy, in display order. The header menu, the mobile menu
 * and the /policies hub all read this one list, so a policy cannot be linked in
 * one place and missing in another.
 */
export const POLICIES: readonly PolicyDocument[] = [
  TERMS,
  PRIVACY,
  REFUND,
  SERVICE_DELIVERY,
  GRIEVANCE,
]
