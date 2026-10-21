/** Keep recorded cents/paise visible while leaving whole amounts compact. */
export function formatCampaignMoney(minor: number | null | undefined, currency = 'INR') {
  if (minor == null) return '—'
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100)
}
