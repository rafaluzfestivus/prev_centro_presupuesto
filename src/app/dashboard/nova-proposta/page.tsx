'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
    parseProposalTextAction, createFullProposalAction,
    confirmProposalAction, closeSaleAction, updateClientStatusAction,
} from '@/actions/proposal'
import { generateProposalBlob } from '@/services/pdfGenerator'
import { sendDocumentMessage } from '@/lib/evolution'
import { PRICING } from '@/lib/constants'
import { useProfile } from '@/hooks/useProfile'
import { COMPANIES } from '@/lib/companies'
import {
    ArrowLeft, Sparkles, PenLine, Plus, Trash2, Loader2,
    Download, MessageCircle, Send, X, Camera,
    AlertCircle, CheckCircle, Calendar, RotateCcw, Save, MapPin, Copy,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────
const ITEM_NAMES = [
    'Ventana',
    'Terraza Frente',
    'Terraza Lateral',
    'Balcon Frente',
    'Balcon Lateral',
    'Hueco',
    'Poste de Soporte',
]

type Step = 'input' | 'proposta' | 'preview' | 'venda'
type Mode = 'ai' | 'manual'
type SaveState = 'idle' | 'saving' | 'saved' | 'modified'

type Item = {
    id: string
    name: string
    width: number
    height: number
    area: number
    price: number
    priceManual: boolean
}

function buildItem(name = '', w = 0, h = 0): Item {
    const area = w * h
    return {
        id: `i_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name, width: w, height: h, area,
        price: Math.max(area * PRICING.PRICE_PER_M2, area > 0 ? PRICING.MIN_PRICE_PER_ITEM : 0),
        priceManual: false,
    }
}

// ── ItemNameField — dropdown + texto livre ───────────────────────────────────
function ItemNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const isCustom = value !== '' && !ITEM_NAMES.includes(value)
    const [custom, setCustom] = useState(isCustom)

    if (custom) {
        return (
            <div className="flex gap-1.5 w-full items-center">
                <input
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Nome personalizado…"
                    autoFocus
                    className="flex-1 font-semibold text-navy text-sm border-b border-accent/50 outline-none bg-transparent py-1"
                />
                <button
                    type="button"
                    onClick={() => { setCustom(false); onChange('') }}
                    title="Voltar à lista"
                    className="text-text-muted hover:text-navy transition-colors shrink-0">
                    <RotateCcw size={12} />
                </button>
            </div>
        )
    }

    return (
        <select
            value={value}
            onChange={e => {
                if (e.target.value === '__custom__') {
                    setCustom(true)
                    onChange('')
                } else {
                    onChange(e.target.value)
                }
            }}
            className="w-full font-semibold text-navy text-sm border-b border-transparent focus:border-accent/50 outline-none bg-transparent py-1 cursor-pointer">
            <option value="">— Escolher espaço —</option>
            {ITEM_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            <option value="__custom__">✏️ Escrever…</option>
        </select>
    )
}

// ── Steps indicator ──────────────────────────────────────────────────────────
function Steps({ step }: { step: Step }) {
    const list: { id: Step; label: string }[] = [
        { id: 'input',   label: 'Dados' },
        { id: 'proposta', label: 'Proposta' },
        { id: 'preview', label: 'Revisão' },
        { id: 'venda',   label: 'Fechar Venda' },
    ]
    const idx = list.findIndex(s => s.id === step)
    return (
        <div className="flex items-center gap-2 mb-8">
            {list.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-colors ${
                        i < idx  ? 'bg-green-100 text-green-700' :
                        i === idx ? 'bg-navy text-white' :
                                    'bg-gray-100 text-gray-400'
                    }`}>
                        {i < idx ? <CheckCircle size={11} /> : <span>{i + 1}</span>}
                        {s.label}
                    </span>
                    {i < list.length - 1 && (
                        <div className={`h-px w-6 shrink-0 ${i < idx ? 'bg-green-300' : 'bg-gray-200'}`} />
                    )}
                </div>
            ))}
        </div>
    )
}

