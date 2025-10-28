import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('formats currency correctly', () => {
    // Use \u202f (narrow no-break space) which is what Intl.NumberFormat uses
    expect(formatCurrency(1000)).toBe('1\u202f000,00\u00a0€')
    expect(formatCurrency(50.5)).toBe('50,50\u00a0€')
  })
})

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-15')
    expect(formatDate(date)).toMatch(/15\/01\/2024/)
  })
})
