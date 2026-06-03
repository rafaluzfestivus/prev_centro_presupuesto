'use client'

import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, FilePlus, Phone, Globe, Wifi, Users, Euro, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/useProfile';

type Lead = {
    id: string;
    name: string;
    whatsapp: string;
    location?: string;
    message?: string;
    source: string;
    status: string;
    created_at: string;
    // enriched
    proposal?: { id: string; total_geral: number; status: string };
    sale?: { appointmentId: string; date_start: string; total_value: number };
};

const SOURCE_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
    site:     { label: 'Web',      cls: 'bg-blue-50 text-blue-600 border-blue-100',      icon: Globe },
    whatsapp: { label: 'WhatsApp', cls: 'bg-green-50 text-green-600 border-green-100',   icon: Wifi },
    manual:   { label: 'Manual',   cls: 'bg-gray-100 text-gray-500 border-gray-200',     icon: Users },
    proposta: { label: 'Proposta', cls: 'bg-purple-50 text-purple-600 border-purple-100', icon: FilePlus },
};

const COLUMNS = [
    { key: 'novos',     label: 'Novos',     dot: 'bg-blue-400',   border: 'border-blue-200',   bg: 'bg-blue-50/30'   },
    { key: 'propostas', label: 'Propostas', dot: 'bg-amber-400',  border: 'border-amber-200',  bg: 'bg-amber-50/30'  },
    { key: 'vendas',    label: 'Vendas',    dot: 'bg-green-500',  border: 'border-green-200',  bg: 'bg-green-50/30'  },
];

