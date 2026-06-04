'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { parseProposalTextAction, createFullProposalAction, closeSaleAction } from '@/actions/proposal'
import { generateProposalBlob } from '@/services/pdfGenerator'
import { sendDocumentMessage } from '@/lib/evolution'
import { PRICING } from '@/lib/constants'
import { useProfile } from '@/hooks/useProfile'
import { COMPANIES } from '@/lib/companies'
import {
    ArrowLeft, Sparkles, PenLine, Plus, Trash2, Loader2,
    Download, MessageCircle, Home, Send, X, Camera,
    AlertCircle, CheckCircle, Calendar, RotateCcw
} from 'lucide-react'

type Step = 'input' | 'preview' | 'done'
type Mode = 'ai' | 'manual'

type Item = {
    id: string
    name: string
    width: number
    height: number
    area: number
    price: number
}

function calcItem(name: string, width: number, height: number): Item {
    const area = width * height
    const price = Math.max(area * PRICING.PRICE_PER_M2, area > 0 ? PRICING.MIN_PRICE_PER_ITEM : 0)
    return { id: `item_${Date.now()}_${Math.random()}`, name, width, height, area, price }
}

function NovaPropostaInner() {
    const router = useRouter()
    const params = useSearchParams()
    const { profile } = useProfile()

    const [step, setStep] = useState<Step>('input')
    const [mode, setMode] = useState<Mode>('ai')

    // Client info
    const [clientName, setClientName] = useState(params.get('name') ?? '')
    const [clientPhone, setClientPhone] = useState(params.get('phone') ?? params.get('whatsapp') ?? '')
    const [clientLocation, setClientLocation] = useState(params.get('location') ?? '')

    // AI mode
    const [requestText, setRequestText] = useState(params.get('message') ?? '')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [missingInfo, setMissingInfo] = useState('')
    const [clarification, setClarification] = useState('')

    // Items (preview step)
    const [items, setItems] = useState<Item[]>([])
    const [mockup, setMockup] = useState('')

    // Manual mode add
    const [newName, setNewName] = useState('')
    const [newW, setNewW] = useState('')
    const [newH, setNewH] = useState('')

    // Loading / error
    const [parsing, setParsing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Done step
    const [proposalId, setProposalId] = useState('')
    const [generatingPDF, setGeneratingPDF] = useState(false)
    const [sendingWA, setSendingWA] = useState(false)
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [installDate, setInstallDate] = useState('')
    const [installAddress, setInstallAddress] = useState('')
    const [closing, setClosing] = useState(false)

    const city = profile ? (COMPANIES[profile.company_id]?.name ?? 'Preventiva Centro') : 'Preventiva Centro'
    const total = items.reduce((s, i) => s + i.price, 0)

    // Image select
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        setImageFile(f)
        setImagePreview(URL.createObjectURL(f))
    }

    // Upload image and return URL
    const uploadImage = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop()
        const path = `temp/${Date.now()}.${ext}`
        const form = new FormData()
        form.append('file', file)
        form.append('path', path)
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (!json.url) throw new Error('Falha no upload de imagem')
        return json.url
    }

    // ── AI PARSE ────────────────────────────────────────────────────────────
    const handleAnalyse = async () => {
        if (!requestText.trim() && !imageFile) {
            setError('Insere o pedido do cliente ou uma imagem.')
            return
        }
        setError('')
        setParsing(true)
        try {
            let imgUrl = imageUrl
            if (imageFile && !imgUrl) {
                imgUrl = await uploadImage(imageFile)
                setImageUrl(imgUrl)
            }

            const fullText = clarification
                ? `${requestText}\n\nACLARACIÓN: ${clarification}`
                : requestText

            const res = await parseProposalTextAction(fullText || '', imgUrl || undefined)
            if (!res.success || !res.data) throw new Error(res.error ?? 'Erro na IA')

            const aiItems: Item[] = (res.data.items || []).map((it: any) =>
                calcItem(it.name, Number(it.width) || 0, Number(it.height) || 0)
            )
            setItems(aiItems)
            setMockup(res.data.ascii_mockup ?? '')
            setMissingInfo(res.data.missing_info ?? '')
            setClarification('')
            setStep('preview')
        } catch (e: any) {
            setError(e.message || 'Erro ao analisar')
        }
        setParsing(false)
    }

    // ── MANUAL ITEMS ────────────────────────────────────────────────────────
    const addManualItem = () => {
        if (!newName.trim()) return
        setItems(prev => [...prev, calcItem(newName, parseFloat(newW) || 0, parseFloat(newH) || 0)])
        setNewName(''); setNewW(''); setNewH('')
    }

    const toPreviewManual = () => {
        if (items.length === 0) { setError('Adiciona pelo menos um item.'); return }
        setError('')
        setStep('preview')
    }

    // ── ITEM EDIT ───────────────────────────────────────────────────────────
    const updateItem = (id: string, field: 'name' | 'width' | 'height' | 'price', val: string) => {
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it
            const updated = { ...it, [field]: field === 'name' ? val : Number(val) }
            if (field === 'width' || field === 'height') {
                updated.area = updated.width * updated.height
                updated.price = Math.max(updated.area * PRICING.PRICE_PER_M2, updated.area > 0 ? PRICING.MIN_PRICE_PER_ITEM : 0)
            }
            return updated
        }))
    }

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

    // ── SAVE ────────────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (items.length === 0) { setError('A proposta não tem itens.'); return }
        if (!clientName.trim()) { setError('Nome do cliente obrigatório.'); return }
        setSaving(true); setError('')
        const res = await createFullProposalAction({
            clientName, whatsapp: clientPhone, city,
            requestText, imageUrl,
            items, mockup, total,
        })
        if (!res.success || !res.id) {
            setError(res.error ?? 'Erro ao guardar proposta')
            setSaving(false); return
        }
        setProposalId(res.id)
        setStep('done')
        setSaving(false)
    }

    // ── PDF ─────────────────────────────────────────────────────────────────
    const proposalDataForPDF = () => ({
        clientName, city, whatsapp: clientPhone,
        items: items.map(i => ({ name: i.name, width: i.width, height: i.height, area: i.area, price: i.price })),
        total, mockup,
    })

    const handleDownloadPDF = async () => {
        setGeneratingPDF(true); setError('')
        try {
            const blob = await generateProposalBlob(proposalDataForPDF())
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Preventiva_${clientName.replace(/\s+/g, '_')}.pdf`
            a.click()
            URL.revokeObjectURL(url)
        } catch (e: any) { setError(e.message || 'Erro ao gerar PDF') }
        setGeneratingPDF(false)
    }

    const handleWhatsApp = async () => {
        if (!clientPhone.trim()) { setError('Número de WhatsApp não definido.'); return }
        setSendingWA(true); setError('')
        try {
            const blob = await generateProposalBlob(proposalDataForPDF())
            const safeName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            const caption = 'Te paso el presupuesto. Mira si está todo bien y si necesitas cualquier cambio me dices. ¡Atención que con el calor tenemos cada día menos fechas disponibles!'
            if (process.env.NEXT_PUBLIC_EVOLUTION_API_URL) {
                await sendDocumentMessage(clientPhone, blob, `Preventiva_${safeName}.pdf`, caption)
            } else {
                const digits = clientPhone.replace(/\D/g, '')
                window.open(`https://wa.me/${digits}?text=${encodeURIComponent(caption)}`, '_blank')
            }
        } catch (e: any) { setError(e.message || 'Erro ao enviar WhatsApp') }
        setSendingWA(false)
    }

    const handleCloseSale = async () => {
        if (!installDate) { setError('Selecciona la fecha de instalación.'); return }
        setClosing(true); setError('')
        const res = await closeSaleAction(proposalId, { address: installAddress, scheduledAt: installDate })
        if (!res.success) { setError(res.error ?? 'Erro ao fechar venda'); setClosing(false); return }
        setShowCloseModal(false)
        router.push('/dashboard/citas')
    }

    // ────────────────────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">

                {/* ── STEP 1: INPUT ─────────────────────────────────────── */}
                {step === 'input' && (
                    <>
                        <header className="mb-8 flex items-center gap-4">
                            <button onClick={() => router.back()}
                                className="p-2 rounded-xl border border-border hover:bg-gray-50 text-navy transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-navy">Nova <span className="accent-text">Proposta</span></h1>
                                <p className="text-text-muted text-sm mt-1">Passo 1 de 2 — Dados do cliente e pedido</p>
                            </div>
                        </header>

                        {error && (
                            <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                <AlertCircle size={16} className="shrink-0" /><span>{error}</span>
                                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Client info */}
                            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
                                <h2 className="font-black text-navy uppercase tracking-widest text-xs flex items-center gap-2">
                                    <PenLine size={14} className="text-accent" /> Dados do Cliente
                                </h2>
                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Nome *</label>
                                    <input value={clientName} onChange={e => setClientName(e.target.value)}
                                        placeholder="Nome completo"
                                        className="w-full p-3 border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-accent/50 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">WhatsApp</label>
                                    <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                                        placeholder="34600000000"
                                        className="w-full p-3 border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-accent/50 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Localização</label>
                                    <input value={clientLocation} onChange={e => setClientLocation(e.target.value)}
                                        placeholder="Madrid, Barcelona…"
                                        className="w-full p-3 border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-accent/50 outline-none" />
                                </div>
                            </div>

                            {/* Request */}
                            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-black text-navy uppercase tracking-widest text-xs flex items-center gap-2">
                                        <Sparkles size={14} className="text-accent" /> Pedido
                                    </h2>
                                    <div className="flex bg-gray-100 rounded-lg overflow-hidden text-xs font-bold">
                                        <button onClick={() => setMode('ai')}
                                            className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${mode === 'ai' ? 'bg-navy text-white' : 'text-text-muted hover:bg-gray-200'}`}>
                                            <Sparkles size={11} /> IA
                                        </button>
                                        <button onClick={() => setMode('manual')}
                                            className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${mode === 'manual' ? 'bg-navy text-white' : 'text-text-muted hover:bg-gray-200'}`}>
                                            <PenLine size={11} /> Manual
                                        </button>
                                    </div>
                                </div>

                                {mode === 'ai' && (
                                    <>
                                        <textarea value={requestText} onChange={e => setRequestText(e.target.value)}
                                            rows={5} placeholder="Ex: tenho um balcão de 3.50m de frente e 1.20m de profundidade, com 2.10m de altura…"
                                            className="w-full p-3 border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-accent/50 outline-none resize-none" />

                                        {/* Image upload */}
                                        <div
                                            onClick={() => document.getElementById('img-input')?.click()}
                                            className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
                                            {imagePreview ? (
                                                <div className="relative inline-block">
                                                    <img src={imagePreview} alt="preview" className="max-h-24 rounded-lg mx-auto" />
                                                    <button onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(''); setImageUrl('') }}
                                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 text-text-muted">
                                                    <Camera size={20} />
                                                    <span className="text-xs">Adicionar imagem (opcional)</span>
                                                </div>
                                            )}
                                            <input id="img-input" type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                                        </div>

                                        {missingInfo && (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                                <p className="font-bold mb-1">A IA precisa de esclarecimento:</p>
                                                <p className="mb-2">{missingInfo}</p>
                                                <textarea value={clarification} onChange={e => setClarification(e.target.value)}
                                                    rows={2} placeholder="Responde aqui…"
                                                    className="w-full p-2 border border-amber-200 rounded-lg text-navy text-sm outline-none focus:ring-1 focus:ring-amber-400 resize-none" />
                                            </div>
                                        )}

                                        <button onClick={handleAnalyse} disabled={parsing}
                                            className="w-full py-3.5 bg-navy text-white font-black rounded-xl hover:bg-navy/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                            {parsing ? <><Loader2 size={16} className="animate-spin" /> A analisar…</> : <><Sparkles size={16} /> Analisar com IA</>}
                                        </button>
                                    </>
                                )}

                                {mode === 'manual' && (
                                    <>
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <input value={newName} onChange={e => setNewName(e.target.value)}
                                                    placeholder="Nome do espaço (ex: Frente Varanda)"
                                                    className="flex-1 p-3 border border-border rounded-xl text-navy text-sm outline-none focus:ring-2 focus:ring-accent/50" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Largo (m)</label>
                                                    <input type="number" step="0.01" value={newW} onChange={e => setNewW(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full p-3 border border-border rounded-xl text-navy text-sm outline-none focus:ring-2 focus:ring-accent/50" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Alto (m)</label>
                                                    <input type="number" step="0.01" value={newH} onChange={e => setNewH(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full p-3 border border-border rounded-xl text-navy text-sm outline-none focus:ring-2 focus:ring-accent/50" />
                                                </div>
                                            </div>
                                            <button onClick={addManualItem}
                                                className="w-full py-2.5 border-2 border-dashed border-accent/40 text-accent font-bold rounded-xl hover:bg-accent/5 flex items-center justify-center gap-2 text-sm transition-colors">
                                                <Plus size={16} /> Adicionar item
                                            </button>
                                        </div>

                                        {items.length > 0 && (
                                            <div className="space-y-2">
                                                {items.map((it, i) => (
                                                    <div key={it.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                                                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-black flex items-center justify-center shrink-0">{i + 1}</span>
                                                        <span className="flex-1 font-semibold text-navy truncate">{it.name}</span>
                                                        <span className="text-text-muted">{it.width}×{it.height}m</span>
                                                        <span className="font-bold text-navy">€{it.price.toFixed(0)}</span>
                                                        <button onClick={() => removeItem(it.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                                                    </div>
                                                ))}
                                                <div className="text-right text-xs font-black text-navy pt-1">Total: €{total.toFixed(2)}</div>
                                            </div>
                                        )}

                                        <button onClick={toPreviewManual} disabled={items.length === 0}
                                            className="w-full py-3.5 bg-navy text-white font-black rounded-xl hover:bg-navy/90 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                                            <PenLine size={16} /> Ver pré-visualização
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ── STEP 2: PREVIEW ───────────────────────────────────── */}
                {step === 'preview' && (
                    <>
                        <header className="mb-8 flex items-center gap-4">
                            <button onClick={() => { setStep('input'); setError('') }}
                                className="p-2 rounded-xl border border-border hover:bg-gray-50 text-navy transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-navy">Pré-<span className="accent-text">Visualização</span></h1>
                                <p className="text-text-muted text-sm mt-1">Passo 2 de 2 — Revisa e confirma antes de criar a proposta</p>
                            </div>
                        </header>

                        {error && (
                            <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                <AlertCircle size={16} className="shrink-0" /><span>{error}</span>
                                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
                            </div>
                        )}

                        {/* Client summary */}
                        <div className="mb-4 flex items-center gap-4 p-4 bg-white border border-border rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-black flex items-center justify-center shrink-0">
                                {clientName.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-navy">{clientName}</p>
                                <p className="text-xs text-text-muted">{clientPhone} {clientLocation && `· ${clientLocation}`}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-2xl font-black text-navy">€ {total.toFixed(2)}</p>
                                <p className="text-[10px] text-text-muted uppercase font-bold">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Mockup */}
                            {mockup && (
                                <div className="bg-navy rounded-2xl p-6">
                                    <p className="text-accent text-[10px] font-black uppercase tracking-widest mb-3">Plano de instalação</p>
                                    <pre className="text-accent font-mono text-[10px] leading-tight whitespace-pre-wrap">{mockup}</pre>
                                </div>
                            )}

                            {/* Items editor */}
                            <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Itens da proposta</p>
                                {items.map((it, i) => (
                                    <div key={it.id} className="p-3 bg-gray-50 rounded-xl border border-border/40">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-black text-[10px] flex items-center justify-center shrink-0">{i+1}</span>
                                            <input value={it.name} onChange={e => updateItem(it.id, 'name', e.target.value)}
                                                className="flex-1 bg-transparent font-bold text-navy text-sm outline-none border-b border-transparent focus:border-accent/50" />
                                            <button onClick={() => removeItem(it.id)} className="text-red-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <label className="block text-[9px] text-text-muted uppercase mb-0.5">Largo (m)</label>
                                                <input type="number" step="0.01" value={it.width}
                                                    onChange={e => updateItem(it.id, 'width', e.target.value)}
                                                    className="w-full p-1.5 bg-white border border-border rounded-lg text-navy font-bold outline-none focus:ring-1 focus:ring-accent/50" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] text-text-muted uppercase mb-0.5">Alto (m)</label>
                                                <input type="number" step="0.01" value={it.height}
                                                    onChange={e => updateItem(it.id, 'height', e.target.value)}
                                                    className="w-full p-1.5 bg-white border border-border rounded-lg text-navy font-bold outline-none focus:ring-1 focus:ring-accent/50" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] text-text-muted uppercase mb-0.5">Preço (€)</label>
                                                <input type="number" step="0.01" value={it.price}
                                                    onChange={e => updateItem(it.id, 'price', e.target.value)}
                                                    className="w-full p-1.5 bg-white border border-border rounded-lg text-navy font-bold outline-none focus:ring-1 focus:ring-accent/50" />
                                            </div>
                                        </div>
                                        {it.area > 0 && (
                                            <p className="text-[9px] text-text-muted mt-1.5">{it.area.toFixed(2)} m² · €{PRICING.PRICE_PER_M2}/m²{it.price === PRICING.MIN_PRICE_PER_ITEM ? ' (mínimo)' : ''}</p>
                                        )}
                                    </div>
                                ))}

                                {/* Add item */}
                                <button onClick={() => setItems(prev => [...prev, calcItem('Novo item', 0, 0)])}
                                    className="w-full py-2 border-2 border-dashed border-accent/30 text-accent/70 font-bold rounded-xl hover:bg-accent/5 flex items-center justify-center gap-1.5 text-xs transition-colors">
                                    <Plus size={13} /> Adicionar item
                                </button>
                            </div>
                        </div>

                        {/* AI refine (only in AI mode) */}
                        {mode === 'ai' && (
                            <div className="mb-6 bg-accent/5 border border-accent/20 rounded-2xl p-5">
                                <p className="text-xs font-black text-navy uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <RotateCcw size={13} /> Refinar com IA
                                </p>
                                <div className="flex gap-3">
                                    <input value={clarification} onChange={e => setClarification(e.target.value)}
                                        placeholder="Ex: retirar o tecto, adicionar lateral esquerdo de 1.20m…"
                                        className="flex-1 p-3 bg-white border border-border rounded-xl text-navy text-sm outline-none focus:ring-2 focus:ring-accent/50"
                                        onKeyDown={e => e.key === 'Enter' && !parsing && handleAnalyse()} />
                                    <button onClick={handleAnalyse} disabled={parsing || !clarification.trim()}
                                        className="px-5 py-3 bg-navy text-white font-black rounded-xl hover:bg-navy/90 transition-all disabled:opacity-40 text-sm">
                                        {parsing ? <Loader2 size={14} className="animate-spin" /> : 'Reajustar'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button onClick={handleCreate} disabled={saving || items.length === 0}
                            className="w-full py-4 bg-accent text-navy font-black rounded-2xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-40">
                            {saving ? <><Loader2 size={20} className="animate-spin" /> A criar proposta…</> : <>Criar Proposta →</>}
                        </button>
                    </>
                )}

                {/* ── STEP 3: DONE ──────────────────────────────────────── */}
                {step === 'done' && (
                    <>
                        <header className="mb-8 text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} className="text-green-500" />
                            </div>
                            <h1 className="text-3xl font-bold text-navy mb-1">Proposta <span className="accent-text">Criada!</span></h1>
                            <p className="text-text-muted">{clientName} · € {total.toFixed(2)} · {items.length} item{items.length !== 1 ? 's' : ''}</p>
                        </header>

                        {error && (
                            <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                <AlertCircle size={16} className="shrink-0" /><span>{error}</span>
                                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
                            </div>
                        )}

                        {/* Summary box */}
                        <div className="bg-white border border-border rounded-2xl p-6 mb-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-4">
                                {items.map((it, i) => (
                                    <div key={it.id} className="bg-gray-50 rounded-xl p-3">
                                        <p className="text-[10px] text-text-muted uppercase font-bold mb-1 truncate">{it.name}</p>
                                        <p className="font-black text-navy">{it.width}×{it.height}m</p>
                                        <p className="text-xs text-accent font-bold">€{it.price.toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end border-t border-border pt-4">
                                <div className="text-right">
                                    <p className="text-[10px] text-text-muted uppercase font-bold">Total</p>
                                    <p className="text-3xl font-black text-navy">€ {total.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* 4 actions */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button onClick={handleDownloadPDF} disabled={generatingPDF}
                                className="py-4 bg-red-50 border border-red-200 text-red-700 font-black rounded-2xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {generatingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                {generatingPDF ? 'Gerando…' : 'Download PDF'}
                            </button>

                            <button onClick={handleWhatsApp} disabled={sendingWA}
                                className="py-4 bg-green-50 border border-green-200 text-green-700 font-black rounded-2xl hover:bg-green-600 hover:text-white hover:border-green-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {sendingWA ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                                {sendingWA ? 'Enviando…' : 'WhatsApp'}
                            </button>

                            <button onClick={() => router.push('/dashboard')}
                                className="py-4 bg-white border border-border text-navy font-black rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                                <Home size={18} /> Início
                            </button>

                            <button onClick={() => setShowCloseModal(true)}
                                className="py-4 bg-accent text-navy font-black rounded-2xl hover:shadow-xl transition-all flex items-center justify-center gap-2">
                                <Send size={18} /> Fechar Venta
                            </button>
                        </div>

                        <button onClick={() => setStep('preview')}
                            className="w-full py-3 text-text-muted font-bold text-sm hover:text-navy transition-colors flex items-center justify-center gap-2">
                            <ArrowLeft size={14} /> Voltar e editar proposta
                        </button>

                        {/* Close sale modal */}
                        {showCloseModal && (
                            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
                                <div className="bg-white rounded-[2rem] p-8 max-w-md w-full space-y-5 shadow-2xl">
                                    <div className="flex items-center justify-between">
                                        <h2 className="font-black text-navy uppercase tracking-tight">Fechar Venta</h2>
                                        <button onClick={() => setShowCloseModal(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-navy/60 mb-1.5 flex items-center gap-1">
                                            <Calendar size={10} /> Data e hora de instalação *
                                        </label>
                                        <input type="datetime-local" value={installDate} onChange={e => setInstallDate(e.target.value)}
                                            className="w-full h-12 px-4 bg-gray-50 border-none rounded-xl text-navy font-medium focus:ring-2 focus:ring-accent/50 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-navy/60 mb-1.5">Dirección de instalação</label>
                                        <input value={installAddress} onChange={e => setInstallAddress(e.target.value)}
                                            placeholder="Calle, número, ciudad…"
                                            className="w-full h-12 px-4 bg-gray-50 border-none rounded-xl text-navy font-medium focus:ring-2 focus:ring-accent/50 outline-none text-sm" />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={handleCloseSale} disabled={closing || !installDate}
                                            className="flex-1 h-12 bg-accent text-navy font-black rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                            {closing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                            {closing ? 'A fechar…' : 'Confirmar'}
                                        </button>
                                        <button onClick={() => setShowCloseModal(false)} disabled={closing}
                                            className="h-12 px-5 text-gray-500 font-bold rounded-xl hover:bg-gray-100">
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}

export default function NovaPropostaPage() {
    return (
        <Suspense>
            <NovaPropostaInner />
        </Suspense>
    )
}
