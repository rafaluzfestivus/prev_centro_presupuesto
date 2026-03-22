import { PRICING } from './constants'

export function parseDecimal(value: number | string): number {
    return parseFloat(String(value).replace(',', '.'))
}

export function calculateItemPrice(
    rawWidth: number | string,
    rawHeight: number | string,
    existingPrice?: number
): { width: number; height: number; area: number; price: number; price_rule: 'Minimo' | 'Calculado' } {
    const width = parseDecimal(rawWidth)
    const height = parseDecimal(rawHeight)
    const area = parseFloat((width * height).toFixed(2))
    const calculated = area * PRICING.PRICE_PER_M2
    const finalPrice = Math.max(calculated, PRICING.MIN_PRICE_PER_ITEM)
    const price = existingPrice !== undefined ? existingPrice : parseFloat(finalPrice.toFixed(2))
    const price_rule = finalPrice <= PRICING.MIN_PRICE_PER_ITEM ? 'Minimo' : 'Calculado'
    return { width, height, area, price, price_rule }
}

export function parseAIResponseContent(content: string): unknown {
    let cleaned = content.trim()
    if (cleaned.startsWith('```')) {
        const parts = cleaned.split('```')
        const jsonPart = parts.find(p => p.includes('{') && p.includes('}'))
        if (jsonPart) {
            cleaned = jsonPart.replace(/^(json|)\n/, '').trim()
        }
    }
    return JSON.parse(cleaned)
}

export function normalizeAIItems(result: any): any {
    // Support both "items" and "components" response formats
    if (!result.items && result.components) {
        result.items = result.components.map((comp: any) => ({
            name: comp.face || comp.name || 'Elemento',
            width: comp.dimensions?.width_or_depth ?? comp.width ?? 0,
            height: comp.dimensions?.height ?? comp.height ?? 0,
            description: comp.description ?? '',
            price: comp.price,
            price_rule: comp.price_rule,
        }))
    }

    if (!result.items || !Array.isArray(result.items)) {
        throw new Error('La IA no generó los ítems correctamente. Verifica que las medidas estén claras en el pedido.')
    }

    result.items = result.items.map((item: any) => {
        const calc = calculateItemPrice(item.width, item.height, item.price || undefined)
        return { ...item, ...calc }
    })

    result.total = parseFloat(
        result.items.reduce((sum: number, item: any) => sum + item.price, 0).toFixed(2)
    )

    return result
}
