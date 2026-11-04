import type { Organization } from '../../types'

/** True once the workspace has the details needed for GST-ready quotes and correct regional formatting. */
export const businessDetailsComplete = (org: Organization | null) =>
  Boolean(org?.legalName && org.address?.line1 && org.address.city && org.address.pincode && org.stateCode && org.timezone && org.currency)
