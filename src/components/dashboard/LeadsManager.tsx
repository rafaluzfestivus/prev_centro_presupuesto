'use client'

import React, { useEffect, useState } from 'react'
import { Search, RefreshCw, CheckCircle, FilePlus, ArrowRightCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type LeadStatus = 'new' | 'processed' | 'handover'

const STATUS_CONFIG: Record<LeadStatus, { label: string; cls: string }> = {
    new:       { label: 'Nuevo',       cls: 'bg-gray-100 text-gray-600' },
    processed: { label: 'En gestión',  cls: 'bg-blue-100 text-blue-700' },
    handover:  { label: 'Traspasado',  cls: 'bg-green-100 text-green-700' },
}

const LeadsManager = () => {
    const [leads, setLeads]       = useState<any[]>([])
    const [loading, setLoading]   = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const supabase = createClient()
    const router   = useRouter()
    const { profile } = useProfile()

    const fetchLeads = async () => {
        if (!profile) return
        setLoading(true)
        const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('source', 'site')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false })
        setLeads(data || [])
        setLoading(false)
    }

    useEffect(() => { fetchLeads() }, [profile])

    const updateStatus = async (id: string, status: LeadStatus) => {
        if (!profile) return
        setUpdatingId(id)
        await supabase
            .from('clients')
            .update({ status })
            .eq('id', id)
            .eq('company_id', profile.company_id)
        setUpdatingId(null)
        fetchLeads()
    }

    const handleCreateProposal = async (lead: any) => {
        // Mark lead as "in progress" immediately when creating a proposal
        if (lead.status === 'new') {
            await updateStatus(lead.id, 'processed')
        }
        const params = new URLSearchParams({
            lead_id:  lead.id,
            name:     lead.name     || '',
            phone:    lead.whatsapp || '',
            location: lead.location || '',
            message:  lead.message  || '',
        })
        router.push(`/dashboard/nova-proposta?${params.toString()}`)
    }

    const filtered = leads.filter(lead =>
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.whatsapp?.includes(searchTerm)
    )

    return (
        <div className="leads-manager">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        Leads do <span className="accent-text">Site</span>
                    </h1>
                    <p className="text-text-muted">Contactos captados via formulário web.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou WhatsApp…"
                            className="pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-64 text-navy"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchLeads}
                        className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="glass-card overflow-hidden border-none shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b-2 border-border">
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Lead</th>
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Contacto</th>
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Localização</th>
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Mensagem</th>
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider text-center">Estado</th>
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider text-right">Acções</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/50">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-10 text-center text-text-muted">
                                    <Loader2 className="animate-spin inline-block mr-2" size={18} />
                                    A carregar leads…
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-10 text-center text-text-muted">
                                    {searchTerm ? 'Nenhum lead corresponde à pesquisa.' : 'Ainda não há leads do site.'}
                                </td>
                            </tr>
                        ) : filtered.map(lead => {
                            const status = (lead.status as LeadStatus) || 'new'
                            const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.new
                            const busy   = updatingId === lead.id

                            return (
                                <tr key={lead.id} className="border-b border-border hover:bg-white/80 transition-colors">
                                    {/* Lead */}
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">
                                                {lead.name?.charAt(0) || 'L'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-navy">{lead.name}</p>
                                                <p className="text-xs text-text-muted">
                                                    {new Date(lead.created_at).toLocaleDateString('es-ES')}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Contacto */}
                                    <td className="p-5">
                                        <p className="text-sm font-semibold text-navy">{lead.whatsapp || '—'}</p>
                                        {lead.email && (
                                            <p className="text-xs text-text-muted mt-0.5">{lead.email}</p>
                                        )}
                                        {lead.service_requested && (
                                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase border border-blue-100">
                                                {lead.service_requested}
                                            </span>
                                        )}
                                    </td>

                                    {/* Localização */}
                                    <td className="p-5">
                                        <p className="text-sm text-text-main font-medium">
                                            {lead.location || (lead.postal_code ? `CP: ${lead.postal_code}` : '—')}
                                        </p>
                                        {lead.location && lead.postal_code && (
                                            <p className="text-[10px] text-text-muted">CP: {lead.postal_code}</p>
                                        )}
                                    </td>

                                    {/* Mensagem */}
                                    <td className="p-5">
                                        <div className="max-w-[240px] bg-bg-dark/20 p-3 rounded-xl border border-border/30">
                                            <p className="text-xs text-navy italic leading-relaxed whitespace-pre-line line-clamp-3">
                                                {lead.message || 'Sem mensagem'}
                                            </p>
                                        </div>
                                    </td>

                                    {/* Estado */}
                                    <td className="p-5 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.cls}`}>
                                            {cfg.label}
                                        </span>
                                    </td>

                                    {/* Acções */}
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            {/* Criar proposta */}
                                            {status !== 'handover' && (
                                                <button
                                                    onClick={() => handleCreateProposal(lead)}
                                                    disabled={busy}
                                                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                                                    title="Criar Proposta"
                                                >
                                                    <FilePlus size={18} />
                                                </button>
                                            )}

                                            {/* Marcar como "En gestión" */}
                                            {status === 'new' && (
                                                <button
                                                    onClick={() => updateStatus(lead.id, 'processed')}
                                                    disabled={busy}
                                                    className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                                                    title="Marcar En gestión"
                                                >
                                                    {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                                </button>
                                            )}

                                            {/* Marcar como Traspasado */}
                                            {status !== 'handover' && (
                                                <button
                                                    onClick={() => updateStatus(lead.id, 'handover')}
                                                    disabled={busy}
                                                    className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-600 hover:text-white transition-all"
                                                    title="Marcar Traspasado"
                                                >
                                                    {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightCircle size={18} />}
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
                    <div className="p-4 bg-navy/5 border-t border-border flex justify-end gap-6 text-xs font-black text-navy">
                        <span>Total: {filtered.length}</span>
                        <span>Nuevos: {filtered.filter(l => l.status === 'new').length}</span>
                        <span>En gestión: {filtered.filter(l => l.status === 'processed').length}</span>
                        <span>Traspasados: {filtered.filter(l => l.status === 'handover').length}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LeadsManager
