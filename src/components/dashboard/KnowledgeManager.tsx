'use client'

import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Trash2, FileText, Globe, RefreshCw, Plus, X, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const KnowledgeManager = () => {
    const supabase = createClient();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newDocContent, setNewDocContent] = useState('');
    const [saving, setSaving] = useState(false);

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

    const handleAddDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDocContent.trim()) return;

        setSaving(true);
        const { error } = await supabase.from('knowledge_base').insert({
            content: newDocContent,
            metadata: { source: 'manual', category: 'General' }
        });

        if (error) {
            alert('Erro ao salvar documento: ' + error.message);
        } else {
            setNewDocContent('');
            setIsModalOpen(false);
            fetchDocs();
        }
        setSaving(false);
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
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-accent text-navy font-bold rounded-xl hover:shadow-lg transition-all"
                    >
                        <Plus size={20} />
                        Adicionar
                    </button>
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

            {isModalOpen && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-card w-full max-w-2xl p-10 bg-white border-none shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-navy">Novo Conhecimento</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-navy transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddDoc} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-navy mb-2">Conteúdo do Documento</label>
                                <textarea
                                    required
                                    value={newDocContent}
                                    onChange={e => setNewDocContent(e.target.value)}
                                    placeholder="Cole aqui informações sobre redes, preços, horários ou regras de negócio..."
                                    className="w-full min-h-[300px] p-6 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none resize-none text-sm leading-relaxed"
                                />
                                <p className="mt-2 text-xs text-text-muted font-medium">A IA usará este texto para responder perguntas dos clientes.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-4 bg-accent text-navy font-extrabold rounded-xl hover:shadow-xl transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2"
                            >
                                {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                {saving ? 'Salvando...' : 'Salvar Documento'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeManager;
