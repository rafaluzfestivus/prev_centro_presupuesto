'use client'

import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Trash2, Zap, Shield, CheckCircle, AlertCircle, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SYSTEM_PROMPT } from '@/services/ai/prompt';

const DEFAULT_PROMPT = SYSTEM_PROMPT;

const PromptEditor = () => {
    const supabase = createClient();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [saveMessage, setSaveMessage] = useState('');
    const [cleanupStatus, setCleanupStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [cleanupMessage, setCleanupMessage] = useState('');
    const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

    useEffect(() => {
        fetchPrompt();
    }, []);

    const fetchPrompt = async () => {
        setLoading(true);
        const { data } = await supabase.from('config').select('value').eq('key', 'system_prompt').single();
        if (data) setPrompt(data.value);
        else setPrompt(DEFAULT_PROMPT);
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveStatus('idle');
        const { error } = await supabase.from('config').upsert({ key: 'system_prompt', value: prompt }, { onConflict: 'key' });
        if (error) {
            setSaveStatus('error');
            setSaveMessage('Error al guardar: ' + error.message);
        } else {
            setSaveStatus('success');
            setSaveMessage('¡Cerebro IA actualizado correctamente!');
            setTimeout(() => setSaveStatus('idle'), 4000);
        }
        setSaving(false);
    };

    const handleCleanupClick = () => {
        setShowCleanupConfirm(true);
        setCleanupStatus('idle');
    };

    const handleCleanupConfirm = async () => {
        setShowCleanupConfirm(false);
        setCleaning(true);
        setCleanupStatus('idle');
        try {
            await Promise.all([
                supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            ]);
            setCleanupStatus('success');
            setCleanupMessage('¡Limpieza concluida!');
            setTimeout(() => setCleanupStatus('idle'), 4000);
        } catch (e: any) {
            setCleanupStatus('error');
            setCleanupMessage('Error: ' + e.message);
        }
        setCleaning(false);
    };

    return (
        <div className="prompt-editor">
            <header className="mb-10">
                <h1 className="text-3xl font-bold mb-2">Cerebro <span className="accent-text">IA</span></h1>
                <p className="text-text-muted">Configura el comportamiento y la inteligencia de tu asistente.</p>
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
                                placeholder="Define aquí cómo debe comportarse la IA..."
                            />

                            {saveStatus === 'success' && (
                                <div className="mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                                    <CheckCircle size={16} className="shrink-0" />
                                    <span>{saveMessage}</span>
                                </div>
                            )}
                            {saveStatus === 'error' && (
                                <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <span>{saveMessage}</span>
                                    <button onClick={() => setSaveStatus('idle')} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
                                </div>
                            )}

                            <div className="mt-8 flex gap-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-4 bg-accent text-navy font-extrabold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50"
                                >
                                    <Save size={20} />
                                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                                <button
                                    onClick={() => setPrompt(DEFAULT_PROMPT)}
                                    className="px-6 py-4 bg-white border border-border text-navy font-bold rounded-xl hover:bg-gray-50 flex items-center gap-3"
                                >
                                    <RotateCcw size={20} />
                                    Reiniciar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass-card p-8 bg-white/80 border-none shadow-sm h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="text-red-500" size={20} />
                            <h2 className="font-bold text-navy uppercase tracking-widest text-sm">Zona de Riesgo</h2>
                        </div>
                        <p className="text-xs text-text-muted mb-6 leading-relaxed">
                            Usa esta herramienta para limpiar todos los datos de ejemplo (Leads, Citas y Conversaciones) antes de entrar en producción.
                        </p>

                        {cleanupStatus === 'success' && (
                            <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                                <CheckCircle size={16} className="shrink-0" />
                                <span>{cleanupMessage}</span>
                            </div>
                        )}
                        {cleanupStatus === 'error' && (
                            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{cleanupMessage}</span>
                                <button onClick={() => setCleanupStatus('idle')} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
                            </div>
                        )}

                        {showCleanupConfirm ? (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                                <p className="text-xs text-red-700 font-bold text-center">ATENCIÓN: ¿Limpiar todos los Leads, Conversaciones y Citas?</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowCleanupConfirm(false)}
                                        className="flex-1 py-2 bg-white border border-border text-navy font-bold rounded-lg text-sm"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCleanupConfirm}
                                        disabled={cleaning}
                                        className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        <Trash2 size={14} /> Confirmar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handleCleanupClick}
                                disabled={cleaning}
                                className="w-full py-4 bg-red-50 text-red-600 border border-red-100 font-extrabold rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <Trash2 size={20} />
                                {cleaning ? 'Limpiando...' : 'Limpiar Todo'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptEditor;
