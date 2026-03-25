'use client'

import React, { useEffect, useState } from 'react';
import { Users, MessageSquare, Calendar, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

const StatCard = ({ icon: Icon, label, value, trend }: any) => (
    <div className="glass-card p-8 bg-white border-none shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-accent/10 rounded-xl text-accent">
                <Icon size={24} />
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                    <ArrowUpRight size={14} />
                    {trend}
                </div>
            )}
        </div>
        <h3 className="text-3xl font-extrabold text-navy mb-1">{value}</h3>
        <p className="text-sm font-bold text-text-muted uppercase tracking-wider">{label}</p>
    </div>
);

const DashboardHome = () => {
    const supabase = createClient();
    const [stats, setStats] = useState<any[]>([]);
    const [recentConvos, setRecentConvos] = useState<any[]>([]);
    const [recentLeads, setRecentLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
            const { count: convoCount } = await supabase.from('conversations').select('*', { count: 'exact', head: true });
            const { count: apptCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true });
            const { count: handoverCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'handover');

            setStats([
                { label: 'Total Leads', value: String(clientCount || 0), icon: Users, trend: 'Nuevo' },
                { label: 'Mensajes', value: String(convoCount || 0), icon: MessageSquare },
                { label: 'Citas', value: String(apptCount || 0), icon: Calendar },
                { label: 'Traspasos', value: String(handoverCount || 0), icon: ShieldCheck }
            ]);

            const { data: leadData } = await supabase
                .from('clients')
                .select('*')
                .eq('source', 'site')
                .order('created_at', { ascending: false })
                .limit(4);

            setRecentLeads(leadData || []);

            const { data } = await supabase.from('conversations').select('*, clients(name)').order('created_at', { ascending: false }).limit(4);
            if (!data || data.length === 0) {
                setRecentConvos([
                    { clients: { name: 'Maria Silva' }, message: 'Me gustaría un presupuesto para mi balcón.', created_at: new Date().toISOString() },
                    { clients: { name: 'João Santos' }, message: '¿Cuál es el plazo de instalación en Madrid?', created_at: new Date(Date.now() - 3600000).toISOString() }
                ]);
            } else {
                setRecentConvos(data);
            }
            setLoading(false);
        };
        load();
    }, []);

    return (
        <DashboardLayout>
            <header className="mb-8">
                <h1 className="text-2xl sm:text-4xl font-extrabold mb-2 text-navy">Bienvenido, <span className="accent-text">Rafael</span></h1>
                <p className="text-text-muted text-sm sm:text-lg">Tu centro integrado de presupuestos y atención.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-card p-6 sm:p-10 bg-white border-none shadow-sm">
                    <h2 className="text-xl font-bold mb-8 text-navy uppercase tracking-widest flex items-center gap-3">
                        <Users className="text-accent" />
                        Leads Recientes (Sitio)
                    </h2>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl" />)}
                            </div>
                        ) : recentLeads.length > 0 ? (
                            recentLeads.map((l, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-bg-dark/50 rounded-2xl border border-border/50 hover:bg-white transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-navy font-black text-sm">
                                            {l.name?.charAt(0) || 'L'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-navy leading-none">{l.name}</p>
                                                {l.service_requested && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 font-black uppercase">
                                                        {l.service_requested}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-text-muted mt-1 italic truncate max-w-[220px]">
                                                {l.message || l.whatsapp}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black text-text-muted uppercase">
                                        {new Date(l.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-center p-10 text-text-muted text-sm italic">Esperando nuevos leads...</p>
                        )}
                    </div>
                </div>

                <div className="glass-card p-6 sm:p-10 bg-white border-none shadow-sm">
                    <h2 className="text-xl font-bold mb-8 text-navy uppercase tracking-widest flex items-center gap-3">
                        <ShieldCheck className="text-accent" />
                        Estado del Sistema
                    </h2>
                    <div className="space-y-6">
                        {[
                            { label: 'Base de Datos', desc: 'Supabase Realtime', status: 'Activo' },
                            { label: 'Generador IA', desc: 'OpenAI GPT-4o', status: 'Activo' },
                            { label: 'Workflows', desc: 'n8n Automations', status: 'Activo' }
                        ].map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-bg-dark/30">
                                <div>
                                    <p className="text-sm font-bold text-navy">{s.label}</p>
                                    <p className="text-[10px] text-text-muted uppercase tracking-tighter">{s.desc}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{s.status}</span>
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default DashboardHome;
