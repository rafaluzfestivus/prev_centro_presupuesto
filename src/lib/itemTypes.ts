// ── Item categories ───────────────────────────────────────────────────────────

export type ItemCategory = 'net' | 'post' | 'post45'

/** Detects the category of an item based on its name. */
export function getItemCategory(name: string): ItemCategory {
    const lower = name.toLowerCase()
    if ((lower.includes('valla') || lower.includes('vala')) && lower.includes('45')) return 'post45'
    if (lower.includes('poste') || lower.includes('poste de soporte')) return 'post'
    return 'net'
}

// ── Unit prices for structural elements ──────────────────────────────────────

export const UNIT_PRICES: Record<ItemCategory, number | null> = {
    net: null,      // calculated from area × 28 €/m²
    post: 30.00,    // €/unit
    post45: 45.00,  // €/unit
}

/** Labels shown in the UI for each category */
export const ITEM_FIELD_LABELS: Record<ItemCategory, { field1: string; field2: string }> = {
    net: { field1: 'Largo (m)', field2: 'Alto (m)' },
    post: { field1: 'Unidades', field2: 'Medidas (m)' },
    post45: { field1: 'Unidades', field2: 'Medidas (m)' },
}

/** Calculate price for any item category */
export function calcItemPrice(category: ItemCategory, field1: number, field2: number): number {
    if (category === 'net') {
        const area = field1 * field2
        return Math.max(80, parseFloat((area * 28).toFixed(2)))
    }
    const unitPrice = UNIT_PRICES[category] ?? 30
    return parseFloat((field1 * unitPrice).toFixed(2))
}
