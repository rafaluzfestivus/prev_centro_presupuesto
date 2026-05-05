'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProposalAction, getProposalsAction, deleteProposalAction } from '@/actions/proposal'
import { Proposal } from '@/lib/types'
import { Loader2, Trash2, FileText, Plus, RefreshCw, Calendar, ClipboardList, AlertCircle, Search, X } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Suspense } from 'react'

const CITIES = ['Preventiva Centro', 'Preventiva Este'] as const

function ProposalsContent() {
    const router = useRouter()
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [clientName, setClientName] = useState('')
    const [city, setCity] = useState<string>(CITIES[0])
    const [loading, setLoading] = useState(false)
    const [formError, setFormError] = useState('')
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    useEffect(() => { loadProposals() }, [])

    const loadProposals = async () => {
        setLoadingHistory(true)
        const result = await getProposalsAction()
        if (result.success && result.data) setProposals(result.data)
        setLoadingHistory(false)
    }

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormError('')
        if (!clientName.trim()) { setFormError('Por favor, insira o nome do cliente.'); return }
        setLoading(true)
        try {
            const result = await createProposalAction({ clientName: clientName.trim(), city })
            if (result.success && result.id) router.push(`/proposal/${result.id}/builder`)
            else setFormError('Erro ao criar orçamento: ' + (result.error || 'Erro desconhecido'))
        } catch (error) {
            console.error(error)
            setFormError('Erro ao criar orçamento')
        } finally {
            setLoading(false)
        }
    }

    const handleScheduleVisit = (e: React.MouseEvent, p: Proposal) => {
        e.stopPropagation()
        router.push(`/dashboard/citas?client=${encodeURIComponent(p.cliente_nome || 'Cliente')}`)
    }

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        setPendingDeleteId(id)
    }

    const handleDeleteConfirm = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!pendingDeleteId) return
        const result = await deleteProposalAction(pendingDeleteId)
        if (result.success) { setPendingDeleteId(null); loadProposals() }
        else { setPendingDeleteId(null); setFormError('Erro ao excluir orçamento') }
    }

    const filteredProposals = proposals.filter(p => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        const name = (p.cliente_nome || '').toLowerCase()
        const date = new Date(p.data_criacao).toLocaleDateString()
        return name.includes(q) || date.includes(q)
    })

    return (
        <DashboardLayout>
            <header className="mb-10">
                <h1 className="text-3xl font-bold mb-2">Gerenciador de <span className="accent-text">Orçamentos</span></h1>
                <p className="text-text-muted">Crie orçamentos profissionais de forma rápida e simples.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ── New Proposal Form ── */}
                <div className="glass-card p-10 bg-white border-none shadow-sm h-fit">
                    <h2 className="text-xl font-bold text-navy mb-8 uppercase tracking-widest flex items-center gap-3">
                        <Plus className="text-accent" />
                        Novo Orçamento
                    </h2>

                    {formError && (
                        <div className="mb-6 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{formError}</span>
                            <button onClick={() => setFormError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleGenerate}>
                        <div className="space-y-2">
                            <Label className="font-bold text-navy uppercase text-[10px] tracking-widest">Nome do Cliente</Label>
                            <Input
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Ex: Ana García"
                                className="p-4 bg-bg-dark border-none rounded-xl text-base"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold text-navy uppercase text-[10px] tracking-widest">Delegação</Label>
                            <select
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full p-4 bg-bg-dark border-none rounded-xl text-base font-medium text-navy focus:ring-2 focus:ring-accent/30 outline-none appearance-none cursor-pointer"
                            >
                                {CITIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <Button
                            type="submit"
                            className="w-full py-4 bg-accent text-navy font-black rounded-xl hover:shadow-xl transition-all h-auto text-lg"
                            disabled={loading}
                        >
                            {loading && <Loader2 className="mr-3 h-5 w-5 animate-spin" />}
                            {loading ? 'Criando...' : 'CRIAR ORÇAMENTO →'}
                        </Button>
                    </form>
                </div>

                {/* ── History ── */}
                <div className="glass-card p-10 bg-white border-none shadow-sm flex flex-col h-[640px]">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-navy uppercase tracking-widest flex items-center gap-3">
                            <FileText className="text-accent" />
                            Histórico
                        </h2>
                        <button onClick={loadProposals} disabled={loadingHistory} className="p-2 text-text-muted hover:text-navy transition-colors">
                            <RefreshCw size={20} className={loadingHistory ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por nome ou data..."
                            className="pl-9 bg-bg-dark border-none rounded-xl text-sm"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="animate-spin h-6 w-6 text-accent" />
                            </div>
                        ) : filteredProposals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-text-muted">
                                <FileText size={32} className="mb-2 opacity-30" />
                                <p className="text-sm font-medium">{search ? 'Nenhum resultado' : 'Nenhum orçamento ainda'}</p>
                            </div>
                        ) : filteredProposals.map((p) => (
                            <div
                                key={p.id}
                                className="p-5 rounded-2xl bg-bg-dark/50 border border-border/50 hover:bg-white hover:shadow-md transition-all cursor-pointer group"
                                onClick={() => router.push(`/proposal/${p.id}/review`)}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-navy">{p.cliente_nome}</h3>
                                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">{p.cidade}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                        p.status === 'Confirmada' ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent'
                                    }`}>{p.status}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted font-bold">{new Date(p.data_criacao).toLocaleDateString()}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-navy">{p.total_geral ? `€ ${Number(p.total_geral).toFixed(2)}` : '-'}</span>
                                        <button
                                            onClick={(e) => handleScheduleVisit(e, p)}
                                            className="p-2 text-accent bg-accent/5 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-navy rounded-lg transition-all"
                                            title="Agendar Visita"
                                        >
                                            <Calendar size={16} />
                                        </button>
                                        {p.status === 'Confirmada' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); router.push(`/proposal/${p.id}/report`) }}
                                                className="p-2 text-navy bg-navy/5 opacity-0 group-hover:opacity-100 hover:bg-navy hover:text-white rounded-lg transition-all"
                                                title="Ver Ficha de Instalación"
                                            >
                                                <ClipboardList size={16} />
                                            </button>
                                        )}
                                        {pendingDeleteId === p.id ? (
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={(e) => { e.stopPropagation(); setPendingDeleteId(null) }} className="px-2 py-1 text-xs bg-white border border-border text-navy rounded-lg">Não</button>
                                                <button onClick={handleDeleteConfirm} className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg font-bold">Sim</button>
                                            </div>
                                        ) : (
                                            <button onClick={(e) => handleDeleteClick(e, p.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all" title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}

export default function ProposalsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-accent" /></div>}>
            <ProposalsContent />
        </Suspense>
    )
}
