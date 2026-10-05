const money = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percentage = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 })

export const formatMoney = (value: number): string => money.format(value)
export const formatPercentage = (value: number): string => percentage.format(value / 100)
