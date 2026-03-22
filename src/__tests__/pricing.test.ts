import { describe, it, expect } from 'vitest'
import { calculateItemPrice, parseDecimal } from '@/lib/pricing'

describe('parseDecimal', () => {
    it('passes through numeric values', () => {
        expect(parseDecimal(2.5)).toBe(2.5)
        expect(parseDecimal(0)).toBe(0)
    })

    it('replaces comma with dot', () => {
        expect(parseDecimal('2,50')).toBe(2.5)
        expect(parseDecimal('1,32')).toBe(1.32)
    })

    it('parses string numbers without comma', () => {
        expect(parseDecimal('3.14')).toBe(3.14)
    })
})

describe('calculateItemPrice', () => {
    it('calculates area as width × height', () => {
        const result = calculateItemPrice(5, 2)
        expect(result.area).toBe(10)
    })

    it('applies 28 €/m² rate for large areas', () => {
        // 5 × 2 = 10 m² → 10 × 28 = 280 € > minimum 80 €
        const result = calculateItemPrice(5, 2)
        expect(result.price).toBe(280)
        expect(result.price_rule).toBe('Calculado')
    })

    it('enforces 80 € minimum price', () => {
        // 1 × 1 = 1 m² → 1 × 28 = 28 € < minimum 80 €
        const result = calculateItemPrice(1, 1)
        expect(result.price).toBe(80)
        expect(result.price_rule).toBe('Minimo')
    })

    it('applies minimum when area is zero', () => {
        const result = calculateItemPrice(0, 2)
        expect(result.price).toBe(80)
        expect(result.price_rule).toBe('Minimo')
        expect(result.area).toBe(0)
    })

    it('exactly at the minimum threshold uses minimum rule', () => {
        // area × 28 = 80 → area = 80/28 ≈ 2.857 m²
        // 1 × 1 = 1 m² → 28 < 80 → minimum
        const result = calculateItemPrice(1, 1)
        expect(result.price_rule).toBe('Minimo')
    })

    it('normalizes comma decimal separators', () => {
        const result = calculateItemPrice('2,50', '1,32')
        expect(result.width).toBe(2.5)
        expect(result.height).toBe(1.32)
        expect(result.area).toBe(parseFloat((2.5 * 1.32).toFixed(2)))
    })

    it('respects existing price when provided', () => {
        const result = calculateItemPrice(1, 1, 120)
        expect(result.price).toBe(120)
    })

    it('returns width and height as numbers', () => {
        const result = calculateItemPrice('3,50', '2,10')
        expect(result.width).toBe(3.5)
        expect(result.height).toBe(2.1)
    })

    it('known test case: 5.25 × 1.32 = 194.04 €', () => {
        const result = calculateItemPrice(5.25, 1.32)
        expect(result.area).toBe(parseFloat((5.25 * 1.32).toFixed(2)))
        expect(result.price).toBe(parseFloat((5.25 * 1.32 * 28).toFixed(2)))
        expect(result.price_rule).toBe('Calculado')
    })
})
