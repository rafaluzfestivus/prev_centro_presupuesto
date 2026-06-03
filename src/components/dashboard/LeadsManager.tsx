'use client'

import React, { useEffect, useState } from 'react';
import { Users, Search, RefreshCw, CheckCircle, Clock, AlertCircle, FilePlus, LayoutList, Kanban, Phone, MessageSquare, Globe, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/useProfile';

type Lead = {
    id: string;
    name: string;
    whatsapp: string;
    email?: string;
    location?: string;
    postal_code?: string;
    message?: string;
    service_requested?: string;
    source: string;
    status: string;
    created_at: string;
    company_id: number;
};

type View = 'table' | 'kanban';

const SOURCE_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
    site:      { label: 'Web',       cls: 'bg-blue-50 text-blue-600 border-blue-100',   icon: Globe },
    whatsapp:  { label: 'WhatsApp',  cls: 'bg-green-50 text-green-600 border-green-100', icon: Wifi },
    manual:    { label: 'Manual',    cls: 'bg-gray-100 text-gray-500 border-gray-200',   icon: Users },
    proposta:  { label: 'Proposta',  cls: 'bg-purple-50 text-purple-600 border-purple-100', icon: FilePlus },
};

const STATUS_COLUMNS = [
    { key: 'new',       label: 'Nuevo',     color: 'border-gray-300',   bg: 'bg-gray-50',    dot: 'bg-gray-400'   },
    { key: 'processed', label: 'Procesado', color: 'border-green-400',  bg: 'bg-green-50',   dot: 'bg-green-500'  },
    { key: 'handover',  label: 'Traspaso',  color: 'border-accent',     bg: 'bg-accent/5',   dot: 'bg-accent'     },
];