// ── Company selector ─────────────────────────────────────────────────────────
function CompanySelector({ value, onChange }: { value: number; onChange: (id: number) => void }) {
    return (
        <div className="flex gap-2">
            {([1, 2] as const).map(id => {
                const co = COMPANIES[id]
                const active = value === id
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onChange(id)}
                        className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-black transition-all ${
                            active
                                ? 'border-navy bg-navy text-white'
                                : 'border-border text-text-muted hover:border-navy/40'
                        }`}>
                        {co.name}
                        <span className="block text-[10px] font-normal opacity-70">{co.city}</span>
                    </button>
                )
            })}
        </div>
    )
}

// ── Main component ───────────────────────────────────────────────────────────
function NovaPropostaInner() {
    const router = useRouter()
    const params = useSearchParams()
    const { profile } = useProfile()

    const [step, setStep] = useState<Step>('input')
    const [mode, setMode] = useState<Mode>('ai')

    // Company selector — default from profile, fallback to Centro
    const [selectedCompanyId, setSelectedCompanyId] = useState<number>(profile?.company_id ?? 1)
    const city = COMPANIES[selectedCompanyId]?.name ?? 'Preventiva Centro'

    // Client — leadId preserved for handover update on close
    const leadId = params.get('lead_id') ?? ''
    const [clientName, setClientName]   = useState(params.get('name')  ?? '')
    const [clientPhone, setClientPhone] = useState(params.get('phone') ?? params.get('whatsapp') ?? '')
    // clientLocation from URL for address pre-fill (not shown as form field)
    const clientLocation = params.get('location') ?? ''

    // AI input
    const [requestText, setRequestText]       = useState(params.get('message') ?? '')
    const [imageFile, setImageFile]           = useState<File | null>(null)
    const [imagePreview, setImagePreview]     = useState('')
    const [imageUrl, setImageUrl]             = useState('')
    const [missingInfo, setMissingInfo]       = useState('')
    const [clarification, setClarification]   = useState('')

    // Items
    const [items, setItems]   = useState<Item[]>([])
    const [mockup, setMockup] = useState('')
    const [refineText, setRefineText] = useState('')

    // UI state
    const [parsing, setParsing] = useState(false)
    const [error, setError]     = useState('')

    // Save state (step 2)
    const [proposalId, setProposalId] = useState('')
    const [saveState, setSaveState]   = useState<SaveState>('idle')

    // Step 3 (agendar) fields
    const [installDate, setInstallDate]       = useState('')
    const [installAddress, setInstallAddress] = useState('')
    const [installNotes, setInstallNotes]     = useState('')
    const [closing, setClosing]               = useState(false)

    // PDF / WA
    const [generatingPDF, setGeneratingPDF] = useState(false)
    const [sendingWA, setSendingWA]         = useState(false)

    const total = items.reduce((s, i) => s + i.price, 0)

    // ── Image ────────────────────────────────────────────────────────────────
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        setImageFile(f)
        setImagePreview(URL.createObjectURL(f))
    }

    const uploadImage = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop()
        const form = new FormData()
        form.append('file', file)
        form.append('path', `temp/${Date.now()}.${ext}`)
        const res  = await fetch('/api/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (!json.url) throw new Error('Falha no upload de imagem')
        return json.url
    }

    // ── AI analyse → step 2 ──────────────────────────────────────────────────
    const handleAnalyse = async () => {
        if (!requestText.trim() && !imageFile) { setError('Insere o pedido ou uma imagem.'); return }
        setError(''); setParsing(true)
        try {
            let imgUrl = imageUrl
            if (imageFile && !imgUrl) { imgUrl = await uploadImage(imageFile); setImageUrl(imgUrl) }
            const text = clarification ? `${requestText}\n\nACLARACIÓN: ${clarification}` : requestText
            const res  = await parseProposalTextAction(text || '', imgUrl || undefined)
            if (!res.success || !res.data) throw new Error(res.error ?? 'Erro na IA')
            setItems((res.data.items || []).map((it: any) =>
                buildItem(it.name, Number(it.width) || 0, Number(it.height) || 0)
            ))
            setMockup(res.data.ascii_mockup ?? '')
            setMissingInfo(res.data.missing_info ?? '')
            setClarification('')
            setProposalId(''); setSaveState('idle')
            setStep('proposta')
        } catch (e: any) { setError(e.message || 'Erro ao analisar') }
        setParsing(false)
    }

    // ── AI refine (step 2) ───────────────────────────────────────────────────
    const handleRefine = async () => {
        if (!refineText.trim()) return
        setParsing(true); setError('')
        try {
            const text = `${requestText}\n\nAJUSTE: ${refineText}`
            const res  = await parseProposalTextAction(text, imageUrl || undefined)
            if (!res.success || !res.data) throw new Error(res.error ?? 'Erro')
            setItems((res.data.items || []).map((it: any) =>
                buildItem(it.name, Number(it.width) || 0, Number(it.height) || 0)
            ))
            setMockup(res.data.ascii_mockup ?? '')
            setRefineText('')
            setSaveState(prev => prev === 'saved' ? 'modified' : prev)
        } catch (e: any) { setError(e.message || 'Erro ao reajustar') }
        setParsing(false)
    }

    // ── Item helpers ─────────────────────────────────────────────────────────
    const markDirty = () => setSaveState(prev => prev === 'saved' ? 'modified' : prev)

    const updateItem = (id: string, field: 'name' | 'width' | 'height' | 'price', val: string) => {
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it
            if (field === 'name')  return { ...it, name: val }
            if (field === 'price') return { ...it, price: Number(val) || 0, priceManual: true }
            const n = Number(val) || 0
            const updated = { ...it, [field]: n }
            updated.area = updated.width * updated.height
            if (!updated.priceManual) {
                updated.price = Math.max(
                    updated.area * PRICING.PRICE_PER_M2,
                    updated.area > 0 ? PRICING.MIN_PRICE_PER_ITEM : 0
                )
            }
            return updated
        }))
        markDirty()
    }

    const removeItem    = (id: string) => { setItems(p => p.filter(i => i.id !== id)); markDirty() }
    const addItem       = ()           => { setItems(p => [...p, buildItem()]); markDirty() }
    const duplicateItem = (id: string) => {
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === id)
            if (idx === -1) return prev
            const src = prev[idx]
            const copy: Item = {
                ...src,
                id: `i_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            }
            return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
        })
        markDirty()
    }

    // ── Core save ────────────────────────────────────────────────────────────
    const saveProposal = async (): Promise<{ success: boolean; id?: string; error?: string }> => {
        if (items.length === 0) return { success: false, error: 'A proposta não tem itens.' }
        if (!clientName.trim()) return { success: false, error: 'Nome do cliente obrigatório.' }
        setSaveState('saving')
        try {
            if (!proposalId) {
                const res = await createFullProposalAction({
                    clientName, whatsapp: clientPhone, city,
                    companyId: selectedCompanyId,
                    requestText, imageUrl, items, mockup, total,
                })
                if (!res.success || !res.id) throw new Error(res.error ?? 'Erro ao criar')
                setProposalId(res.id)
                setSaveState('saved')
                return { success: true, id: res.id }
            } else {
                const res = await confirmProposalAction(proposalId, total, items)
                if (!res.success) throw new Error(res.error ?? 'Erro ao atualizar')
                setSaveState('saved')
                return { success: true, id: proposalId }
            }
        } catch (e: any) {
            setSaveState(proposalId ? 'modified' : 'idle')
            return { success: false, error: e.message || 'Erro ao guardar' }
        }
    }

    const handleSave = async () => {
        const r = await saveProposal()
        if (!r.success) setError(r.error ?? 'Erro ao guardar')
    }

    // Continuar → guarda se preciso, depois vai para preview
    const handleContinueToPreview = async () => {
        if (items.length === 0) { setError('A proposta não tem itens.'); return }
        if (!clientName.trim()) { setError('Nome do cliente obrigatório.'); return }
        if (saveState !== 'saved') {
            const r = await saveProposal()
            if (!r.success) { setError(r.error ?? 'Erro ao guardar'); return }
        }
        setStep('preview')
    }

    // ── PDF / WA ─────────────────────────────────────────────────────────────
    const pdfData = () => ({
        clientName, city, whatsapp: clientPhone,
        items: items.map(i => ({ name: i.name, width: i.width, height: i.height, area: i.area, price: i.price })),
        total, mockup,
    })

    const handleDownloadPDF = async () => {
        setGeneratingPDF(true)
        try {
            const blob = await generateProposalBlob(pdfData())
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `Preventiva_${clientName.replace(/\s+/g, '_')}.pdf`
            a.click()
        } catch (e: any) { setError(e.message || 'Erro ao gerar PDF') }
        setGeneratingPDF(false)
    }

    const handleWhatsApp = async () => {
        if (!clientPhone.trim()) { setError('WhatsApp não definido.'); return }
        setSendingWA(true)
        try {
            const blob    = await generateProposalBlob(pdfData())
            const caption = 'Te paso el presupuesto. Mira si está todo bien y si necesitas cualquier cambio me dices. ¡Atención que con el calor tenemos cada día menos fechas disponibles!'
            if (process.env.NEXT_PUBLIC_EVOLUTION_API_URL) {
                await sendDocumentMessage(
                    clientPhone, blob,
                    `Preventiva_${clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
                    caption
                )
            } else {
                window.open(`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(caption)}`, '_blank')
            }
        } catch (e: any) { setError(e.message || 'Erro ao enviar') }
        setSendingWA(false)
    }

    // ── Fechar venda (step agendar) ──────────────────────────────────────────
    const handleCloseSale = async () => {
        if (!installDate) { setError('Selecciona la fecha de instalación.'); return }
        if (!proposalId)  { setError('Guarda a proposta primeiro.'); return }
        setClosing(true); setError('')
        const res = await closeSaleAction(proposalId, {
            address: installAddress,
            notes: installNotes,
            scheduledAt: installDate,
        })
        if (!res.success) { setError(res.error ?? 'Erro ao confirmar'); setClosing(false); return }
        if (leadId) await updateClientStatusAction(leadId, 'handover')
        router.push('/dashboard/citas')
    }

    // ── Error banner ─────────────────────────────────────────────────────────
    const ErrorBanner = error ? (
        <div className="mb-5 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X size={14} /></button>
        </div>
    ) : null

    // ────────────────────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <Steps step={step} />

                {/* ══ STEP 1 — DADOS ══════════════════════════════════════════ */}
                {step === 'input' && (
                    <>
                        <header className="mb-6 flex items-center gap-4">
                            <button onClick={() => router.back()}
                                className="p-2 rounded-xl border border-border hover:bg-gray-50 text-navy transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-2xl font-bold text-navy">Nova <span className="accent-text">Proposta</span></h1>
                        </header>
                        {ErrorBanner}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Client */}
                            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                    <PenLine size={12} className="text-accent" /> Dados do Cliente
                                </h2>

                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Nome *</label>
                                    <input
                                        value={clientName}
                                        onChange={e => setClientName(e.target.value)}
                                        placeholder="Nome completo"
                                        className="w-full p-3 border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-accent/50 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Empresa</label>
                                    <CompanySelector
                                        value={selectedCompanyId}
                                        onChange={id => setSelectedCompanyId(id)}
                                    />
                                </div>
                            </div>

                            {/* Request */}
                            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles size={12} className="text-accent" /> Pedido
                                    </h2>
                                    <div className="flex bg-gray-100 rounded-lg overflow-hidden text-xs font-bold">
                                        {(['ai', 'manual'] as Mode[]).map(m => (
                                            <button key={m} onClick={() => setMode(m)}
                                                className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${mode === m ? 'bg-navy text-white' : 'text-text-muted hover:bg-gray-200'}`}>
                                                {m === 'ai' ? <><Sparkles size={11} /> IA</> : <><PenLine size={11} /> Manual</>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {mode === 'ai' && (
                                    <>
                                        <textarea
                                            value={requestText}
                                            onChange={e => setRequestText(e.target.value)}
                                            rows={5}
                                            placeholder="Ex: tenho um balcão de 3.50m de frente e 1.20m de profundidade, com 2.10m de altura…"
                                            className="w-full p-3 border border-border rounded-xl text-navy text-sm focus:ring-2 focus:ring-accent/50 outline-none resize-none"
                                        />

                                        <div
                                            onClick={() => document.getElementById('img-input')?.click()}
                                            className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
                                            {imagePreview ? (
                                                <div className="relative inline-block">
                                                    <img src={imagePreview} alt="preview" className="max-h-24 rounded-lg mx-auto" />
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(''); setImageUrl('') }}
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
                                                <textarea
                                                    value={clarification}
                                                    onChange={e => setClarification(e.target.value)}
                                                    rows={2} placeholder="Responde aqui…"
                                                    className="w-full p-2 border border-amber-200 rounded-lg text-navy text-sm outline-none resize-none"
                                                />
                                            </div>
                                        )}

                                        <button onClick={handleAnalyse} disabled={parsing}
                                            className="w-full py-3.5 bg-navy text-white font-black rounded-xl hover:bg-navy/90 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                                            {parsing
                                                ? <><Loader2 size={16} className="animate-spin" /> A analisar…</>
                                                : <><Sparkles size={16} /> Analisar com IA →</>
                                            }
                                        </button>
                                    </>
                                )}

                                {mode === 'manual' && (
                                    <div className="flex flex-col gap-4 pt-2">
                                        <p className="text-sm text-text-muted leading-relaxed">
                                            Os itens (espaços, medidas e preços) são adicionados no passo seguinte.
                                        </p>
                                        <button
                                            onClick={() => { setItems([]); setSaveState('idle'); setProposalId(''); setStep('proposta') }}
                                            className="w-full py-3.5 bg-navy text-white font-black rounded-xl hover:bg-navy/90 flex items-center justify-center gap-2 transition-all">
                                            <PenLine size={16} /> Adicionar Itens →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ══ STEP 2 — PROPOSTA (editor de itens) ═════════════════════ */}
                {step === 'proposta' && (
                    <>
                        <header className="mb-6 flex items-center gap-4">
                            <button onClick={() => { setStep('input'); setError('') }}
                                className="p-2 rounded-xl border border-border hover:bg-gray-50 text-navy transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl font-bold text-navy">Itens da <span className="accent-text">Proposta</span></h1>
                                <p className="text-xs text-text-muted mt-0.5 truncate">{clientName || '—'} · {city}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-2xl font-black text-navy">€ {total.toFixed(2)}</p>
                                <p className="text-[10px] text-text-muted uppercase font-bold">
                                    {items.length} item{items.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </header>
                        {ErrorBanner}

                        {/* Items table */}
                        <div className="bg-white rounded-2xl border border-border mb-5 overflow-hidden">
                            {/* Header row — desktop only */}
                            <div className="hidden md:grid md:grid-cols-[28px_1fr_84px_84px_56px_96px_60px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-border text-[9px] font-black text-text-muted uppercase tracking-widest">
                                <span>#</span>
                                <span>Espaço</span>
                                <span className="text-center">Largo&nbsp;(m)</span>
                                <span className="text-center">Alto&nbsp;(m)</span>
                                <span className="text-center">m²</span>
                                <span className="text-right">€&nbsp;Preço</span>
                                <span />
                            </div>

                            {/* Rows */}
                            {items.length === 0 ? (
                                <div className="py-12 text-center text-text-muted text-sm">
                                    Nenhum item — adiciona abaixo
                                </div>
                            ) : (
                                <div className="divide-y divide-border/60">
                                    {items.map((it, i) => (
                                        <div key={it.id} className="px-4 py-3">
                                            {/* Desktop row */}
                                            <div className="hidden md:grid md:grid-cols-[28px_1fr_84px_84px_56px_96px_60px] gap-3 items-center">
                                                <span className="w-6 h-6 rounded-full bg-accent/10 text-accent font-black text-[10px] flex items-center justify-center">
                                                    {i + 1}
                                                </span>
                                                <ItemNameField
                                                    value={it.name}
                                                    onChange={v => updateItem(it.id, 'name', v)}
                                                />
                                                <input
                                                    type="number" step="0.01"
                                                    value={it.width || ''}
                                                    onChange={e => updateItem(it.id, 'width', e.target.value)}
                                                    placeholder="0.00"
                                                    className="p-2 bg-gray-50 border border-border rounded-lg text-navy text-sm font-bold text-center outline-none focus:ring-1 focus:ring-accent/50 w-full"
                                                />
                                                <input
                                                    type="number" step="0.01"
                                                    value={it.height || ''}
                                                    onChange={e => updateItem(it.id, 'height', e.target.value)}
                                                    placeholder="0.00"
                                                    className="p-2 bg-gray-50 border border-border rounded-lg text-navy text-sm font-bold text-center outline-none focus:ring-1 focus:ring-accent/50 w-full"
                                                />
                                                <span className="text-sm font-bold text-text-muted text-center">
                                                    {it.area > 0 ? it.area.toFixed(2) : '—'}
                                                </span>
                                                <div className="relative">
                                                    <input
                                                        type="number" step="0.01"
                                                        value={it.price || ''}
                                                        onChange={e => updateItem(it.id, 'price', e.target.value)}
                                                        className={`w-full p-2 border rounded-lg text-navy text-sm font-bold text-right outline-none focus:ring-1 focus:ring-accent/50 ${
                                                            it.priceManual ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-border'
                                                        }`}
                                                    />
                                                    {it.priceManual && (
                                                        <span className="absolute -top-2 right-1 text-[8px] text-amber-600 font-bold bg-amber-50 px-1 rounded">
                                                            manual
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => duplicateItem(it.id)}
                                                        title="Duplicar"
                                                        className="w-7 h-7 flex items-center justify-center text-blue-300 hover:text-blue-500 transition-colors rounded">
                                                        <Copy size={13} />
                                                    </button>
                                                    <button onClick={() => removeItem(it.id)}
                                                        title="Remover"
                                                        className="w-7 h-7 flex items-center justify-center text-red-300 hover:text-red-500 transition-colors rounded">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mobile card */}
                                            <div className="flex md:hidden flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-accent/10 text-accent font-black text-[10px] flex items-center justify-center shrink-0">
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <ItemNameField
                                                            value={it.name}
                                                            onChange={v => updateItem(it.id, 'name', v)}
                                                        />
                                                    </div>
                                                    <button onClick={() => duplicateItem(it.id)} className="text-blue-300 hover:text-blue-500 p-1 shrink-0">
                                                        <Copy size={13} />
                                                    </button>
                                                    <button onClick={() => removeItem(it.id)} className="text-red-300 hover:text-red-500 p-1 shrink-0">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 pl-8">
                                                    <div>
                                                        <label className="text-[9px] text-text-muted font-bold uppercase block mb-1">Largo (m)</label>
                                                        <input
                                                            type="number" step="0.01"
                                                            value={it.width || ''}
                                                            onChange={e => updateItem(it.id, 'width', e.target.value)}
                                                            className="w-full p-2 bg-gray-50 border border-border rounded-lg text-sm font-bold text-center outline-none focus:ring-1 focus:ring-accent/50"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-text-muted font-bold uppercase block mb-1">Alto (m)</label>
                                                        <input
                                                            type="number" step="0.01"
                                                            value={it.height || ''}
                                                            onChange={e => updateItem(it.id, 'height', e.target.value)}
                                                            className="w-full p-2 bg-gray-50 border border-border rounded-lg text-sm font-bold text-center outline-none focus:ring-1 focus:ring-accent/50"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-text-muted font-bold uppercase block mb-1">
                                                            € Preço {it.priceManual && <span className="text-amber-500">(m)</span>}
                                                        </label>
                                                        <input
                                                            type="number" step="0.01"
                                                            value={it.price || ''}
                                                            onChange={e => updateItem(it.id, 'price', e.target.value)}
                                                            className={`w-full p-2 border rounded-lg text-sm font-bold text-right outline-none focus:ring-1 focus:ring-accent/50 ${
                                                                it.priceManual ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-border'
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                                {it.area > 0 && (
                                                    <p className="text-[9px] text-text-muted pl-8">
                                                        {it.area.toFixed(2)} m² · €{PRICING.PRICE_PER_M2}/m²
                                                        {it.price === PRICING.MIN_PRICE_PER_ITEM && !it.priceManual ? ' (mínimo)' : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add row */}
                            <div className="border-t border-dashed border-border">
                                <button onClick={addItem}
                                    className="w-full py-3 flex items-center justify-center gap-2 text-accent/80 text-xs font-black hover:bg-accent/5 transition-colors">
                                    <Plus size={14} /> Adicionar espaço
                                </button>
                            </div>

                            {/* Total footer */}
                            {items.length > 0 && (
                                <div className="border-t border-border px-4 py-3 flex justify-end items-center gap-3 bg-gray-50">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total</span>
                                    <span className="text-2xl font-black text-navy">€ {total.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* Mockup */}
                        {mockup && (
                            <div className="bg-navy rounded-2xl p-5 mb-5">
                                <p className="text-accent text-[9px] font-black uppercase tracking-widest mb-2">Plano de instalação</p>
                                <pre className="text-accent font-mono text-[10px] leading-tight whitespace-pre-wrap">{mockup}</pre>
                            </div>
                        )}

                        {/* AI refine */}
                        {mode === 'ai' && (
                            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5 mb-5">
                                <p className="text-[10px] font-black text-navy uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <RotateCcw size={12} /> Refinar com IA
                                </p>
                                <div className="flex gap-3">
                                    <input
                                        value={refineText}
                                        onChange={e => setRefineText(e.target.value)}
                                        placeholder="Ex: retirar o tecto, adicionar lateral de 1.20m…"
                                        onKeyDown={e => e.key === 'Enter' && !parsing && handleRefine()}
                                        className="flex-1 p-3 bg-white border border-border rounded-xl text-navy text-sm outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                    <button onClick={handleRefine} disabled={parsing || !refineText.trim()}
                                        className="px-5 bg-navy text-white font-black rounded-xl hover:bg-navy/90 disabled:opacity-40 text-sm whitespace-nowrap">
                                        {parsing ? <Loader2 size={14} className="animate-spin" /> : 'Reajustar'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleSave}
                                disabled={saveState === 'saving' || saveState === 'saved'}
                                className={`flex-1 py-3.5 font-black rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${
                                    saveState === 'saved'
                                        ? 'bg-green-50 border-2 border-green-200 text-green-700 cursor-default'
                                        : saveState === 'saving'
                                        ? 'bg-gray-100 text-gray-400 cursor-wait border-2 border-transparent'
                                        : 'bg-white border-2 border-navy text-navy hover:bg-navy/5'
                                }`}>
                                {saveState === 'saving'  ? <><Loader2 size={15} className="animate-spin" /> A guardar…</> :
                                 saveState === 'saved'   ? <><CheckCircle size={15} /> Guardada</> :
                                 saveState === 'modified'? <><Save size={15} /> Guardar Alterações</> :
                                                           <><Save size={15} /> Guardar Proposta</>}
                            </button>

                            <button
                                onClick={handleContinueToPreview}
                                disabled={saveState === 'saving' || items.length === 0}
                                className="flex-1 py-3.5 bg-accent text-navy font-black rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                                {saveState === 'saving' ? <Loader2 size={15} className="animate-spin" /> : null}
                                Ver Proposta →
                            </button>
                        </div>
                    </>
                )}

                {/* ══ STEP 3 — PREVIEW (revisão + PDF + WA) ═══════════════════ */}
                {step === 'preview' && (
                    <>
                        <header className="mb-6 flex items-center gap-4">
                            <button onClick={() => { setStep('proposta'); setError('') }}
                                className="p-2 rounded-xl border border-border hover:bg-gray-50 text-navy transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="flex-1">
                                <h1 className="text-2xl font-bold text-navy">Revisão da <span className="accent-text">Proposta</span></h1>
                                <p className="text-xs text-text-muted mt-0.5">Verifica, gera o PDF e envia antes de agendar</p>
                            </div>
                        </header>
                        {ErrorBanner}

                        {/* Client + company summary */}
                        <div className="bg-white border border-border rounded-2xl p-5 mb-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-black flex items-center justify-center shrink-0 text-sm">
                                {clientName.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-navy truncate">{clientName}</p>
                                <p className="text-xs text-text-muted truncate">
                                    {clientPhone && <span>{clientPhone} · </span>}
                                    <span>{city}</span>
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-2xl font-black text-navy">€ {total.toFixed(2)}</p>
                                <p className="text-[10px] text-text-muted uppercase font-bold">
                                    {items.length} item{items.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        {/* Items list (read-only) */}
                        <div className="bg-white rounded-2xl border border-border mb-5 overflow-hidden">
                            <div className="hidden md:grid md:grid-cols-[28px_1fr_80px_80px_56px_96px] gap-3 px-4 py-2 bg-gray-50 border-b border-border text-[9px] font-black text-text-muted uppercase tracking-widest">
                                <span>#</span>
                                <span>Espaço</span>
                                <span className="text-center">Largo</span>
                                <span className="text-center">Alto</span>
                                <span className="text-center">m²</span>
                                <span className="text-right">Preço</span>
                            </div>
                            <div className="divide-y divide-border/60">
                                {items.map((it, i) => (
                                    <div key={it.id} className="px-4 py-3 grid grid-cols-[28px_1fr_80px_80px_56px_96px] gap-3 items-center">
                                        <span className="w-6 h-6 rounded-full bg-accent/10 text-accent font-black text-[10px] flex items-center justify-center">
                                            {i + 1}
                                        </span>
                                        <span className="font-semibold text-navy text-sm truncate">{it.name || '—'}</span>
                                        <span className="text-sm text-text-muted text-center">{it.width > 0 ? `${it.width}m` : '—'}</span>
                                        <span className="text-sm text-text-muted text-center">{it.height > 0 ? `${it.height}m` : '—'}</span>
                                        <span className="text-sm font-bold text-text-muted text-center">{it.area > 0 ? it.area.toFixed(2) : '—'}</span>
                                        <span className="text-sm font-black text-navy text-right">€ {it.price.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-border px-4 py-3 flex justify-end items-center gap-3 bg-gray-50">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-navy">€ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Mockup */}
                        {mockup && (
                            <div className="bg-navy rounded-2xl p-5 mb-5">
                                <p className="text-accent text-[9px] font-black uppercase tracking-widest mb-2">Plano de instalação</p>
                                <pre className="text-accent font-mono text-[10px] leading-tight whitespace-pre-wrap">{mockup}</pre>
                            </div>
                        )}

                        {/* PDF + WhatsApp */}
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <button onClick={handleDownloadPDF} disabled={generatingPDF}
                                className="py-3.5 bg-red-50 border border-red-200 text-red-700 font-black rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                                {generatingPDF ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                {generatingPDF ? 'Gerando…' : 'Download PDF'}
                            </button>
                            <button onClick={handleWhatsApp} disabled={sendingWA}
                                className="py-3.5 bg-green-50 border border-green-200 text-green-700 font-black rounded-xl hover:bg-green-600 hover:text-white hover:border-green-600 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                                {sendingWA ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                                {sendingWA ? 'Enviando…' : 'Enviar WhatsApp'}
                            </button>
                        </div>

                        {/* CTA → agendar */}
                        <button
                            onClick={() => { setError(''); if (!installAddress) setInstallAddress(clientLocation); setStep('venda') }}
                            className="w-full py-4 bg-accent text-navy font-black rounded-2xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg">
                            <Calendar size={20} /> Fechar Venda e Agendar →
                        </button>

                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-full mt-3 py-2 text-xs text-text-muted font-bold hover:text-navy transition-colors">
                            Guardar sem agendar
                        </button>
                    </>
                )}

                {/* ══ STEP 4 — AGENDAR ════════════════════════════════════════ */}
                {step === 'venda' && (
                    <>
                        <header className="mb-6 flex items-center gap-4">
                            <button onClick={() => { setStep('preview'); setError('') }}
                                className="p-2 rounded-xl border border-border hover:bg-gray-50 text-navy transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="flex-1">
                                <h1 className="text-2xl font-bold text-navy">Agendar <span className="accent-text">Instalação</span></h1>
                                <p className="text-xs text-text-muted mt-0.5">Finaliza a venda marcando a data</p>
                            </div>
                        </header>
                        {ErrorBanner}

                        {/* Client + proposal summary */}
                        <div className="bg-white border border-border rounded-2xl p-5 mb-6 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-black flex items-center justify-center shrink-0 text-sm">
                                {clientName.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-navy truncate">{clientName}</p>
                                <p className="text-xs text-text-muted truncate">
                                    {clientPhone && <span>{clientPhone} · </span>}
                                    <span>{city}</span>
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-2xl font-black text-navy">€ {total.toFixed(2)}</p>
                                <p className="text-[10px] text-text-muted uppercase font-bold">
                                    {items.length} item{items.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="bg-white rounded-2xl border border-border p-6 space-y-5 mb-6">
                            <div>
                                <label className="flex items-center gap-1 text-[10px] font-black uppercase text-navy/60 mb-2">
                                    <Calendar size={10} /> Data e hora de instalação *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={installDate}
                                    onChange={e => setInstallDate(e.target.value)}
                                    className="w-full h-12 px-4 bg-gray-50 rounded-xl text-navy font-medium outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-navy/60 mb-2">
                                    WhatsApp *
                                </label>
                                <input
                                    value={clientPhone}
                                    onChange={e => setClientPhone(e.target.value)}
                                    placeholder="34600000000"
                                    className="w-full h-12 px-4 bg-gray-50 rounded-xl text-navy font-medium outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-[10px] font-black uppercase text-navy/60 mb-2">
                                    <MapPin size={10} /> Dirección de instalación
                                </label>
                                <input
                                    value={installAddress}
                                    onChange={e => setInstallAddress(e.target.value)}
                                    placeholder="Calle, número, ciudad…"
                                    className="w-full h-12 px-4 bg-gray-50 rounded-xl text-navy font-medium outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-navy/60 mb-2">
                                    Notas para o instalador
                                </label>
                                <textarea
                                    value={installNotes}
                                    onChange={e => setInstallNotes(e.target.value)}
                                    placeholder="Acesso ao edifício, horários, dificuldades previstas…"
                                    rows={3}
                                    className="w-full p-4 bg-gray-50 rounded-xl text-navy font-medium outline-none focus:ring-2 focus:ring-accent/30 text-sm resize-none"
                                />
                            </div>
                        </div>

                        {/* Primary CTA */}
                        <button
                            onClick={handleCloseSale}
                            disabled={closing || !installDate}
                            className="w-full py-4 bg-accent text-navy font-black rounded-2xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-40">
                            {closing
                                ? <><Loader2 size={20} className="animate-spin" /> A confirmar…</>
                                : <><Send size={20} /> Confirmar Instalação</>
                            }
                        </button>

                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-full mt-3 py-2 text-xs text-text-muted font-bold hover:text-navy transition-colors">
                            Guardar sem agendar
                        </button>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}

export default function NovaPropostaPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin h-8 w-8 text-accent" />
                </div>
            </DashboardLayout>
        }>
            <NovaPropostaInner />
        </Suspense>
    )
}
