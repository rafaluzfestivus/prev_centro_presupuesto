'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Loader2, ChevronRight } from 'lucide-react'
import { getProposalDetailsAction } from '@/actions/proposal'
import { saveBuilderItemsAction } from '@/actions/proposal'
import { PRICING } from '@/lib/constants'

// ─── Types ───────────────────────────────────────────────────────────────────

const ITEM_TYPES = [
    'Ventana',
    'Terraza Frente',
    'Terraza Lateral',
    'Balcón',
    'Poste de Soporte',
    'Techo',
    'Personalizado',
] as const

type ItemType = typeof ITEM_TYPES[number]

interface BuilderItem {
    id: string
    type: ItemType
    name: string
    width: number
    height: number
}

// ─── Mockup generator ────────────────────────────────────────────────────────

function calcArea(item: BuilderItem) {
    return Number(item.width) * Number(item.height)
}

function calcPrice(item: BuilderItem) {
    const area = calcArea(item)
    return Math.max(PRICING.MIN_PRICE_PER_ITEM, area * PRICING.PRICE_PER_M2)
}

function generateMockup(items: BuilderItem[]): string {
    if (items.length === 0) return '  (sem ítems — añade items para ver el plano)'

    const lines: string[] = ['  PLANO DE INSTALACIÓN', '  ' + '─'.repeat(32), '']

    items.forEach((item, i) => {
        const w = Number(item.width) || 0
        const h = Number(item.height) || 0
        const area = (w * h).toFixed(2)
        const boxW = Math.min(28, Math.max(14, Math.round(w * 4)))

        const label = `${i + 1}. ${item.name.toUpperCase()}`
        lines.push(label)

        lines.push(`  +${'-'.repeat(boxW)}+`)

        const dimText = ` ${w.toFixed(2)}m × ${h.toFixed(2)}m `
        lines.push(`  |${dimText.padEnd(boxW)}|`)

        const areaText = ` ${area}m² `
        lines.push(`  |${areaText.padEnd(boxW)}|`)

        lines.push(`  +${'-'.repeat(boxW)}+`)
        lines.push('')
    })

    return lines.join('\n')
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function BuilderPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    const [proposalName, setProposalName] = useState('')
    const [proposalCity, setProposalCity] = useState('')
    const [items, setItems] = useState<BuilderItem[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)

    // Add form state
    const [formType, setFormType] = useState<ItemType>('Ventana')
    const [formName, setFormName] = useState('Ventana')
    const [formWidth, setFormWidth] = useState('')
    const [formHeight, setFormHeight] = useState('')
    const [showForm, setShowForm] = useState(false)

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Load proposal info
    useEffect(() => {
        getProposalDetailsAction(id).then(r => {
            if (r.success && r.data) {
                setProposalName(r.data.proposal.cliente_nome)
                setProposalCity(r.data.proposal.cidade)
                // If there are already items saved, load them
                const existing = r.data.items
                if (existing && existing.length > 0) {
                    setItems(existing.map((it, idx) => ({
                        id: it.id || `item_${idx}`,
                        type: 'Personalizado' as ItemType,
                        name: it.nome_ambiente,
                        width: it.largura,
                        height: it.altura,
                    })))
                }
            }
        })
    }, [id])

    const handleTypeChange = (type: ItemType) => {
        setFormType(type)
        if (type !== 'Personalizado') setFormName(type)
    }

    const parseDecimal = (v: string) => parseFloat(v.replace(',', '.'))

    const handleAddItem = () => {
        const w = parseDecimal(formWidth)
        const h = parseDecimal(formHeight)
        if (!formName.trim() || isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
            setError('Preencha nome, largura e altura com valores válidos.')
            return
        }
        setError('')

        if (editingId) {
            setItems(prev => prev.map(it =>
                it.id === editingId
                    ? { ...it, type: formType, name: formName.trim(), width: w, height: h }
                    : it
            ))
            setEditingId(null)
        } else {
            setItems(prev => [...prev, {
                id: `item_${Date.now()}`,
                type: formType,
                name: formName.trim(),
                width: w,
                height: h,
            }])
        }

        setFormType('Ventana')
        setFormName('Ventana')
        setFormWidth('')
        setFormHeight('')
        setShowForm(false)
    }

    const handleEdit = (item: BuilderItem) => {
        setFormType(item.type)
        setFormName(item.name)
        setFormWidth(String(item.width).replace('.', ','))
        setFormHeight(String(item.height).replace('.', ','))
        setEditingId(item.id)
        setShowForm(true)
    }

    const handleDelete = (itemId: string) => {
        setItems(prev => prev.filter(it => it.id !== itemId))
        if (editingId === itemId) {
            setEditingId(null)
            setShowForm(false)
        }
    }

    const handleCancel = () => {
        setEditingId(null)
        setShowForm(false)
        setFormType('Ventana')
        setFormName('Ventana')
        setFormWidth('')
        setFormHeight('')
        setError('')
    }

    const totalItems = items.map(it => ({
        name: it.name,
        width: it.width,
        height: it.height,
        area: calcArea(it),
        price: calcPrice(it),
    }))
    const total = totalItems.reduce((acc, it) => acc + it.price, 0)
    const mockup = generateMockup(items)

    const formAreaPreview = (() => {
        const w = parseDecimal(formWidth)
        const h = parseDecimal(formHeight)
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null
        const area = w * h
        const price = Math.max(PRICING.MIN_PRICE_PER_ITEM, area * PRICING.PRICE_PER_M2)
        return { area: area.toFixed(2), price: price.toFixed(2) }
    })()

    const handleGenerate = async () => {
        if (items.length === 0) { setError('Añade al menos un ítem.'); return }
        setSaving(true)
        setError('')
        try {
            const result = await saveBuilderItemsAction(id, totalItems, mockup, total)
            if (result.success) router.push(`/proposal/${id}/review`)
            else setError(result.error || 'Erro ao salvar')
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Novo Orçamento</p>
                            <h1 className="text-base font-black text-navy leading-tight">
                                {proposalName || '...'}
                                {proposalCity && <span className="ml-2 text-accent font-bold text-sm">— {proposalCity}</span>}
                            </h1>
                        </div>
                    </div>
                    <Button
                        onClick={handleGenerate}
                        disabled={saving || items.length === 0}
                        className="bg-accent hover:bg-accent/90 text-navy font-black px-6 h-10"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                        Gerar Proposta
                    </Button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: items + form */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Section header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black uppercase tracking-widest text-navy">Ambientes Detectados</h2>
                        {!showForm && (
                            <Button
                                onClick={() => { setShowForm(true); setEditingId(null) }}
                                variant="outline"
                                size="sm"
                                className="rounded-full border-2 border-accent text-navy font-black hover:bg-accent"
                            >
                                <Plus className="h-4 w-4 mr-1" /> Añadir
                            </Button>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <X size={14} className="shrink-0" />
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="ml-auto"><X size={12} /></button>
                        </div>
                    )}

                    {/* Item cards */}
                    {items.length === 0 && !showForm && (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                            <Plus className="h-10 w-10 text-gray-200 mb-3" />
                            <p className="text-sm font-bold text-gray-400">Nenhum ambiente adicionado</p>
                            <p className="text-xs text-gray-300 mt-1">Clique em "Añadir" para começar</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {items.map((item, idx) => {
                            const area = calcArea(item)
                            const price = calcPrice(item)
                            return (
                                <div key={item.id} className={`flex items-center gap-4 p-4 bg-white rounded-2xl border-2 transition-all ${editingId === item.id ? 'border-accent' : 'border-gray-100 hover:border-accent/30'}`}>
                                    <span className="w-8 h-8 rounded-full bg-accent/20 text-navy font-black flex items-center justify-center text-xs shrink-0">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-navy truncate">{item.name}</p>
                                        <p className="text-xs text-gray-400 font-medium">
                                            {Number(item.width).toFixed(2)}m × {Number(item.height).toFixed(2)}m
                                            <span className="ml-2 text-accent font-bold">{area.toFixed(2)}m²</span>
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-navy text-sm">€ {price.toFixed(2)}</p>
                                        {price === PRICING.MIN_PRICE_PER_ITEM && (
                                            <p className="text-[9px] text-orange-500 font-bold">mín.</p>
                                        )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => handleEdit(item)} className="p-2 rounded-lg text-gray-300 hover:text-navy hover:bg-gray-100 transition-colors">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Add/Edit form */}
                    {showForm && (
                        <div className="bg-white border-2 border-accent/30 rounded-2xl p-6 space-y-4 shadow-lg">
                            <p className="text-xs font-black uppercase tracking-widest text-navy">
                                {editingId ? 'Editar Ítem' : 'Novo Ítem'}
                            </p>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-gray-400">Tipo</Label>
                                <div className="flex flex-wrap gap-2">
                                    {ITEM_TYPES.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => handleTypeChange(type)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                                                formType === type
                                                    ? 'bg-accent border-accent text-navy'
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-accent/50'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-gray-400">Nome do Espaço</Label>
                                <Input
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="Ex: Ventana Principal"
                                    className="bg-gray-50 border-none rounded-xl font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">Largo (m)</Label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={formWidth}
                                        onChange={e => setFormWidth(e.target.value)}
                                        placeholder="0,00"
                                        className="bg-gray-50 border-none rounded-xl font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">Alto (m)</Label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={formHeight}
                                        onChange={e => setFormHeight(e.target.value)}
                                        placeholder="0,00"
                                        className="bg-gray-50 border-none rounded-xl font-bold"
                                    />
                                </div>
                            </div>

                            {/* Live preview */}
                            {formAreaPreview && (
                                <div className="flex items-center gap-3 bg-accent/10 rounded-xl px-4 py-3">
                                    <span className="text-xs font-bold text-navy">{formAreaPreview.area}m²</span>
                                    <span className="text-gray-300">·</span>
                                    <span className="text-sm font-black text-navy">€ {formAreaPreview.price}</span>
                                    {parseFloat(formAreaPreview.price) === PRICING.MIN_PRICE_PER_ITEM && (
                                        <span className="text-[10px] text-orange-500 font-bold">(tarifa mínima)</span>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <Button
                                    onClick={handleAddItem}
                                    className="flex-1 bg-navy text-white font-black rounded-xl hover:bg-navy/90"
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    {editingId ? 'Guardar Cambios' : 'Añadir Ítem'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleCancel}
                                    className="text-gray-500 font-bold rounded-xl"
                                >
                                    <X className="h-4 w-4 mr-1" /> Cancelar
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Total */}
                    {items.length > 0 && (
                        <div className="bg-navy rounded-2xl p-6 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-white/50 font-black uppercase">Total do Orçamento</p>
                                <p className="text-[10px] text-white/30 mt-0.5">{items.length} ambiente{items.length !== 1 ? 's' : ''}</p>
                            </div>
                            <p className="text-3xl font-black text-accent tracking-tighter">€ {total.toFixed(2)}</p>
                        </div>
                    )}
                </div>

                {/* Right: mockup preview */}
                <div className="lg:col-span-2">
                    <div className="sticky top-24 bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="bg-navy px-5 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-accent">Plano de Instalação</p>
                        </div>
                        <pre className="bg-navy text-accent p-5 font-mono text-[9px] leading-tight min-h-[320px] whitespace-pre-wrap overflow-auto">
                            {mockup}
                        </pre>
                        <div className="px-5 py-3 border-t border-gray-100">
                            <p className="text-[9px] text-gray-400 italic text-center">* Podrás editar el plano manualmente en el siguiente paso.</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom action bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-xl py-4 px-6 flex items-center justify-between z-20">
                <p className="text-xs text-gray-400 font-medium">
                    {items.length === 0 ? 'Nenhum ítem adicionado' : `${items.length} ítem${items.length !== 1 ? 's' : ''} — € ${total.toFixed(2)}`}
                </p>
                <Button
                    onClick={handleGenerate}
                    disabled={saving || items.length === 0}
                    className="bg-accent hover:bg-accent/90 text-navy font-black px-8 h-12 text-base"
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                    Gerar Proposta
                </Button>
            </div>
            <div className="h-20" />
        </div>
    )
}
