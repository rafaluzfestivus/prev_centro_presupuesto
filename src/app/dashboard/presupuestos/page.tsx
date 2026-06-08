'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    getProposalsAction,
    deleteProposalAction,
    getAppointmentByProposalIdAction,
} from '@/actions/proposal'
import { Proposal } from '@/lib/types'
import {
    Loader2, Trash2, FileText, Plus, RefreshCw,
    ClipboardList, AlertCircle, Search, X, CheckCircle2,
    Clock, ChevronRight,
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Suspense } from 'react'

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
    Confirmada: { label: 'Confirmada', cls: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
    Processada: { label: 'Processada', cls: 'bg-blue-100 text-blue-700',    icon: FileText },
    Rascunho:   { label: 'Rascunho',   cls: 'bg-gray-100 text-gray-500',    icon: Clock },
}

function ProposalsContent() {
    const router = useRouter()
    const [proposals, setProposals]             = useState<Proposal[]>([])
    const [loading, setLoading]                 = useState(true)
    const [search, setSearch]                   = useState('')
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const [navigating, setNavigating]           = useState<string | null>(null)
    const [error, setError]                     = useState('')

    const load = async () => {
        setLoading(true)
        const result = await getProposalsAction()
        if (result.success && result.data) setProposals(result.data)
        else setError('Erro ao carregar propostas')
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const handleDelete = async (id: string) => {
        const result = await deleteProposalAction(id)
        if (result.success) { setPendingDeleteId(null); load() }
        else setError('Erro ao apagar proposta')
    }

    // For confirmed proposals: navigate to the appointment report if it exists,
    // otherwise fall back to the proposal review page.
    const handleOpenReport = async (proposal: Proposal) => {
        setNavigating(proposal.id)
        if (proposal.status === 'Confirmada') {
            const res = await getAppointmentByProposalIdAction(proposal.id)
            if (res.appointmentId) {
                router.push(`/dashboard/citas/${res.appointmentId}/report`)
                return
            }
        }
        router.push(`/proposal/${proposal.id}/review`)
        setNavigating(null)
    }

    const filtered = proposals.filter(p => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
            (p.cliente_nome || '').toLowerCase().includes(q) ||
            new Date(p.data_criacao).toLocaleDateString().includes(q)
        )
    })

    return (
        <DashboardLayout>
            {/* Header */}
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        Histórico de <span className="accent-text">Propostas</span>
                    </h1>
                    <p className="text-text-muted">
                        Todas as propostas criadas — clique numa para ver ou editar.
                    </p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/nova-proposta')}
                    className="flex items-center gap-2 px-5 py-3 bg-accent text-navy font-black rounded-xl hover:shadow-lg transition-all shrink-0"
                >
                    <Plus size={18} />
                    Nova Proposta
                </button>
            </header>

            {error && (
                <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError('')}><X size={14} /></button>
                </div>
            )}

            {/* Search + refresh */}
            <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nome ou data…"
                        className="w-full pl-9 pr-8 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 text-navy"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors"
                    title="Atualizar"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
                {!loading && (
                    <span className="text-xs text-text-muted font-bold">
                        {filtered.length} proposta{filtered.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Proposals list */}
            <div className="glass-card overflow-hidden border-none shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b-2 border-border text-navy text-xs uppercase tracking-wider">
                            <th className="p-5 font-bold">Cliente</th>
                            <th className="p-5 font-bold">Localização</th>
                            <th className="p-5 font-bold text-center">Estado</th>
                            <th className="p-5 font-bold text-right">Total</th>
                            <th className="p-5 font-bold text-center">Data</th>
                            <th className="p-5 font-bold text-right">Acções</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/50">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-text-muted">
                                    <Loader2 className="animate-spin inline-block mr-2" size={18} />
                                    A carregar propostas…
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center">
                                    <FileText size={32} className="mx-auto mb-3 text-text-muted opacity-30" />
                                    <p className="text-text-muted text-sm font-medium">
                                        {search ? 'Nenhuma proposta corresponde à pesquisa.' : 'Ainda não há propostas.'}
                                    </p>
                                    {!search && (
                                        <button
                                            onClick={() => router.push('/dashboard/nova-proposta')}
                                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-accent text-navy font-bold rounded-xl text-sm hover:shadow-md transition-all"
                                        >
                                            <Plus size={15} /> Criar primeira proposta
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ) : filtered.map(p => {
                            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.Rascunho
                            const Icon = cfg.icon
                            const isNavigating = navigating === p.id
                            const isConfirmed  = p.status === 'Confirmada'

                            return (
                                <tr
                                    key={p.id}
                                    className="border-b border-border hover:bg-white transition-colors group cursor-pointer"
                                    onClick={() => !pendingDeleteId && handleOpenReport(p)}
                                >
                                    {/* Cliente */}
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent font-black text-sm shrink-0">
                                                {(p.cliente_nome || '?')[0].toUpperCase()}
                                            </div>
                                            <span className="font-bold text-navy">{p.cliente_nome || '—'}</span>
                                        </div>
                                    </td>

                                    {/* Localização */}
                                    <td className="p-5 text-sm text-text-muted font-medium">{p.cidade || '—'}</td>

                                    {/* Estado */}
                                    <td className="p-5 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${cfg.cls}`}>
                                            <Icon size={10} />
                                            {cfg.label}
                                        </span>
                                    </td>

                                    {/* Total */}
                                    <td className="p-5 text-right font-black text-navy">
                                        {p.total_geral ? `€ ${Number(p.total_geral).toFixed(2)}` : '—'}
                                    </td>

                                    {/* Data */}
                                    <td className="p-5 text-center text-sm text-text-muted font-medium">
                                        {new Date(p.data_criacao).toLocaleDateString('es-ES')}
                                    </td>

                                    {/* Acções */}
                                    <td className="p-5 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end items-center gap-2">
                                            {/* Ver proposta / ficha */}
                                            <button
                                                onClick={() => handleOpenReport(p)}
                                                disabled={isNavigating}
                                                className={`p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                                                    isConfirmed
                                                        ? 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                                                        : 'bg-accent/10 text-accent hover:bg-accent hover:text-navy'
                                                }`}
                                                title={isConfirmed ? 'Ver Ficha de Instalação' : 'Ver / Editar Proposta'}
                                            >
                                                {isNavigating
                                                    ? <Loader2 size={16} className="animate-spin" />
                                                    : isConfirmed
                                                        ? <ClipboardList size={16} />
                                                        : <ChevronRight size={16} />
                                                }
                                            </button>

                                            {/* Apagar */}
                                            {pendingDeleteId === p.id ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setPendingDeleteId(null)}
                                                        className="px-2 py-1 text-xs bg-white border border-border text-navy rounded-lg"
                                                    >
                                                        Não
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p.id)}
                                                        className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg font-bold"
                                                    >
                                                        Sim
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setPendingDeleteId(p.id)}
                                                    className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Apagar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {filtered.length > 0 && (
                    <div className="p-4 bg-navy/5 border-t border-border flex justify-end gap-8 text-sm font-black text-navy">
                        <span>Total: {filtered.length} proposta{filtered.length !== 1 ? 's' : ''}</span>
                        <span>
                            Confirmadas: {filtered.filter(p => p.status === 'Confirmada').length}
                        </span>
                        <span>
                            Valor total: € {filtered
                                .filter(p => p.status === 'Confirmada')
                                .reduce((s, p) => s + (Number(p.total_geral) || 0), 0)
                                .toFixed(2)}
                        </span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}

export default function ProposalsPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin h-8 w-8 text-accent" />
                </div>
            </DashboardLayout>
        }>
            <ProposalsContent />
        </Suspense>
    )
}
