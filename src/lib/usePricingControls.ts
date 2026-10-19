import { useState } from 'react'
import type { BillingCycle, Currency } from '../types'

/** Shared billing-cycle and currency state for pricing toggles and cards. */
export function usePricingControls() {
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const [currency, setCurrency] = useState<Currency>('INR')
  return { cycle, setCycle, currency, setCurrency }
}

export type PricingControls = ReturnType<typeof usePricingControls>
