const money = /(?:(USD|EUR|GBP|US\$|[$€£])\s*(\d+(?:[.,\u00a0 ]\d{3})*(?:[.,]\d{1,2})?)|(\d+(?:[.,\u00a0 ]\d{3})*(?:[.,]\d{1,2})?)\s*(USD|EUR|GBP|€|£))/gi

function amount(raw: string): number {
  let s = raw.replace(/[\s\u00a0]/g, '')
  const decimal = /[.,]\d{1,2}$/.exec(s)
  if (decimal) s = s.slice(0, decimal.index).replace(/[.,]/g, '') + '.' + s.slice(decimal.index + 1)
  else s = s.replace(/[.,]/g, '')
  return Number(s)
}

export function parsePrices(title: string): { price: number | null; listPrice: number | null; currency: string } {
  const values = [...title.matchAll(money)].map(m => {
    const symbol = (m[1] || m[4] || '').toUpperCase()
    const before = title.slice(Math.max(0, m.index! - 35), m.index).toLowerCase()
    const after = title.slice(m.index! + m[0].length, m.index! + m[0].length + 24).toLowerCase()
    return {
      value: amount(m[2] || m[3]!),
      currency: /EUR|€/.test(symbol) ? 'EUR' : /GBP|£/.test(symbol) ? 'GBP' : 'USD',
      list: /\b(?:was|were|list(?: price)?|msrp|rrp|regular(?:ly)?(?: price)?|reg\.?|orig\.?|original(?:ly)?(?: price)?|antes|down from)\s*[:=]?\s*$/.test(before) || /^\s*(?:list price|msrp|rrp)\b/.test(after)
        || /\(\s*(?:a\s+)?$/.test(before) && /^\s+value\s*\)/.test(after),
      excluded: /(?:save|saving(?:s)?(?: of)?|coupon(?: of)?|shipping(?:\s+(?:w\/|with|on orders over))?|delivery|gift card|rebate)\s*[:=]?\s*$/.test(before) || /^\s*(?:off\b|shipping\b|delivery\b|gift cards?\b|rebate\b|coupon\b|\/\s*(?:mo|month)\b)/.test(after),
    }
  })
  const sale = values.find(v => !v.list && !v.excluded)
  const currency = sale?.currency || values[0]?.currency || 'USD'
  // Shipping, trials, BOGO, percentage-only and coupon amounts are not product prices.
  const free = /\b(?:free to keep|free game|free download|100% off|gratis)\b/i.test(title) || /^\s*(?:\[[^\]]+\]\s*)?free\s+(?!shipping|delivery|trial)/i.test(title)
  const price = sale?.value ?? (free ? 0 : null)
  const reference = values.find(v => v.list && v.currency === currency)
  const listPrice = reference && price !== null && reference.value > price ? reference.value : null
  return { price, listPrice, currency }
}
