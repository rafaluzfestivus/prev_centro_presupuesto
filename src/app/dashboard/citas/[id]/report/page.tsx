'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    getAppointmentReportAction,
    addAppointmentAfterPhotosAction,
    addAppointmentBeforePhotosAction,
    deleteAppointmentPhotoAction,
} from '@/actions/proposal'
import { Loader2, Printer, ArrowLeft, Camera, MapPin, Phone, Plus, CheckCircle2, Calendar, Euro, Layers, FileText, AlertTriangle, Trash2, X, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pendiente',  cls: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completada', cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelada',  cls: 'bg-red-100 text-red-500' },
}

export default function AppointmentReportPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [appointment, setAppointment] = useState<any>(null)
    const [proposal, setProposal] = useState<any>(null)
    const [items, setItems] = useState<any[]>([])
    const [processing, setProcessing] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [uploadingAfter, setUploadingAfter] = useState(false)
    const [uploadingBefore, setUploadingBefore] = useState(false)
    const [afterPhotoUrls, setAfterPhotoUrls] = useState<string[]>([])
    const [beforePhotoUrls, setBeforePhotoUrls] = useState<string[]>([])
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<'before' | 'after' | null>(null)
    const [hideValues, setHideValues] = useState(false)
    const afterInputRef = useRef<HTMLInputElement>(null)
    const beforeInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const result = await getAppointmentReportAction(id)
            if (result.success && result.data) {
                const { appointment: apt, proposal: prop, items: it, processing: pr } = result.data
                setAppointment(apt)
                setProposal(prop)
                setItems(it)
                setProcessing(pr)
                setAfterPhotoUrls(apt.after_photos || [])
                setBeforePhotoUrls(apt.before_photos || [])
            }
            setLoading(false)
        }
        load()
    }, [id])

    // Upload photos via API route (service role bypasses RLS)
    const uploadPhotos = async (files: FileList, type: 'before' | 'after'): Promise<string[]> => {
        const urls: string[] = []
        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop() || 'jpg'
            const path = `apt-${id}/${type}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
            const form = new FormData()
            form.append('file', file)
            form.append('path', path)
            form.append('bucket', 'proposals')
            const res = await fetch('/api/upload', { method: 'POST', body: form })
            const data = await res.json() as { url?: string; error?: string }
            if (!res.ok || data.error) throw new Error(data.error || 'Erro ao fazer upload')
            urls.push(data.url!)
        }
        return urls
    }

    const handleBeforePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return
        setUploadingBefore(true)
        setUploadError(null)
        setUploadSuccess(null)
        try {
            const newUrls = await uploadPhotos(e.target.files, 'before')
            const res = await addAppointmentBeforePhotosAction(id, newUrls)
            if (!res.success) throw new Error(res.error)
            setBeforePhotoUrls(prev => [...prev, ...newUrls])
            setUploadSuccess('before')
            setTimeout(() => setUploadSuccess(null), 3000)
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Erro ao enviar foto')
        } finally {
            setUploadingBefore(false)
            if (beforeInputRef.current) beforeInputRef.current.value = ''
        }
    }

    const handleAfterPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return
        setUploadingAfter(true)
        setUploadError(null)
        setUploadSuccess(null)
        try {
            const newUrls = await uploadPhotos(e.target.files, 'after')
            const res = await addAppointmentAfterPhotosAction(id, newUrls)
            if (!res.success) throw new Error(res.error)
            setAfterPhotoUrls(prev => [...prev, ...newUrls])
            setUploadSuccess('after')
            setTimeout(() => setUploadSuccess(null), 3000)
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Erro ao enviar foto')
        } finally {
            setUploadingAfter(false)
            if (afterInputRef.current) afterInputRef.current.value = ''
        }
    }

    const handleDeletePhoto = async (url: string, type: 'before' | 'after') => {
        const res = await deleteAppointmentPhotoAction(id, url, type)
        if (res.success) {
            if (type === 'before') setBeforePhotoUrls(prev => prev.filter(u => u !== url))
            else setAfterPhotoUrls(prev => prev.filter(u => u !== url))
        }
    }

    const totalArea = items.reduce((sum: number, it: any) => sum + (Number(it.area_m2) || 0), 0)
    const totalValue = Number(appointment?.total_value || proposal?.total_geral || 0)
    const displayM2 = appointment?.total_m2 || totalArea || 0

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
            </div>
        )
    }

    if (!appointment) {
        return <div className="p-8 text-center text-gray-400">Cita no encontrada.</div>
    }

    const client = appointment.clients
    const clientName = client?.name || proposal?.cliente_nome || '—'
    const clientWhatsapp = client?.whatsapp || proposal?.whatsapp || ''
    const clientLocation = client?.location || proposal?.cidade || ''
    const installAddress = appointment.installation_address || proposal?.installation_address || ''
    const installNotes = appointment.installation_notes || proposal?.installation_notes || ''
    const beforePhotos: string[] = appointment.before_photos || proposal?.before_photos || []
    const aptDate = appointment.date_start || appointment.scheduled_at
    const status = STATUS_LABELS[appointment.status] || { label: appointment.status, cls: 'bg-gray-100 text-gray-500' }

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white">
            {/* Toolbar */}
            <div className="print:hidden sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2 text-gray-500 font-bold">
                        <ArrowLeft className="h-4 w-4" /> Volver
                    </Button>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ficha de Instalación</span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setHideValues(v => !v)}
                            className={`h-9 px-3 gap-2 rounded-lg font-bold text-sm ${hideValues ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'text-gray-500 hover:bg-gray-100'}`}
                            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
                        >
                            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            <span className="hidden sm:inline">{hideValues ? 'Valores ocultos' : 'Ocultar valores'}</span>
                        </Button>
                        <Button onClick={() => window.print()} className="bg-navy text-white font-bold h-9 px-4 gap-2 rounded-lg hover:bg-navy/90">
                            <Printer className="h-4 w-4" />
                            Imprimir / PDF
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 print:py-4 print:space-y-6">

                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-1">Preventiva Centro · Madrid</div>
                        <h1 className="text-3xl font-black text-navy tracking-tight">Ficha de Instalación</h1>
                        <p className="text-gray-400 font-medium mt-1">Ref. #{id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right space-y-2">
                        {appointment.special_attention && (
                            <div className="flex items-center justify-end gap-2 px-4 py-2 bg-orange-100 border border-orange-300 rounded-xl mb-1">
                                <AlertTriangle size={16} className="text-orange-500 shrink-0" />
                                <span className="text-sm font-black text-orange-700 uppercase tracking-wide">Atención Especial</span>
                            </div>
                        )}
                        <div className={`inline-block px-4 py-2 rounded-full text-sm font-black uppercase tracking-wide ${status.cls}`}>
                            {status.label}
                        </div>
                        {aptDate && (
                            <p className="text-[10px] text-gray-400 font-bold flex items-center justify-end gap-1">
                                <Calendar size={10} />
                                {new Date(aptDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                        )}
                        {proposal && (
                            <p className="text-[10px] text-gray-400 font-bold flex items-center justify-end gap-1">
                                <FileText size={10} />
                                Presupuesto vinculado
                            </p>
                        )}
                    </div>
                </div>

                {/* Client + Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Datos del Cliente</h2>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center font-black text-navy">
                                {(clientName || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="font-black text-navy text-lg leading-tight">{clientName}</p>
                                {clientLocation && <p className="text-xs text-gray-400 font-medium">{clientLocation}</p>}
                            </div>
                        </div>
                        {clientWhatsapp && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4 text-green-500" />
                                <span className="font-medium">{clientWhatsapp}</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dirección de Instalación</h2>
                        {installAddress ? (
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                                <p className="font-medium text-navy leading-relaxed">{installAddress}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">Sin dirección registrada</p>
                        )}
                        {installNotes && (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800 font-medium leading-relaxed">
                                <span className="font-black uppercase text-[10px] text-amber-600 tracking-wide block mb-1">Notas para el instalador</span>
                                {installNotes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-navy rounded-2xl p-6 text-white">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-4">Resumen</h2>
                    <div className={`grid gap-6 ${hideValues ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        <div>
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Total m²</p>
                            <p className="text-3xl font-black text-accent">{Number(displayM2).toFixed(2)}</p>
                            <p className="text-[10px] text-white/40 font-bold">metros cuadrados</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Piezas</p>
                            <p className="text-3xl font-black text-accent">{items.length || '—'}</p>
                            <p className="text-[10px] text-white/40 font-bold">redes individuales</p>
                        </div>
                        {!hideValues && (
                            <div>
                                <p className="text-[10px] font-black uppercase text-white/40 mb-1">Inversión Total</p>
                                <p className="text-3xl font-black text-accent">
                                    {totalValue > 0 ? `€ ${totalValue.toFixed(2)}` : '—'}
                                </p>
                                <p className="text-[10px] text-white/40 font-bold">+ IVA</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Measurements Table (only if proposal linked with items) */}
                {items.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mediciones Detalladas</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">#</th>
                                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Ambiente / Pieza</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Largo</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Alto</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">m²</th>
                                        {!hideValues && <th className="text-right px-6 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Precio</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item: any, idx: number) => (
                                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                            <td className="px-6 py-4 text-gray-400 font-bold text-xs">{idx + 1}</td>
                                            <td className="px-6 py-4 font-black text-navy">{item.nome_ambiente}</td>
                                            <td className="px-4 py-4 text-right font-medium text-gray-600">{Number(item.largura).toFixed(2)}m</td>
                                            <td className="px-4 py-4 text-right font-medium text-gray-600">{Number(item.altura).toFixed(2)}m</td>
                                            <td className="px-4 py-4 text-right font-bold text-navy">{Number(item.area_m2).toFixed(2)}</td>
                                            {!hideValues && <td className="px-6 py-4 text-right font-black text-navy">€ {Number(item.valor_total).toFixed(2)}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200 bg-navy/5">
                                        <td colSpan={hideValues ? 4 : 4} className="px-6 py-4 font-black text-navy uppercase text-xs tracking-widest">TOTAL</td>
                                        <td className="px-4 py-4 text-right font-black text-navy">{totalArea.toFixed(2)}</td>
                                        {!hideValues && <td className="px-6 py-4 text-right font-black text-navy text-base">€ {totalValue.toFixed(2)}</td>}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* Installation Plan Mockup */}
                {processing?.mockup_ascii && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Plano de la Instalación</h2>
                        </div>
                        <div className="bg-navy p-6 m-4 rounded-xl">
                            <pre className="text-accent font-mono text-[9px] leading-tight whitespace-pre overflow-x-auto">
                                {processing.mockup_ascii}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Upload error banner */}
                {uploadError && (
                    <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium print:hidden">
                        <span className="flex-1">{uploadError}</span>
                        <button onClick={() => setUploadError(null)}><X className="h-4 w-4" /></button>
                    </div>
                )}

                {/* Before Photos */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Fotos del Lugar — Antes de la Instalación
                        </h2>
                        <div className="print:hidden flex items-center gap-2">
                            {uploadSuccess === 'before' && (
                                <span className="text-[10px] text-green-600 font-black uppercase flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Guardado
                                </span>
                            )}
                            <Button
                                size="sm"
                                onClick={() => beforeInputRef.current?.click()}
                                disabled={uploadingBefore}
                                className="bg-accent/10 hover:bg-accent text-navy font-black text-[10px] uppercase rounded-full h-8 px-4 gap-1"
                            >
                                {uploadingBefore ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                Añadir fotos
                            </Button>
                            <input ref={beforeInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBeforePhotoUpload} />
                        </div>
                    </div>
                    <div className="p-6">
                        {beforePhotoUrls.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {beforePhotoUrls.map((url: string, i: number) => (
                                    <div key={i} className="relative group">
                                        <a href={url} target="_blank" rel="noreferrer" className="block">
                                            <img src={url} alt={`Antes ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity" />
                                        </a>
                                        <button
                                            onClick={() => handleDeletePhoto(url, 'before')}
                                            className="print:hidden absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                <Camera className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 font-medium">Sin fotos previas todavía</p>
                                <button
                                    onClick={() => beforeInputRef.current?.click()}
                                    className="print:hidden mt-3 text-xs text-accent font-bold hover:underline"
                                >
                                    + Añadir fotos del antes
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* After Photos */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:break-inside-avoid">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Fotos — Después de la Instalación
                        </h2>
                        <div className="print:hidden flex items-center gap-2">
                            {uploadSuccess === 'after' && (
                                <span className="text-[10px] text-green-600 font-black uppercase flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Guardado
                                </span>
                            )}
                            <Button
                                size="sm"
                                onClick={() => afterInputRef.current?.click()}
                                disabled={uploadingAfter}
                                className="bg-accent/10 hover:bg-accent text-navy font-black text-[10px] uppercase rounded-full h-8 px-4 gap-1"
                            >
                                {uploadingAfter ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                Añadir fotos
                            </Button>
                            <input ref={afterInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAfterPhotoUpload} />
                        </div>
                    </div>
                    <div className="p-6">
                        {afterPhotoUrls.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {afterPhotoUrls.map((url: string, i: number) => (
                                    <div key={i} className="relative group">
                                        <a href={url} target="_blank" rel="noreferrer" className="block">
                                            <img src={url} alt={`Después ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity" />
                                        </a>
                                        <button
                                            onClick={() => handleDeletePhoto(url, 'after')}
                                            className="print:hidden absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                <Camera className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 font-medium">Sin fotos post-instalación todavía</p>
                                <p className="text-[10px] text-gray-300 mt-1">Súbelas cuando la instalación esté completa</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center py-6 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em]">Preventiva Centro · Madrid · contacto@preventivacentro.es</p>
                    <p className="text-[10px] text-gray-300 mt-1">Ref. {id}</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    .print\\:hidden { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { margin: 15mm; size: A4 portrait; }
                }
            `}</style>
        </div>
    )
}
