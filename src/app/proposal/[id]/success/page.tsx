'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Download, MessageCircle, Home, Loader2, Share2 } from 'lucide-react'
import { generateProposalPDF, generateProposalBlob, ProposalData, ProposalItem } from '@/services/pdfGenerator'

// Extend ProposalData if needed for local state
interface ExtendedProposalData extends ProposalData {
    whatsapp?: string;
}

import { getProposalDetailsAction, updateProposalAction } from '@/actions/proposal'
import { createClient } from '@/lib/supabase/client'

export default function SuccessPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [data, setData] = useState<ExtendedProposalData | null>(null)
    const [loading, setLoading] = useState(true)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            const result = await getProposalDetailsAction(id)

            if (result.success && result.data) {
                const { proposal, items, processing } = result.data

                // Use existing PDF URL if available
                if (proposal.pdf_gerado) {
                    setPdfUrl(proposal.pdf_gerado)
                }

                // Map DB items to PDF structure
                const mappedItems: ProposalItem[] = items.map(item => ({
                    name: item.nome_ambiente,
                    width: item.largura,
                    height: item.altura,
                    area: item.area_m2,
                    price: item.valor_total,
                    price_rule: 'Calculado'
                }))

                setData({
                    clientName: proposal.cliente_nome,
                    city: proposal.cidade,
                    items: mappedItems,
                    total: Number(proposal.total_geral || 0),
                    mockup: processing?.mockup_ascii || '',
                    whatsapp: proposal.whatsapp
                })
            }
            setLoading(false)
        }

        loadData()
    }, [id])

    // Generate and Upload PDF if not already present
    useEffect(() => {
        const generateAndUpload = async () => {
            if (!data || pdfUrl || uploading) return
            setUploading(true)

            try {
                const blob = await generateProposalBlob(data)
                if (!blob) throw new Error("Fallo al generar PDF")

                const supabase = createClient()
                const fileName = `${id}_${Date.now()}.pdf`

                const { error: uploadError } = await supabase.storage
                    .from('proposals')
                    .upload(fileName, blob, {
                        contentType: 'application/pdf',
                        upsert: true
                    })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('proposals')
                    .getPublicUrl(fileName)

                setPdfUrl(publicUrl)

                // Save URL to DB (Background)
                try {
                    await updateProposalAction(id, { pdf_gerado: publicUrl })
                } catch (err) {
                    console.error("Error saving PDF link to DB:", err)
                }

                console.log("PDF Uploaded and Persisted:", publicUrl)

            } catch (error) {
                console.error("Error al subir el PDF:", error)
            } finally {
                setUploading(false)
            }
        }

        if (data && !pdfUrl) {
            generateAndUpload()
        }
    }, [data, pdfUrl, id, uploading])


    const handleDownload = async () => {
        if (data) {
            await generateProposalPDF(data)
        }
    }

    const handleWhatsApp = async () => {
        if (!data) return

        let message = `*Preventiva Centro - Presupuesto Técnico*\n\n`
        message += `Hola ${data.clientName},\n\n`
        message += `Adjunto tu presupuesto para redes de protección en *${data.city}*.\n\n`
        message += `*Detalles de la inversión:*\n`
        message += `• Valor Total: *€ ${data.total.toFixed(2)} + IVA*\n\n`

        if (pdfUrl) {
            message += `📥 Descarga tu propuesta detallada aquí:\n${pdfUrl}\n\n`
        }

        message += `¿Deseas que agendemos la instalación para esta semana?`

        const encoded = encodeURIComponent(message)
        // Check if data.whatsapp is available to send directly
        const whatsappNumber = data.whatsapp?.replace(/\D/g, '')
        const baseUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}` : `https://wa.me/`
        window.open(`${baseUrl}?text=${encoded}`, '_blank')
    }

    const updateLinkInDB = async (url: string) => {
        await updateProposalAction(id, { pdf_gerado: url })
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
    )

    if (!data) return <div className="p-8 text-center">Datos del presupuesto no encontrados.</div>

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 p-10 rounded-[2rem] shadow-2xl max-w-lg w-full text-center space-y-8 border-none relative overflow-hidden">
                {/* Decoration */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-accent to-navy" />

                <div className="flex justify-center">
                    <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center animate-bounce-short">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-navy tracking-tight">Proposta Criada!</h1>
                    <p className="text-gray-600 font-medium">O orçamento para <span className="text-navy font-bold">{data.clientName}</span> está pronto para envio.</p>
                </div>

                <div className="bg-navy p-8 rounded-2xl shadow-inner text-white relative group">
                    <p className="text-[10px] font-black uppercase text-white/60 tracking-widest mb-1">Investimento Total</p>
                    <p className="text-4xl font-black text-accent tracking-tighter">€ {data.total.toFixed(2)} <span className="text-sm opacity-80">+ IVA</span></p>
                    <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:rotate-12 transition-transform">
                        <Share2 size={80} />
                    </div>
                </div>

                <div className="space-y-4">
                    <Button
                        onClick={handleWhatsApp}
                        className="w-full h-16 text-lg font-black gap-3 bg-green-500 hover:bg-green-600 hover:shadow-lg hover:shadow-green-200 text-white rounded-2xl transition-all"
                        disabled={uploading}
                    >
                        {uploading ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <MessageCircle className="h-6 w-6" />
                        )}
                        Enviar para o Cliente
                    </Button>

                    <div className="grid grid-cols-2 gap-3">
                        <Button onClick={handleDownload} variant="outline" className="h-14 font-bold border-2 rounded-xl gap-2 hover:bg-gray-50 border-gray-100 text-navy">
                            <Download className="h-5 w-5" />
                            Versão PDF
                        </Button>

                        <Button variant="ghost" onClick={() => router.push('/dashboard')} className="h-14 font-bold rounded-xl text-gray-600 hover:text-navy hover:bg-gray-100">
                            <Home className="h-5 w-5 mr-2" />
                            Página Inicial
                        </Button>
                    </div>
                    
                    <Button 
                        variant="ghost" 
                        onClick={() => router.push('/dashboard/presupuestos')} 
                        className="w-full h-12 font-bold rounded-xl text-gray-500 hover:text-navy opacity-80"
                    >
                        Lista Geral de Presupuestos
                    </Button>
                </div>

                <div className="pt-4 border-t border-gray-100 flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black uppercase text-gray-600 tracking-[0.2em]">Próximo Passo: Aguardar confirmação para agendar</p>
                    <span className="text-[8px] text-gray-300">v1.1.1-force-refresh</span>
                </div>
            </div>
        </div>
    )
}
