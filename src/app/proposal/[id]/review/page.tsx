'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, RefreshCw, Save, Send, Loader2, Trash2, Plus } from 'lucide-react'
import { getProposalDetailsAction, processProposalWithAIAction, confirmProposalAction } from '@/actions/proposal'
import { ProposalItem as DBProposalItem } from '@/lib/types'

// Frontend Data Structure
type ProposalItem = {
    id: string
    name: string
    width: number
    height: number
    area: number
    price: number
    price_rule?: string
}

type ProposalData = {
    clientName: string
    city: string
    items: ProposalItem[]
    mockup: string
    logic: string
    total: number
}

export default function ReviewPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    const [data, setData] = useState<ProposalData | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [isReprocessing, setIsReprocessing] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [id])

    const loadData = async () => {
        setLoading(true)
        const result = await getProposalDetailsAction(id)
        if (result.success && result.data) {
            const { proposal, items, processing } = result.data

            // Map DB items to frontend structure
            const mappedItems: ProposalItem[] = items.map(item => ({
                id: item.id,
                name: item.nome_ambiente,
                width: item.largura,
                height: item.altura,
                area: item.area_m2,
                price: item.valor_total,
                price_rule: 'Calculado' // Default/Unknown from DB
            }))

            setData({
                clientName: proposal.cliente_nome,
                city: proposal.cidade,
                items: mappedItems,
                mockup: processing?.mockup_ascii || '',
                logic: processing?.logica_calculo || '',
                total: Number(proposal.total_geral || processing?.total_calculado || 0)
            })
        }
        setLoading(false)
    }

    // Handlers for manual edits
    const handleUpdateItem = (id: string, field: keyof ProposalItem, value: string | number) => {
        if (!data) return
        const newItems = data.items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value }
                // Recalculate area if dimensions change
                if (field === 'width' || field === 'height') {
                    const w = field === 'width' ? Number(value) : item.width
                    const h = field === 'height' ? Number(value) : item.height
                    updated.area = w * h
                    // Only simple recalc if price wasn't manually set? For now, we overwrite.
                    const calculated = updated.area * 28
                    updated.price = Math.max(80, calculated)
                }

                if (field === 'price') {
                    updated.price = Number(value)
                    updated.price_rule = 'Manual'
                }

                return updated
            }
            return item
        })

        const newTotal = newItems.reduce((acc, item) => acc + item.price, 0)
        setData(prev => prev ? ({ ...prev, items: newItems, total: newTotal }) : null)
    }

    const handleAddItem = () => {
        if (!data) return
        const newItem: ProposalItem = {
            id: `new_${Date.now()}`,
            name: 'Nuevo Item',
            width: 0,
            height: 0,
            area: 0,
            price: 80,
            price_rule: 'Manual'
        }
        const newItems = [...data.items, newItem]
        const newTotal = newItems.reduce((acc, item) => acc + item.price, 0)
        setData({ ...data, items: newItems, total: newTotal })
    }

    const handleDeleteItem = (id: string) => {
        if (!data) return
        const newItems = data.items.filter(item => item.id !== id)
        const newTotal = newItems.reduce((acc, item) => acc + item.price, 0)
        setData({ ...data, items: newItems, total: newTotal })
    }



    const handleConfirm = async () => {
        if (!data) return
        setIsConfirming(true)
        try {
            const result = await confirmProposalAction(id, data.total, data.items)
            if (result.success) {
                router.push(`/proposal/${id}/success`)
            } else {
                alert('Erro ao confirmar: ' + result.error)
            }
        } catch (error) {
            console.error(error)
            alert('Erro ao confirmar proposta')
        } finally {
            setIsConfirming(false)
        }
    }

    const [aiInstruction, setAiInstruction] = useState('')

    const handleReprocess = async () => {
        if (!aiInstruction.trim()) return
        setIsReprocessing(true)

        try {
            // Need to pass current context in a format AI expects (frontend format is fine as it converts to JSON)
            const result = await processProposalWithAIAction(id, aiInstruction, data)

            if (!result.success || !result.data) {
                throw new Error(result.error || 'Falha ao reprocessar')
            }

            const newData = result.data

            // Merge or replace data
            setData(prev => ({
                ...prev!,
                items: newData.items.map((item: any, idx: number) => ({ ...item, id: idx.toString() })),
                mockup: newData.ascii_mockup,
                logic: newData.pricing_logic,
                total: newData.total
            }))

            setAiInstruction('')
        } catch (error) {
            console.error(error)
            alert('Falha ao reprocessar com IA')
        } finally {
            setIsReprocessing(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
            </div>
        )
    }

    if (!data) return <div className="p-8 text-center">Nenhum dado encontrado para esta proposta.</div>

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-lg font-bold text-[var(--color-secondary)]">Revisión de Propuesta</h1>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                            {isEditing ? 'Cancelar Edición' : 'Editar Manualmente'}
                        </Button>
                        <Button onClick={handleConfirm} disabled={isConfirming}>
                            {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar y Generar
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 space-y-6 mt-6">

                {/* 1. Client Info */}
                <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Datos del Cliente</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Nombre</Label>
                            {isEditing ? (
                                <Input value={data.clientName} onChange={(e) => setData({ ...data, clientName: e.target.value })} />
                            ) : (
                                <p className="font-medium text-lg">{data.clientName}</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label>Ciudad</Label>
                            {isEditing ? (
                                <Input value={data.city} onChange={(e) => setData({ ...data, city: e.target.value })} />
                            ) : (
                                <p className="font-medium text-lg">{data.city}</p>
                            )}
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Items & Table */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* 2. Items List */}
                        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Items Calculados</h2>
                                {isEditing && (
                                    <Button size="sm" variant="outline" onClick={handleAddItem}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Agregar Item
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {data.items.map((item) => (
                                    <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            {isEditing ? (
                                                <Input className="font-medium max-w-[200px]" value={item.name} onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)} />
                                            ) : (
                                                <span className="font-bold text-[var(--color-secondary)]">{item.name}</span>
                                            )}

                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-sm font-bold">€</span>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="font-bold w-24"
                                                        value={item.price}
                                                        onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-bold text-lg">€ {item.price.toFixed(2)}</span>
                                            )}

                                            {isEditing && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-500 block text-xs">Ancho (m)</span>
                                                {isEditing ? (
                                                    <Input type="number" step="0.01" value={item.width} onChange={(e) => handleUpdateItem(item.id, 'width', Number(e.target.value))} />
                                                ) : item.width.toFixed(2)}
                                            </div>
                                            <div>
                                                <span className="text-gray-500 block text-xs">Alto (m)</span>
                                                {isEditing ? (
                                                    <Input type="number" step="0.01" value={item.height} onChange={(e) => handleUpdateItem(item.id, 'height', Number(e.target.value))} />
                                                ) : item.height.toFixed(2)}
                                            </div>
                                            <div>
                                                <span className="text-gray-500 block text-xs">Area (m²)</span>
                                                <span className="font-mono">{item.area.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {(item.price_rule === 'Minimo' || item.price === 80) && (
                                            <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded inline-block w-fit">
                                                * Aplicado valor mínimo (80€)
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="mt-6 pt-6 border-t flex justify-between items-center">
                                <span className="text-xl font-bold text-[var(--color-secondary)]">TOTAL GENERAL</span>
                                <span className="text-3xl font-bold text-[var(--color-primary)]">€ {data.total.toFixed(2)}</span>
                            </div>
                        </section>

                        {/* AI Actions */}
                        <section className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-100">
                            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                <RefreshCw className={`h-4 w-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                                Ajustes con IA
                            </h3>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ej: Agrega un hueco para gato en la ventana del salón..."
                                    className="bg-white"
                                    value={aiInstruction}
                                    onChange={(e) => setAiInstruction(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleReprocess()}
                                />
                                <Button onClick={handleReprocess} disabled={isReprocessing || !aiInstruction.trim()}>
                                    Reprocesar
                                </Button>
                            </div>
                        </section>
                    </div>

                    {/* Right: Mockup & Logic */}
                    <div className="space-y-6">
                        {/* 3. Mockup ASCII */}
                        <section className="bg-gray-900 text-green-400 rounded-lg p-6 shadow-sm border font-mono text-xs overflow-x-auto">
                            <h2 className="text-gray-500 uppercase tracking-wider mb-2 text-[10px]">Mockup Visual</h2>
                            <pre>{data.mockup}</pre>
                            {isEditing && (
                                <p className="text-xs text-gray-500 mt-2 max-w-[200px]">* Mockup editable solo via reprocesamiento IA por ahora.</p>
                            )}
                        </section>

                        {/* 4. Logic Explanation */}
                        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Lógica de Cálculo</h2>
                            <pre className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                                {data.logic}
                            </pre>
                        </section>
                    </div>
                </div>

            </main>
        </div>
    )
}

