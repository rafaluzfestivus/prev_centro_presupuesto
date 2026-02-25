'use client'

import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Trash2, FileText, Globe, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const KnowledgeManager = () => {
    const supabase = createClient();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDocs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('knowledge_base')
            .select('*')
            .order('created_at', { ascending: false });

        setDocuments(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchDocs();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;
        const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchDocs();
    };

    const filteredDocs = documents.filter(doc =>
        doc.content?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="knowledge-manager">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Base de <span className="accent-text">Conhecimento</span></h1>
                    <p className="text-text-muted">Gerencie os documentos que alimentam a inteligência da IA.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar nos documentos..."
                            className="pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-64 text-navy"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={fetchDocs} className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="glass-card overflow-hidden border-none shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b-2 border-border text-navy">
                            <th className="p-5 text-sm font-bold uppercase tracking-wider">Documento</th>
                            <th className="p-5 text-sm font-bold uppercase tracking-wider">Tipo</th>
                            <th className="p-5 text-sm font-bold uppercase tracking-wider">Data de Upload</th>
                            <th className="p-5 text-sm font-bold uppercase tracking-wider text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/50">
                        {loading ? (
                            <tr><td colSpan={4} className="p-10 text-center text-text-muted">Carregando conhecimento...</td></tr>
                        ) : filteredDocs.length > 0 ? (
                            filteredDocs.map((doc) => (
                                <tr key={doc.id} className="border-b border-border hover:bg-white/80 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-navy/5 rounded-lg text-navy">
                                                <FileText size={20} />
                                            </div>
                                            <div className="max-w-md">
                                                <p className="font-bold text-navy truncate" title={doc.content}>{doc.content.substring(0, 80)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-navy py-1 px-2 bg-bg-dark rounded-md w-fit">
                                            <Globe size={14} className="text-accent" />
                                            Site / FAQ
                                        </div>
                                    </td>
                                    <td className="p-5 text-sm text-text-muted font-medium">
                                        {new Date(doc.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-5 text-right">
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                                            title="Excluir documento"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4} className="p-10 text-center text-text-muted">Nenhum documento encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default KnowledgeManager;
