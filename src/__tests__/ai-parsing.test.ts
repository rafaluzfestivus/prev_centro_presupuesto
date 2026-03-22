import { describe, it, expect } from 'vitest'
import { parseAIResponseContent, normalizeAIItems } from '@/lib/pricing'

describe('parseAIResponseContent', () => {
    it('parses plain JSON string', () => {
        const input = '{"items": [{"name": "Frente", "width": 3, "height": 2}]}'
        const result = parseAIResponseContent(input) as any
        expect(result.items).toHaveLength(1)
        expect(result.items[0].name).toBe('Frente')
    })

    it('strips ```json markdown wrapper', () => {
        const input = '```json\n{"items": [{"name": "Balcón", "width": 2.5, "height": 1.5}]}\n```'
        const result = parseAIResponseContent(input) as any
        expect(result.items[0].name).toBe('Balcón')
    })

    it('strips plain ``` wrapper', () => {
        const input = '```\n{"items": []}\n```'
        const result = parseAIResponseContent(input) as any
        expect(result.items).toHaveLength(0)
    })

    it('throws on malformed JSON', () => {
        expect(() => parseAIResponseContent('not json at all')).toThrow()
    })

    it('handles whitespace around JSON', () => {
        const input = '  \n{"items": []}\n  '
        const result = parseAIResponseContent(input) as any
        expect(Array.isArray(result.items)).toBe(true)
    })
})

describe('normalizeAIItems', () => {
    it('uses items array when present', () => {
        const input = {
            items: [{ name: 'Frente', width: 3, height: 2 }],
            total: 0
        }
        const result = normalizeAIItems(input)
        expect(result.items[0].name).toBe('Frente')
    })

    it('maps components format to items', () => {
        const input = {
            components: [
                {
                    face: 'Frontal',
                    dimensions: { width_or_depth: 5.25, height: 1.32 },
                    description: 'Frente del balcón'
                }
            ]
        }
        const result = normalizeAIItems(input)
        expect(result.items[0].name).toBe('Frontal')
        expect(result.items[0].width).toBe(5.25)
        expect(result.items[0].height).toBe(1.32)
    })

    it('falls back to comp.name when comp.face is missing', () => {
        const input = {
            components: [{ name: 'Lateral', width: 1.5, height: 2 }]
        }
        const result = normalizeAIItems(input)
        expect(result.items[0].name).toBe('Lateral')
    })

    it('falls back to "Elemento" when neither face nor name exist', () => {
        const input = {
            components: [{ width: 1.5, height: 2 }]
        }
        const result = normalizeAIItems(input)
        expect(result.items[0].name).toBe('Elemento')
    })

    it('throws when items and components are both missing', () => {
        expect(() => normalizeAIItems({ project_summary: 'test' })).toThrow()
    })

    it('throws when items is not an array', () => {
        expect(() => normalizeAIItems({ items: 'wrong' })).toThrow()
    })

    it('recalculates prices and applies minimums', () => {
        const input = {
            items: [{ name: 'Balcón', width: 1, height: 1 }]
        }
        const result = normalizeAIItems(input)
        expect(result.items[0].price).toBe(80)
        expect(result.items[0].price_rule).toBe('Minimo')
    })

    it('normalises comma decimals in items', () => {
        const input = {
            items: [{ name: 'Balcón', width: '2,50', height: '1,00' }]
        }
        const result = normalizeAIItems(input)
        expect(result.items[0].width).toBe(2.5)
    })

    it('computes total as sum of item prices', () => {
        const input = {
            items: [
                { name: 'A', width: 5, height: 2 },   // 10 m² × 28 = 280
                { name: 'B', width: 1, height: 1 },   // minimum 80
            ]
        }
        const result = normalizeAIItems(input)
        expect(result.total).toBe(360)
    })

    it('respects existing item price from AI', () => {
        const input = {
            items: [{ name: 'A', width: 3, height: 2, price: 250 }]
        }
        const result = normalizeAIItems(input)
        expect(result.items[0].price).toBe(250)
    })
})
