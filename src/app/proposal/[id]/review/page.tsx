'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, RefreshCw, Save, Send, Loader2, Trash2, Plus, Download } from 'lucide-react'
import { getProposalDetailsAction, processProposalWithAIAction, confirmProposalAction, closeSaleAction } from '@/actions/proposal'
import { ProposalItem as DBProposalItem } from '@/lib/types'
import { PRICING } from '@/lib/constants'
import { generateProposalPDF } from '@/lib/pdf'

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
    whatsapp: string
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
                total: Number(proposal.total_geral || processing?.total_calculado || 0),
                whatsapp: proposal.whatsapp || ''
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
                    const calculated = updated.area * PRICING.PRICE_PER_M2
                    updated.price = Math.max(PRICING.MIN_PRICE_PER_ITEM, calculated)
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
            price: PRICING.MIN_PRICE_PER_ITEM,
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
                // For "Save changes", we just stay on page or show a toast
                alert('Alterações salvas com sucesso!')
            } else {
                alert('Erro ao salvar: ' + result.error)
            }
        } catch (error) {
            console.error(error)
            alert('Erro ao salvar orçamento')
        } finally {
            setIsConfirming(false)
        }
    }

    const [aiInstruction, setAiInstruction] = useState('')

    const handleReprocess = async () => {
        if (!aiInstruction.trim()) return
        setIsReprocessing(true)

        try {
            // Need to pass current context in a format AI expects
            const result = await processProposalWithAIAction(id, aiInstruction, data)

            if (!result.success || !result.data) {
                throw new Error(result.error || 'Falha ao reprojetar')
            }

            const newData = result.data

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
            alert('Falha ao reprojetar com IA')
        } finally {
            setIsReprocessing(false)
        }
    }

    const handleCloseSale = async () => {
        if (!confirm('¿Deseas cerrar esta venta y generar el agendamento?')) return
        setIsConfirming(true)
        try {
            const result = await closeSaleAction(id)
            if (result.success) {
                router.push('/dashboard/citas')
            } else {
                alert('Error al cerrar venta: ' + result.error)
            }
        } catch (error) {
            console.error(error)
            alert('Error al cerrar venta')
        } finally {
            setIsConfirming(false)
        }
    }

    const handleDownloadPDF = () => {
        if (!data) return
        generateProposalPDF(data)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
            </div>
        )
    }

    if (!data) return <div className="p-8 text-center">No se han encontrado datos para este presupuesto.</div>

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b sticky top-0 z-10 transition-all duration-300">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold text-[var(--color-secondary)] leading-tight">Revisión Final</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Funil de Vendas</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="hidden md:flex">
                            {isEditing ? 'Cancelar Edición' : 'Editar Manualmente'}
                        </Button>
                        <Button
                            onClick={handleDownloadPDF}
                            className="bg-gray-100 hover:bg-gray-200 text-navy font-bold px-4"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Gerar PDF
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            className="bg-navy hover:bg-navy/90 text-white font-bold px-6"
                        >
                            {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                        <Button
                            onClick={handleCloseSale}
                            disabled={isConfirming}
                            className="bg-accent hover:shadow-accent/20 hover:shadow-lg text-navy font-extrabold px-6"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Fechar Venda
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-4 lg:p-8 space-y-8 mt-4">

                {/* Visual Sales Funnel Indicator (Simple) */}
                <div className="flex items-center justify-center gap-2 mb-8 uppercase text-[10px] font-black tracking-tighter text-gray-400">
                    <span className="text-navy">1. Pedido</span>
                    <div className="h-[2px] w-8 bg-gray-200" />
                    <span className="text-navy">2. Interpretação</span>
                    <div className="h-[2px] w-8 bg-gray-200" />
                    <span className="text-accent bg-accent/10 px-2 py-1 rounded">3. Revisão e Ajuste</span>
                    <div className="h-[2px] w-8 bg-gray-200" />
                    <span>4. Agendamento</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left: Logic & Mockup (Visual Assets) */}
                    <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
                        {/* 3. Mockup ASCII - NOW EDITABLE */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border-none overflow-hidden relative group">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xs font-black uppercase tracking-widest text-navy bg-accent/20 px-3 py-1 rounded-full">Projetista ASCII</h2>
                            </div>

                            <textarea
                                value={data.mockup}
                                onChange={(e) => setData(prev => prev ? ({ ...prev, mockup: e.target.value }) : null)}
                                className="w-full h-80 bg-navy text-accent p-6 rounded-xl font-mono text-[10px] leading-tight resize-none border-none focus:ring-2 focus:ring-accent/50 selection:bg-accent/30"
                                placeholder="Gere ou desenhe o mockup aqui..."
                                spellCheck={false}
                            />

                            <p className="text-[9px] text-gray-400 mt-3 italic text-center">
                                * Você pode editar o desenho 3D manualmente acima.
                            </p>
                        </section>

                        {/* 4. Logic Explanation */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Memória de Cálculo</h2>
                            <pre className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans bg-gray-50 p-4 rounded-xl">
                                {data.logic}
                            </pre>
                        </section>
                    </div>

                    {/* Right: Items, Client & Actions */}
                    <div className="lg:col-span-8 space-y-8 order-1 lg:order-2">

                        {/* Summary Card */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <span className="text-[10px] font-black uppercase text-gray-400">Cliente</span>
                                <p className="text-lg font-bold text-navy truncate">{data.clientName}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <span className="text-[10px] font-black uppercase text-gray-400">WhatsApp</span>
                                <p className="text-lg font-bold text-navy">{data.whatsapp || '---'}</p>
                            </div>
                            <div className="bg-navy p-6 rounded-2xl shadow-xl text-white flex flex-col justify-center">
                                <span className="text-[10px] font-black uppercase text-white/50">Total do Orçamento</span>
                                <p className="text-3xl font-black text-accent tracking-tighter">€ {data.total.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Items Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-black text-navy tracking-tight">Detalhamento Técnico</h2>
                                <Button size="sm" variant="outline" onClick={handleAddItem} className="rounded-full border-2 border-accent text-navy hover:bg-accent font-bold">
                                    <Plus className="h-4 w-4 mr-1" /> Novo Item
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {data.items.map((item) => (
                                    <div key={item.id} className="group p-6 bg-white hover:bg-gray-50 dark:bg-gray-700/30 rounded-2xl border-2 border-gray-50 hover:border-accent/10 transition-all">
                                        <div className="flex flex-col md:flex-row justify-between gap-4">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 rounded-full bg-accent/20 text-navy font-black flex items-center justify-center text-xs">A</span>
                                                    <Input
                                                        className="font-black text-navy border-none shadow-none focus-visible:ring-1 focus-visible:ring-accent group-hover:bg-white text-lg p-0 h-auto"
                                                        value={item.name}
                                                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-3 gap-6">
                                                    <div>
                                                        <Label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Largura (m)</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="bg-gray-50 border-none rounded-lg font-bold"
                                                            value={item.width}
                                                            onChange={(e) => handleUpdateItem(item.id, 'width', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Altura (m)</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="bg-gray-50 border-none rounded-lg font-bold"
                                                            value={item.height}
                                                            onChange={(e) => handleUpdateItem(item.id, 'height', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col justify-end">
                                                        <span className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Área M²</span>
                                                        <span className="font-black text-navy text-lg">{item.area.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end justify-between border-l border-gray-100 pl-6 min-w-[150px]">
                                                <div className="text-right">
                                                    <span className="text-[9px] font-black uppercase text-gray-400 block mb-1">Preço Item</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-black text-navy text-2xl tracking-tighter">€</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="font-black text-navy text-2xl tracking-tighter border-none p-0 h-auto w-24 text-right shadow-none focus-visible:ring-0"
                                                            value={item.price}
                                                            onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))}
                                                        />
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-10 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {(item.price_rule === 'Minimo' || item.price === PRICING.MIN_PRICE_PER_ITEM) && (
                                            <div className="mt-4 text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-3 py-1 rounded-full inline-block">
                                                * Aplicado taxa mínima de serviço (80,00€)
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* AI Intelligence Adjustments */}
                        <section className="bg-accent/10 dark:bg-accent/5 rounded-2xl p-8 border-2 border-accent/20">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                                    <RefreshCw className={`h-5 w-5 text-navy ${isReprocessing ? 'animate-spin' : ''}`} />
                                </div>
                                <div>
                                    <h3 className="font-black text-navy uppercase tracking-tight">Refinar Cérebro IA</h3>
                                    <p className="text-[10px] text-navy/50 font-bold">A IA ajusta as medidas e o desenho 3D automaticamente.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Input
                                    placeholder="Ex: 'Remova o teto e adicione uma lateral na cozinha'..."
                                    className="bg-white border-2 border-transparent focus:border-accent rounded-xl h-14 font-medium px-6 text-navy"
                                    value={aiInstruction}
                                    onChange={(e) => setAiInstruction(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleReprocess()}
                                />
                                <Button
                                    onClick={handleReprocess}
                                    disabled={isReprocessing || !aiInstruction.trim()}
                                    className="h-14 px-8 bg-navy text-white font-black rounded-xl hover:shadow-lg"
                                >
                                    Re-Projetar
                                </Button>
                            </div>
                        </section>
                    </div>
                </div>

            </main>
        </div>
    )
}

