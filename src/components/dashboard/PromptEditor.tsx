'use client'

import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Trash2, Zap, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_PROMPT = `Você é um Assistente especializado em Janelas e Varandas de Alumínio...`;

const PromptEditor = () => {
    const supabase = createClient();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);

    useEffect(() => {
        fetchPrompt();
    }, []);

    const fetchPrompt = async () => {
        setLoading(true);
        const { data } = await supabase.from('app_config').select('value').eq('key', 'system_prompt').single();
        if (data) setPrompt(data.value);
        else setPrompt(DEFAULT_PROMPT);
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase.from('app_config').upsert({ key: 'system_prompt', value: prompt });
        if (error) alert('Erro ao salvar: ' + error.message);
        else alert('Prompt do Cérebro IA atualizado!');
        setSaving(false);
    };

    const handleCleanup = async () => {
        if (!confirm('ATENÇÃO: Limpar todos os Leads, Conversas e Agendamentos?')) return;
        setCleaning(true);
        try {
            await Promise.all([
                supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            ]);
            alert('Limpeza concluída!');
        } catch (e: any) { alert('Erro: ' + e.message); }
        setCleaning(false);
    };

    return (
        <div className="prompt-editor">
            <header className="mb-10">
                <h1 className="text-3xl font-bold mb-2">Cérebro <span className="accent-text">IA</span></h1>
                <p className="text-text-muted">Configure o comportamento e a inteligência do seu assistente.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="glass-card p-0 overflow-hidden bg-white border-none shadow-xl">
                        <div className="bg-navy p-5 flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                <Zap className="text-accent" size={20} />
                                <h2 className="font-bold tracking-wide">System Prompt</h2>
                            </div>
                            <span className="text-[10px] bg-white/10 px-2 py-1 rounded font-bold uppercase tracking-widest text-accent">Modo Especialista</span>
                        </div>
                        <div className="p-8">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full h-[500px] p-6 bg-bg-dark border border-border rounded-xl text-navy font-mono text-sm leading-relaxed focus:ring-2 focus:ring-accent/30 outline-none resize-none"
                                disabled={loading}
                                placeholder="Defina aqui como a IA deve se comportar..."
                            />
                            <div className="mt-8 flex gap-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-4 bg-accent text-navy font-extrabold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
                                >
                                    <Save size={20} />
                                    {saving ? 'Guardando...' : 'Guardar Alterações'}
                                </button>
                                <button
                                    onClick={() => setPrompt(DEFAULT_PROMPT)}
                                    className="px-6 py-4 bg-white border border-border text-navy font-bold rounded-xl hover:bg-gray-50 flex items-center gap-3"
                                >
                                    <RotateCcw size={20} />
                                    Resetar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass-card p-8 bg-white/80 border-none shadow-sm h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="text-red-500" size={20} />
                            <h2 className="font-bold text-navy uppercase tracking-widest text-sm">Zona de Risco</h2>
                        </div>
                        <p className="text-xs text-text-muted mb-6 leading-relaxed">
                            Use esta ferramenta para limpar todos os dados de exemplo (Leads, Agendamentos e Conversas) antes de entrar em produção.
                        </p>
                        <button
                            onClick={handleCleanup}
                            disabled={cleaning}
                            className="w-full py-4 bg-red-50 text-red-600 border border-red-100 font-extrabold rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-3"
                        >
                            <Trash2 size={20} />
                            {cleaning ? 'Limpando...' : 'Limpar Tudo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptEditor;
