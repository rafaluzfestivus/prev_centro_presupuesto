'use client'

import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Trash2, FileText, Globe, RefreshCw, Plus, X, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const KnowledgeManager = () => {
    const supabase = createClient();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newDocContent, setNewDocContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

    const handleDeleteClick = (id: string) => {
        setPendingDeleteId(id);
        setError('');
    };

    const handleDeleteConfirm = async () => {
        if (!pendingDeleteId) return;
        const { error: deleteError } = await supabase.from('knowledge_base').delete().eq('id', pendingDeleteId);
        if (deleteError) {
            setError('Error al eliminar: ' + deleteError.message);
        } else {
            fetchDocs();
        }
        setPendingDeleteId(null);
    };

    const handleAddDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDocContent.trim()) return;
        setModalError('');

        setSaving(true);
        const { error: insertError } = await supabase.from('knowledge_base').insert({
            content: newDocContent,
            metadata: { source: 'manual', category: 'General' }
        });

        if (insertError) {
            setModalError('Error al guardar el documento: ' + insertError.message);
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
                    <h1 className="text-3xl font-bold mb-2">Base de <span className="accent-text">Conocimiento</span></h1>
                    <p className="text-text-muted">Gestiona los documentos que alimentan la inteligencia de la IA.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => { setIsModalOpen(true); setModalError(''); }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-accent text-navy font-bold rounded-xl hover:shadow-lg transition-all"
                    >
                        <Plus size={20} />
                        Añadir
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar en los documentos..."
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

            {error && (
                <div className="mb-6 flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
            )}

            {pendingDeleteId && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700 font-bold mb-3">¿Estás seguro de que deseas eliminar este documento?</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setPendingDeleteId(null)}
                            className="flex-1 py-2 bg-white border border-border text-navy font-bold rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleDeleteConfirm}
                            className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} /> Eliminar
                        </button>
                    </div>
                </div>
            )}

            <div className="glass-card overflow-hidden border-none shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b-2 border-border text-navy">
                            <th className="p-5 text-sm font-bold uppercase tracking-wider">Documento</th>
                            <th className="p-5 text-sm font-bold uppercase tracking-wider">Tipo</th>
                            <th className="p-5 text-sm font-bold uppercase tracking-wider">Fecha de Carga</th>
                            <th className="p-5 text-sm font-bold uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/50">
                        {loading ? (
                            <tr><td colSpan={4} className="p-10 text-center text-text-muted">Cargando conocimiento...</td></tr>
                        ) : filteredDocs.length > 0 ? (
                            filteredDocs.map((doc) => (
                                <tr key={doc.id} className={`border-b border-border hover:bg-white/80 transition-colors ${pendingDeleteId === doc.id ? 'bg-red-50/50' : ''}`}>
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
                                            onClick={() => handleDeleteClick(doc.id)}
                                            className={`p-2.5 rounded-xl transition-all ${pendingDeleteId === doc.id ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                                            title="Eliminar documento"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4} className="p-10 text-center text-text-muted">No se han encontrado documentos.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-card w-full max-w-2xl p-10 bg-white border-none shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-navy">Nuevo Conocimiento</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-navy transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {modalError && (
                            <div className="mb-5 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{modalError}</span>
                                <button onClick={() => setModalError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
                            </div>
                        )}

                        <form onSubmit={handleAddDoc} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-navy mb-2">Contenido del Documento</label>
                                <textarea
                                    required
                                    value={newDocContent}
                                    onChange={e => setNewDocContent(e.target.value)}
                                    placeholder="Pega aquí información sobre redes, precios, horarios o reglas de negocio..."
                                    className="w-full min-h-[300px] p-6 bg-bg-dark border border-border rounded-xl text-navy focus:ring-2 focus:ring-accent/50 outline-none resize-none text-sm leading-relaxed"
                                />
                                <p className="mt-2 text-xs text-text-muted font-medium">La IA usará este texto para responder preguntas de los clientes.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-4 bg-accent text-navy font-extrabold rounded-xl hover:shadow-xl transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2"
                            >
                                {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                {saving ? 'Guardando...' : 'Guardar Documento'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeManager;
