'use client'

import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, FilePlus, Phone, MessageSquare, Globe, Wifi, Users, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/useProfile';

type Lead = {
    id: string;
    name: string;
    whatsapp: string;
    email?: string;
    location?: string;
    message?: string;
    service_requested?: string;
    source: string;
    status: string;
    created_at: string;
};

const SOURCE_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
    site:     { label: 'Web',      cls: 'bg-blue-50 text-blue-600 border-blue-100',    icon: Globe },
    whatsapp: { label: 'WhatsApp', cls: 'bg-green-50 text-green-600 border-green-100', icon: Wifi },
    manual:   { label: 'Manual',   cls: 'bg-gray-100 text-gray-500 border-gray-200',   icon: Users },
    proposta: { label: 'Proposta', cls: 'bg-purple-50 text-purple-600 border-purple-100', icon: FilePlus },
};

const COLUMNS = [
    { key: 'new',       label: 'Nuevos',    dot: 'bg-blue-400',   border: 'border-blue-200',  bg: 'bg-blue-50/40'  },
    { key: 'processed', label: 'Procesados', dot: 'bg-green-500', border: 'border-green-200', bg: 'bg-green-50/40' },
];

const FunnelManager = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
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
            .in('status', ['new', 'processed'])
            .order('created_at', { ascending: false });
        setLeads(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchLeads(); }, [profile]);

    const updateStatus = async (id: string, status: string) => {
        if (!profile) return;
        await supabase
            .from('clients')
            .update({ status })
            .eq('id', id)
            .eq('company_id', profile.company_id);
        fetchLeads();
    };

    const filtered = leads.filter(l =>
        l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.whatsapp?.includes(searchTerm) ||
        l.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const SourceBadge = ({ source }: { source: string }) => {
        const cfg = SOURCE_BADGE[source] || SOURCE_BADGE.manual;
        const Icon = cfg.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${cfg.cls}`}>
                <Icon size={9} />{cfg.label}
            </span>
        );
    };

    return (
        <div>
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Funil de <span className="accent-text">Seguimiento</span></h1>
                    <p className="text-text-muted">Acompanhamento de todos os leads — web, WhatsApp e manual.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input type="text" placeholder="Buscar…" value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-52 text-navy" />
                    </div>
                    <button onClick={fetchLeads}
                        className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {COLUMNS.map(col => {
                    const colLeads = filtered.filter(l => l.status === col.key);
                    return (
                        <div key={col.key} className={`rounded-2xl border-2 ${col.border} ${col.bg} flex flex-col min-h-[400px]`}>
                            {/* Header */}
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
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[640px]">
                                {loading ? (
                                    <div className="space-y-2 animate-pulse">
                                        {[1,2,3].map(i => <div key={i} className="h-24 bg-white/70 rounded-xl" />)}
                                    </div>
                                ) : colLeads.length === 0 ? (
                                    <p className="text-center text-xs text-text-muted py-10 italic">Sin leads aquí</p>
                                ) : colLeads.map(lead => (
                                    <div key={lead.id} className="bg-white rounded-xl p-4 shadow-sm border border-border/40 hover:shadow-md transition-shadow">
                                        {/* Name + source */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-7 h-7 rounded-full bg-accent/20 text-accent font-black text-xs flex items-center justify-center shrink-0">
                                                    {lead.name?.charAt(0) || '?'}
                                                </div>
                                                <p className="font-bold text-navy text-sm truncate">{lead.name || 'Sin nombre'}</p>
                                            </div>
                                            <SourceBadge source={lead.source} />
                                        </div>

                                        {/* Contact */}
                                        {lead.whatsapp && (
                                            <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                                                <Phone size={10} className="shrink-0" />
                                                <span>{lead.whatsapp}</span>
                                            </div>
                                        )}
                                        {lead.location && (
                                            <p className="text-xs text-text-muted mb-1 truncate">{lead.location}</p>
                                        )}

                                        {/* Message preview */}
                                        {lead.message && (
                                            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                                                <div className="flex items-start gap-1">
                                                    <MessageSquare size={9} className="text-text-muted shrink-0 mt-0.5" />
                                                    <p className="text-[10px] text-navy/70 italic leading-relaxed line-clamp-2">{lead.message}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-[10px] text-text-muted">
                                                {new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                            </span>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => {
                                                        const params = new URLSearchParams({ source: 'lead', name: lead.name || '', whatsapp: lead.whatsapp || '', message: lead.message || '' });
                                                        router.push(`/proposal/new?${params.toString()}`);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                                                    title="Crear Presupuesto"
                                                >
                                                    <FilePlus size={13} />
                                                </button>
                                                {col.key === 'new' && (
                                                    <button
                                                        onClick={() => updateStatus(lead.id, 'processed')}
                                                        className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all"
                                                        title="Marcar Procesado"
                                                    >
                                                        <CheckCircle size={13} />
                                                    </button>
                                                )}
                                                {col.key === 'processed' && (
                                                    <button
                                                        onClick={() => updateStatus(lead.id, 'new')}
                                                        className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-300 transition-all text-[9px] font-bold px-2"
                                                        title="Volver a Nuevo"
                                                    >
                                                        ↩
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FunnelManager;
