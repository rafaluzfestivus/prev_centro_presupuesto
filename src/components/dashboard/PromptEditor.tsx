'use client'

import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Trash2, Zap, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_PROMPT = `Eres el Consultor Técnico de Preventiva Centro en Madrid, especialista en redes de proteção. Tu objetivo es transformar medidas brutas en un presupuesto técnico impecable.

# Reglas de Inteligencia Espacial (Visión 3D)
1. **Identificación**: Si el cliente envía "2,5 x 1,2", asume que la medida mayor es el ANCHO (Width).
2. **Guarda-Cuerpo**: Calcula la altura de la red descontando o sumando el guarda-cuerpo según sea necessario.

# Estructura de Respuesta (JSON)
{
  "items": [{ "name": "...", "width": 0.0, "height": 0.0, "area": 0.0, "price": 0.0 }],
  "ascii_mockup": "...",
  "pricing_logic": "...",
  "total": 0.0
}`;

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
        const { data } = await supabase.from('config').select('value').eq('key', 'system_prompt').single();
        if (data) setPrompt(data.value);
        else setPrompt(DEFAULT_PROMPT);
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase.from('config').upsert({ key: 'system_prompt', value: prompt });
        if (error) alert('Error al guardar: ' + error.message);
        else alert('¡Cerebro IA actualizado!');
        setSaving(false);
    };

    const handleCleanup = async () => {
        if (!confirm('ATENCIÓN: ¿Limpiar todos los Leads, Conversaciones y Citas?')) return;
        setCleaning(true);
        try {
            await Promise.all([
                supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            ]);
            alert('¡Limpieza concluida!');
        } catch (e: any) { alert('Error: ' + e.message); }
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
                            <div className="mt-8 flex gap-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-4 bg-accent text-navy font-extrabold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
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
                        <button
                            onClick={handleCleanup}
                            disabled={cleaning}
                            className="w-full py-4 bg-red-50 text-red-600 border border-red-100 font-extrabold rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-3"
                        >
                            <Trash2 size={20} />
                            {cleaning ? 'Limpiando...' : 'Limpiar Todo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptEditor;
