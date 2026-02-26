'use client'

import React, { useEffect, useState } from 'react';
import { Users, Search, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const LeadsManager = () => {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClient();

    const fetchLeads = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('source', 'site')
            .order('created_at', { ascending: false });

        setLeads(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const updateStatus = async (id: string, status: string) => {
        const { error } = await supabase
            .from('clients')
            .update({ status })
            .eq('id', id);

        if (error) alert('Error al actualizar el estado: ' + error.message);
        else fetchLeads();
    };

    const filteredLeads = leads.filter(lead =>
    (lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.whatsapp?.includes(searchTerm))
    );

    return (
        <div className="leads-manager">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Leads del <span className="accent-text">Sitio</span></h1>
                    <p className="text-text-muted">Gestión de contactos captados vía formulario web.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o WhatsApp..."
                            className="pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-64 text-navy"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Localización</th>
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider">Estado</th>
                            <th className="p-5 text-sm font-bold text-navy uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/50">
                        {loading ? (
                            <tr><td colSpan={5} className="p-10 text-center text-text-muted">Sincronizando con Supabase...</td></tr>
                        ) : filteredLeads.length > 0 ? (
                            filteredLeads.map((lead) => (
                                <tr key={lead.id} className="border-b border-border hover:bg-white/80 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                                                {lead.name?.charAt(0) || 'L'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-navy">{lead.name}</p>
                                                <p className="text-xs text-text-muted">{new Date(lead.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <p className="text-sm font-semibold text-navy">{lead.whatsapp}</p>
                                        <p className="text-xs text-text-muted">{lead.email || 'Sin e-mail'}</p>
                                    </td>
                                    <td className="p-5 text-sm text-text-main font-medium">
                                        {lead.location || 'No informado'}
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${lead.status === 'processed' ? 'bg-green-100 text-green-700' :
                                            lead.status === 'handover' ? 'bg-accent/20 text-accent' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {lead.status === 'processed' ? 'Procesado' : lead.status === 'handover' ? 'Traspaso' : 'Nuevo'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => updateStatus(lead.id, 'handover')}
                                                className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-navy transition-all"
                                                title="Mover a Traspaso"
                                            >
                                                <AlertCircle size={18} />
                                            </button>
                                            <button
                                                onClick={() => updateStatus(lead.id, 'processed')}
                                                className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-600 hover:text-white transition-all"
                                                title="Marcar como Concluido"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="p-10 text-center text-text-muted">No se han encontrado leads.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LeadsManager;
