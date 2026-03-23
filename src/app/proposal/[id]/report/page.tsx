'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getProposalDetailsAction, addAfterPhotosAction } from '@/actions/proposal'
import { Proposal, ProposalItem, AIProcessingResult } from '@/lib/types'
import { Loader2, Printer, ArrowLeft, Camera, MapPin, Phone, User, X, Plus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function ReportPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [items, setItems] = useState<ProposalItem[]>([])
    const [processing, setProcessing] = useState<AIProcessingResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [uploadingAfter, setUploadingAfter] = useState(false)
    const [afterPhotoUrls, setAfterPhotoUrls] = useState<string[]>([])
    const [uploadSuccess, setUploadSuccess] = useState(false)
    const afterInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const result = await getProposalDetailsAction(id)
            if (result.success && result.data) {
                const { proposal: p, items: it, processing: pr } = result.data
                setProposal(p)
                setItems(it)
                setProcessing(pr)
                setAfterPhotoUrls(p.after_photos || [])
            }
            setLoading(false)
        }
        load()
    }, [id])

    const handleAfterPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files.length) return
        setUploadingAfter(true)
        setUploadSuccess(false)
        try {
            const supabase = createClient()
            const newUrls: string[] = []
            for (const file of Array.from(e.target.files)) {
                const ext = file.name.split('.').pop()
                const fileName = `${id}/after/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                const { error } = await supabase.storage.from('proposals').upload(fileName, file)
                if (!error) {
                    const { data: { publicUrl } } = supabase.storage.from('proposals').getPublicUrl(fileName)
                    newUrls.push(publicUrl)
                }
            }
            if (newUrls.length) {
                await addAfterPhotosAction(id, newUrls)
                setAfterPhotoUrls(prev => [...prev, ...newUrls])
                setUploadSuccess(true)
                setTimeout(() => setUploadSuccess(false), 3000)
            }
        } catch (err) {
            console.error('Error uploading after photos:', err)
        } finally {
            setUploadingAfter(false)
            if (afterInputRef.current) afterInputRef.current.value = ''
        }
    }

    const totalArea = items.reduce((sum, it) => sum + (it.area_m2 || 0), 0)
    const totalValue = Number(proposal?.total_geral || 0)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
            </div>
        )
    }

    if (!proposal) {
        return <div className="p-8 text-center text-gray-400">Propuesta no encontrada.</div>
    }

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white">
            {/* Toolbar — hidden when printing */}
            <div className="print:hidden sticky top-0 z-10 bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2 text-gray-500 font-bold">
                        <ArrowLeft className="h-4 w-4" /> Volver
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ficha de Instalación</span>
                    </div>
                    <Button onClick={() => window.print()} className="bg-navy text-white font-bold h-9 px-4 gap-2 rounded-lg hover:bg-navy/90">
                        <Printer className="h-4 w-4" />
                        Imprimir / PDF
                    </Button>
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
                    <div className="text-right">
                        <div className={`inline-block px-4 py-2 rounded-full text-sm font-black uppercase tracking-wide ${proposal.status === 'Confirmada' ? 'bg-green-100 text-green-700' : 'bg-accent/20 text-navy'}`}>
                            {proposal.status}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 font-bold">
                            Creado: {new Date(proposal.data_criacao).toLocaleDateString('es-ES')}
                        </p>
                        {proposal.data_confirmacao && (
                            <p className="text-[10px] text-gray-400 font-bold">
                                Cerrado: {new Date(proposal.data_confirmacao).toLocaleDateString('es-ES')}
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
                                {proposal.cliente_nome?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-black text-navy text-lg leading-tight">{proposal.cliente_nome}</p>
                                <p className="text-xs text-gray-400 font-medium">{proposal.cidade}</p>
                            </div>
                        </div>
                        {proposal.whatsapp && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4 text-green-500" />
                                <span className="font-medium">{proposal.whatsapp}</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dirección de Instalación</h2>
                        {proposal.installation_address ? (
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                                <p className="font-medium text-navy leading-relaxed">{proposal.installation_address}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">Sin dirección registrada</p>
                        )}
                        {proposal.installation_notes && (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800 font-medium leading-relaxed">
                                <span className="font-black uppercase text-[10px] text-amber-600 tracking-wide block mb-1">Notas para el instalador</span>
                                {proposal.installation_notes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-navy rounded-2xl p-6 text-white">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-4">Resumen Financiero</h2>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Total m²</p>
                            <p className="text-3xl font-black text-accent">{totalArea.toFixed(2)}</p>
                            <p className="text-[10px] text-white/40 font-bold">metros cuadrados</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Piezas</p>
                            <p className="text-3xl font-black text-accent">{items.length}</p>
                            <p className="text-[10px] text-white/40 font-bold">redes individuales</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Inversión Total</p>
                            <p className="text-3xl font-black text-accent">€ {totalValue.toFixed(2)}</p>
                            <p className="text-[10px] text-white/40 font-bold">+ IVA</p>
                        </div>
                    </div>
                </div>

                {/* Measurements Table */}
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
                                    <th className="text-right px-6 py-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Precio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                        <td className="px-6 py-4 text-gray-400 font-bold text-xs">{idx + 1}</td>
                                        <td className="px-6 py-4 font-black text-navy">{item.nome_ambiente}</td>
                                        <td className="px-4 py-4 text-right font-medium text-gray-600">{Number(item.largura).toFixed(2)}m</td>
                                        <td className="px-4 py-4 text-right font-medium text-gray-600">{Number(item.altura).toFixed(2)}m</td>
                                        <td className="px-4 py-4 text-right font-bold text-navy">{Number(item.area_m2).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right font-black text-navy">€ {Number(item.valor_total).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-navy/5">
                                    <td colSpan={4} className="px-6 py-4 font-black text-navy uppercase text-xs tracking-widest">TOTAL</td>
                                    <td className="px-4 py-4 text-right font-black text-navy">{totalArea.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-black text-navy text-base">€ {totalValue.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Installation Plan (Mockup) */}
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

                {/* Before Photos */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Fotos del Lugar — Antes de la Instalación
                        </h2>
                    </div>
                    <div className="p-6">
                        {(proposal.before_photos || []).length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {(proposal.before_photos || []).map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                                        <img
                                            src={url}
                                            alt={`Antes ${i + 1}`}
                                            className="w-full aspect-square object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity"
                                        />
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-400 text-sm italic py-8">
                                Sin fotos previas registradas.
                            </p>
                        )}
                    </div>
                </div>

                {/* After Photos — with upload */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:break-inside-avoid">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Fotos — Después de la Instalación
                        </h2>
                        <div className="print:hidden flex items-center gap-2">
                            {uploadSuccess && (
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
                                {uploadingAfter ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Plus className="h-3 w-3" />
                                )}
                                Añadir fotos
                            </Button>
                            <input
                                ref={afterInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleAfterPhotoUpload}
                            />
                        </div>
                    </div>
                    <div className="p-6">
                        {afterPhotoUrls.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {afterPhotoUrls.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                                        <img
                                            src={url}
                                            alt={`Después ${i + 1}`}
                                            className="w-full aspect-square object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity"
                                        />
                                    </a>
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

                {/* Calculation Logic */}
                {processing?.logica_calculo && (
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 print:break-inside-avoid">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Memoria de Cálculo</h2>
                        <p className="text-sm text-gray-600 leading-relaxed">{processing.logica_calculo}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center py-6 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em]">Preventiva Centro · Madrid · contacto@preventivacentro.es</p>
                    <p className="text-[10px] text-gray-300 mt-1">Ref. {id}</p>
                </div>
            </div>

            {/* Print Styles */}
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
