'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProposalAction, getProposalsAction, deleteProposalAction } from '@/actions/proposal'
import { Proposal } from '@/lib/types'
import { Loader2, Upload, X, Trash2, FileText, Plus, RefreshCw, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function ProposalsPage() {
    const router = useRouter()
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [clientName, setClientName] = useState('')
    const [city, setCity] = useState('')
    const [measurements, setMeasurements] = useState('')
    const [observations, setObservations] = useState('')
    const [whatsapp, setWhatsapp] = useState('')
    const [loading, setLoading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadProposals()
        const handleWindowPaste = (e: ClipboardEvent) => {
            if (e.clipboardData && e.clipboardData.items) {
                const items = e.clipboardData.items
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile()
                        if (file) { setSelectedFile(file); break; }
                    }
                }
            }
        }
        window.addEventListener('paste', handleWindowPaste)
        return () => window.removeEventListener('paste', handleWindowPaste)
    }, [])

    const loadProposals = async () => {
        setLoadingHistory(true)
        const result = await getProposalsAction()
        if (result.success && result.data) setProposals(result.data)
        setLoadingHistory(false)
    }

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            let imageUrl = ''
            if (selectedFile) {
                setUploading(true)
                const supabase = createClient()
                const fileExt = selectedFile.name.split('.').pop()
                const fileName = `input_${Date.now()}.${fileExt}`
                const { error: uploadError } = await supabase.storage.from('proposals').upload(fileName, selectedFile)
                if (uploadError) throw uploadError
                const { data: { publicUrl } } = supabase.storage.from('proposals').getPublicUrl(fileName)
                imageUrl = publicUrl
                setUploading(false)
            }
            if (!measurements && !imageUrl) { alert('Por favor, ingresa las medidas o sube una imagen.'); setLoading(false); return; }
            const result = await createProposalAction({ clientName, city, measurements, observations, imageUrl, whatsapp })
            if (result.success && result.id) router.push(`/proposal/${result.id}/preview`)
            else alert('Error al crear presupuesto: ' + (result.error || 'Error desconocido'))
        } catch (error) { console.error(error); alert('Error al crear presupuesto') } finally { setLoading(false); setUploading(false) }
    }

    const clearFile = () => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }

    const handleScheduleVisit = (e: React.MouseEvent, p: Proposal) => {
        e.stopPropagation()
        // Format proposal data for the agenda
        const clientName = p.cliente_nome || 'Cliente de Proposta'
        // We might not have the whatsapp directly in p, but we can try to find it or just go to agenda
        router.push(`/dashboard/citas?client=${encodeURIComponent(clientName)}`)
    }

    const handleDeleteProposal = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm('¿Estás seguro de que quieres eliminar este presupuesto?')) {
            const result = await deleteProposalAction(id)
            if (result.success) loadProposals()
            else alert('Error al eliminar presupuesto')
        }
    }

    return (
        <DashboardLayout>
            <header className="mb-10">
                <h1 className="text-3xl font-bold mb-2">Generador de <span className="accent-text">Presupuestos</span></h1>
                <p className="text-text-muted">Crea presupuestos profesionales en segundos con ayuda de IA.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* New Proposal Form */}
                <div className="glass-card p-10 bg-white border-none shadow-sm h-fit">
                    <h2 className="text-xl font-bold text-navy mb-8 uppercase tracking-widest flex items-center gap-3">
                        <Plus className="text-accent" />
                        Nuevo Presupuesto
                    </h2>
                    <form className="space-y-6" onSubmit={handleGenerate}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="font-bold text-navy uppercase text-[10px] tracking-widest">Cliente</Label>
                                <Input required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ej: Ana Garcia" className="p-4 bg-bg-dark border-none rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-navy uppercase text-[10px] tracking-widest">Ciudad</Label>
                                <Input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej: Madrid" className="p-4 bg-bg-dark border-none rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-navy uppercase text-[10px] tracking-widest">WhatsApp</Label>
                                <Input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Ej: 34600000000" className="p-4 bg-bg-dark border-none rounded-xl" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold text-navy uppercase text-[10px] tracking-widest">Medidas y Detalles</Label>
                            <textarea
                                required={!selectedFile}
                                className="w-full min-h-[150px] p-6 bg-bg-dark border-none rounded-xl text-sm focus:ring-2 focus:ring-accent/30 outline-none resize-none"
                                placeholder="Describe las medidas o pega el texto de WhatsApp..."
                                value={measurements}
                                onChange={(e) => setMeasurements(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold text-navy uppercase text-[10px] tracking-widest">Imagen / Croquis</Label>
                            {!selectedFile ? (
                                <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-bg-dark transition-colors" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="h-8 w-8 text-accent mb-3" />
                                    <span className="text-sm font-bold text-navy">Subir Imagen</span>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />
                                </div>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden border border-border group">
                                    <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-48 object-cover" />
                                    <button onClick={clearFile} className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg text-red-500"><X size={16} /></button>
                                </div>
                            )}
                        </div>

                        <Button type="submit" className="w-full py-4 bg-accent text-navy font-black rounded-xl hover:shadow-xl transition-all h-auto text-lg" disabled={loading}>
                            {loading && <Loader2 className="mr-3 h-5 w-5 animate-spin" />}
                            {loading ? 'Procesando...' : 'GENERAR PRESUPUESTO CON IA'}
                        </Button>
                    </form>
                </div>

                {/* History Section */}
                <div className="glass-card p-10 bg-white border-none shadow-sm flex flex-col h-[700px]">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-bold text-navy uppercase tracking-widest flex items-center gap-3">
                            <FileText className="text-accent" />
                            Historial
                        </h2>
                        <button onClick={loadProposals} disabled={loadingHistory} className="p-2 text-text-muted hover:text-navy transition-colors">
                            <RefreshCw size={20} className={loadingHistory ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {proposals.map((p) => (
                            <div key={p.id} className="p-5 rounded-2xl bg-bg-dark/50 border border-border/50 hover:bg-white hover:shadow-md transition-all cursor-pointer group" onClick={() => router.push(`/proposal/${p.id}/review`)}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-navy">{p.cliente_nome}</h3>
                                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">{p.cidade}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${p.status === 'Confirmada' ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent'
                                        }`}>{p.status}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted font-bold">{new Date(p.data_criacao).toLocaleDateString()}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-navy">{p.total_geral ? `€ ${Number(p.total_geral).toFixed(2)}` : '-'}</span>
                                        <button
                                            onClick={(e) => handleScheduleVisit(e, p)}
                                            className="p-2 text-accent bg-accent/5 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-navy rounded-lg transition-all"
                                            title="Agendar Visita"
                                        >
                                            <Calendar size={16} />
                                        </button>
                                        <button onClick={(e) => handleDeleteProposal(e, p.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all" title="Eliminar"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