const FunnelManager = () => {
    const [novos, setNovos]         = useState<Lead[]>([]);
    const [propostas, setPropostas] = useState<Lead[]>([]);
    const [vendas, setVendas]       = useState<Lead[]>([]);
    const [loading, setLoading]     = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClient();
    const router   = useRouter();
    const { profile } = useProfile();

    const load = async () => {
        if (!profile) return;
        setLoading(true);
        const cid = profile.company_id;

        // 1. All clients for this company
        const { data: clients } = await supabase
            .from('clients')
            .select('id, name, whatsapp, location, message, source, status, created_at')
            .eq('company_id', cid)
            .order('created_at', { ascending: false });

        if (!clients?.length) { setNovos([]); setPropostas([]); setVendas([]); setLoading(false); return; }

        // 2. Appointments from closed sales (to identify Vendas)
        const { data: saleApts } = await supabase
            .from('appointments')
            .select('client_id, date_start, total_value')
            .eq('company_id', cid)
            .like('notes', '%Venta cerrada desde presupuesto%');

        const saleByClientId = new Map<string, { appointmentId: string; date_start: string; total_value: number }>();
        for (const apt of saleApts || []) {
            if (!saleByClientId.has(apt.client_id)) {
                saleByClientId.set(apt.client_id, { appointmentId: apt.client_id, date_start: apt.date_start, total_value: apt.total_value });
            }
        }

        // 3. Proposals (to identify Propostas) — match by normalized whatsapp
        const { data: proposals } = await supabase
            .from('Proposta')
            .select('id, whatsapp, total_geral, status')
            .eq('company_id', cid)
            .order('data_criacao', { ascending: false });

        // Map: normalized whatsapp → best proposal (most recent = first)
        const proposalByPhone = new Map<string, { id: string; total_geral: number; status: string }>();
        for (const p of proposals || []) {
            const phone = (p.whatsapp || '').replace(/\D/g, '');
            if (phone && !proposalByPhone.has(phone)) {
                proposalByPhone.set(phone, { id: p.id, total_geral: Number(p.total_geral) || 0, status: p.status });
            }
        }

        // Categorize
        const _novos: Lead[]     = [];
        const _propostas: Lead[] = [];
        const _vendas: Lead[]    = [];

        for (const c of clients) {
            const phone    = (c.whatsapp || '').replace(/\D/g, '');
            const saleData = saleByClientId.get(c.id);
            const propData = proposalByPhone.get(phone);

            const lead: Lead = { ...c };

            if (saleData) {
                lead.sale = saleData;
                if (propData) lead.proposal = propData;
                _vendas.push(lead);
            } else if (propData) {
                lead.proposal = propData;
                _propostas.push(lead);
            } else {
                _novos.push(lead);
            }
        }

        setNovos(_novos);
        setPropostas(_propostas);
        setVendas(_vendas);
        setLoading(false);
    };

    useEffect(() => { load(); }, [profile]);

    const filter = (list: Lead[]) => {
        if (!searchTerm.trim()) return list;
        const q = searchTerm.toLowerCase();
        return list.filter(l =>
            l.name?.toLowerCase().includes(q) ||
            l.whatsapp?.includes(q) ||
            l.location?.toLowerCase().includes(q)
        );
    };

    const SourceBadge = ({ source }: { source: string }) => {
        const cfg = SOURCE_BADGE[source] || SOURCE_BADGE.manual;
        const Icon = cfg.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${cfg.cls}`}>
                <Icon size={9} />{cfg.label}
            </span>
        );
    };

    const columnData: Record<string, Lead[]> = {
        novos:     filter(novos),
        propostas: filter(propostas),
        vendas:    filter(vendas),
    };

    const renderCard = (lead: Lead, col: string) => (
        <div key={lead.id} className="bg-white rounded-xl p-4 shadow-sm border border-border/40 hover:shadow-md transition-shadow">
            {/* Header */}
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
                    <Phone size={10} className="shrink-0" /><span>{lead.whatsapp}</span>
                </div>
            )}
            {lead.location && <p className="text-xs text-text-muted truncate mb-1">{lead.location}</p>}

            {/* Proposal info */}
            {lead.proposal && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                    <FileText size={11} className="text-amber-500 shrink-0" />
                    <span className="text-[10px] font-bold text-amber-700">
                        {lead.proposal.status} · € {lead.proposal.total_geral.toFixed(2)}
                    </span>
                </div>
            )}

            {/* Sale info */}
            {lead.sale && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                    <span className="text-[10px] font-bold text-green-700">
                        {lead.sale.date_start ? new Date(lead.sale.date_start).toLocaleDateString('es-ES') : '—'}
                        {lead.sale.total_value ? ` · € ${Number(lead.sale.total_value).toFixed(2)}` : ''}
                    </span>
                </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-text-muted">
                    {new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
                <div className="flex gap-1.5">
                    {col === 'novos' && (
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
                    )}
                    {col === 'propostas' && lead.proposal && (
                        <button
                            onClick={() => router.push(`/proposal/${lead.proposal!.id}/review`)}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all"
                            title="Ver Presupuesto"
                        >
                            <FileText size={13} />
                        </button>
                    )}
                    {col === 'vendas' && lead.sale && (
                        <button
                            onClick={() => router.push(`/dashboard/citas/${lead.sale!.appointmentId}/report`)}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all"
                            title="Ver Ficha de Instalación"
                        >
                            <Calendar size={13} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const totalAll = novos.length + propostas.length + vendas.length;

    return (
        <div>
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Funil de <span className="accent-text">Seguimento</span></h1>
                    <p className="text-text-muted">{totalAll} contactos · progresso real baseado em propostas e vendas fechadas.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input type="text" placeholder="Buscar…" value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-52 text-navy" />
                    </div>
                    <button onClick={load}
                        className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {/* Conversion bar */}
            {!loading && totalAll > 0 && (
                <div className="mb-6 bg-white border border-border rounded-2xl p-4 flex items-center gap-4">
                    <div className="flex-1 flex gap-1 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-300 transition-all" style={{ width: `${(novos.length / totalAll) * 100}%` }} />
                        <div className="bg-amber-300 transition-all" style={{ width: `${(propostas.length / totalAll) * 100}%` }} />
                        <div className="bg-green-400 transition-all" style={{ width: `${(vendas.length / totalAll) * 100}%` }} />
                    </div>
                    <div className="flex gap-4 text-[10px] font-black uppercase tracking-wide shrink-0">
                        <span className="text-blue-500">{novos.length} novos</span>
                        <span className="text-amber-500">{propostas.length} propostas</span>
                        <span className="text-green-600">{vendas.length} vendas</span>
                        {totalAll > 0 && (
                            <span className="text-text-muted">
                                conv. {Math.round((vendas.length / totalAll) * 100)}%
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {COLUMNS.map(col => {
                    const list = columnData[col.key] || [];
                    return (
                        <div key={col.key} className={`rounded-2xl border-2 ${col.border} ${col.bg} flex flex-col min-h-[400px]`}>
                            <div className="px-5 py-4 flex items-center justify-between border-b border-black/5">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                    <span className="font-black text-navy uppercase tracking-widest text-xs">{col.label}</span>
                                </div>
                                <span className="bg-white text-navy font-black text-xs px-2 py-0.5 rounded-full border border-black/10">
                                    {list.length}
                                </span>
                            </div>
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[640px]">
                                {loading ? (
                                    <div className="space-y-2 animate-pulse">
                                        {[1,2,3].map(i => <div key={i} className="h-24 bg-white/70 rounded-xl" />)}
                                    </div>
                                ) : list.length === 0 ? (
                                    <p className="text-center text-xs text-text-muted py-10 italic">Sem contactos aqui</p>
                                ) : list.map(lead => renderCard(lead, col.key))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FunnelManager;