const LeadsManager = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<View>('kanban');
    const supabase = createClient();
    const router = useRouter();
    const { profile } = useProfile();

    const fetchLeads = async () => {
        if (!profile) return;
        setLoading(true);
        const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false });
        setLeads(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchLeads(); }, [profile]);

    const updateStatus = async (id: string, status: string) => {
        if (!profile) return;
        const { error } = await supabase
            .from('clients')
            .update({ status })
            .eq('id', id)
            .eq('company_id', profile.company_id);
        if (error) alert('Error al actualizar el estado: ' + error.message);
        else fetchLeads();
    };

    const filteredLeads = leads.filter(lead =>
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.whatsapp?.includes(searchTerm) ||
        lead.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const goToProposal = (lead: Lead) => {
        const params = new URLSearchParams({ source: 'lead', name: lead.name || '', whatsapp: lead.whatsapp || '', message: lead.message || '' });
        router.push(`/proposal/new?${params.toString()}`);
    };

    const SourceBadge = ({ source }: { source: string }) => {
        const cfg = SOURCE_BADGE[source] || SOURCE_BADGE.manual;
        const Icon = cfg.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${cfg.cls}`}>
                <Icon size={9} />
                {cfg.label}
            </span>
        );
    };

    const ActionButtons = ({ lead, compact = false }: { lead: Lead; compact?: boolean }) => (
        <div className={`flex ${compact ? 'flex-col gap-1' : 'gap-2 justify-end'}`}>
            <button onClick={() => goToProposal(lead)}
                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                title="Gerar Proposta"><FilePlus size={14} /></button>
            <button onClick={() => updateStatus(lead.id, 'handover')}
                className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-navy transition-all"
                title="Mover a Traspaso"><AlertCircle size={14} /></button>
            <button onClick={() => updateStatus(lead.id, 'processed')}
                className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-600 hover:text-white transition-all"
                title="Marcar Procesado"><CheckCircle size={14} /></button>
        </div>
    );

    return (
        <div className="leads-manager">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Funil de <span className="accent-text">Leads</span></h1>
                    <p className="text-text-muted">Todos os contactos captados — web, WhatsApp e manual.</p>
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input type="text" placeholder="Buscar…" value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-52 text-navy" />
                    </div>
                    <div className="flex bg-white border border-border rounded-xl overflow-hidden">
                        <button onClick={() => setView('kanban')}
                            className={`px-3 py-2 flex items-center gap-1.5 text-xs font-bold transition-colors ${view === 'kanban' ? 'bg-navy text-white' : 'text-text-muted hover:bg-gray-50'}`}>
                            <Kanban size={14} /> Kanban
                        </button>
                        <button onClick={() => setView('table')}
                            className={`px-3 py-2 flex items-center gap-1.5 text-xs font-bold transition-colors ${view === 'table' ? 'bg-navy text-white' : 'text-text-muted hover:bg-gray-50'}`}>
                            <LayoutList size={14} /> Tabla
                        </button>
                    </div>
                    <button onClick={fetchLeads}
                        className="p-2 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors"
                        title="Actualizar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
                </div>
            </header>

            {/* ── KANBAN VIEW ── */}
            {view === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {STATUS_COLUMNS.map(col => {
                        const colLeads = filteredLeads.filter(l => l.status === col.key);
                        return (
                            <div key={col.key} className={`rounded-2xl border-2 ${col.color} ${col.bg} flex flex-col min-h-[400px]`}>
                                {/* Column header */}
                                <div className="px-5 py-4 flex items-center justify-between border-b border-black/5">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                        <span className="font-black text-navy uppercase tracking-widest text-xs">{col.label}</span>
                                    </div>
                                    <span className="bg-white text-navy font-black text-xs px-2 py-0.5 rounded-full border border-black/10">
                                        {colLeads.length}
                                    </span>
                                </div>
                                {/* Cards */}
                                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px]">
                                    {loading ? (
                                        <div className="space-y-2 animate-pulse">
                                            {[1,2,3].map(i => <div key={i} className="h-24 bg-white/70 rounded-xl" />)}
                                        </div>
                                    ) : colLeads.length === 0 ? (
                                        <p className="text-center text-xs text-text-muted py-8 italic">Sin leads aquí</p>
                                    ) : colLeads.map(lead => (
                                        <div key={lead.id} className="bg-white rounded-xl p-4 shadow-sm border border-border/40 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-7 h-7 rounded-full bg-accent/20 text-accent font-black text-xs flex items-center justify-center shrink-0">
                                                        {lead.name?.charAt(0) || '?'}
                                                    </div>
                                                    <p className="font-bold text-navy text-sm truncate">{lead.name || 'Sin nombre'}</p>
                                                </div>
                                                <SourceBadge source={lead.source} />
                                            </div>
                                            {lead.whatsapp && (
                                                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                                                    <Phone size={10} className="shrink-0" />
                                                    <span>{lead.whatsapp}</span>
                                                </div>
                                            )}
                                            {lead.location && (
                                                <p className="text-xs text-text-muted mb-1 truncate">{lead.location}</p>
                                            )}
                                            {lead.message && (
                                                <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                                                    <div className="flex items-start gap-1">
                                                        <MessageSquare size={9} className="text-text-muted shrink-0 mt-0.5" />
                                                        <p className="text-[10px] text-navy/70 italic leading-relaxed line-clamp-2">{lead.message}</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-3 flex items-center justify-between">
                                                <span className="text-[10px] text-text-muted">
                                                    {new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                                </span>
                                                <ActionButtons lead={lead} compact />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── TABLE VIEW ── */}
            {view === 'table' && (
                <div className="glass-card overflow-hidden border-none shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b-2 border-border">
                                <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Lead</th>
                                <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Contacto</th>
                                <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Localización</th>
                                <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Mensaje</th>
                                <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Fuente</th>
                                <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Estado</th>
                                <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white/50">
                            {loading ? (
                                <tr><td colSpan={7} className="p-10 text-center text-text-muted">Sincronizando...</td></tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr><td colSpan={7} className="p-10 text-center text-text-muted">No se han encontrado leads.</td></tr>
                            ) : filteredLeads.map(lead => (
                                <tr key={lead.id} className="border-b border-border hover:bg-white/80 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                                                {lead.name?.charAt(0) || 'L'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-navy">{lead.name}</p>
                                                <p className="text-xs text-text-muted">{new Date(lead.created_at).toLocaleDateString('es-ES')}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <p className="text-sm font-semibold text-navy">{lead.whatsapp}</p>
                                        <p className="text-xs text-text-muted">{lead.email || 'Sin e-mail'}</p>
                                    </td>
                                    <td className="p-5">
                                        <p className="text-sm text-text-main font-medium">
                                            {lead.location || (lead.postal_code ? `CP: ${lead.postal_code}` : '—')}
                                        </p>
                                    </td>
                                    <td className="p-5">
                                        <p className="text-xs text-navy italic max-w-[200px] truncate">{lead.message || '—'}</p>
                                    </td>
                                    <td className="p-5">
                                        <SourceBadge source={lead.source} />
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            lead.status === 'processed' ? 'bg-green-100 text-green-700' :
                                            lead.status === 'handover'  ? 'bg-accent/20 text-accent' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {lead.status === 'processed' ? 'Procesado' : lead.status === 'handover' ? 'Traspaso' : 'Nuevo'}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <ActionButtons lead={lead} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LeadsManager;
