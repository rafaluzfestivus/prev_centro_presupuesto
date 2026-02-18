'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Download, MessageCircle, Home, Loader2 } from 'lucide-react'
import { generateProposalPDF, ProposalData, ProposalItem } from '@/services/pdfGenerator'
import { getProposalDetailsAction } from '@/actions/proposal'

export default function SuccessPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [data, setData] = useState<ProposalData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            const result = await getProposalDetailsAction(id)

            if (result.success && result.data) {
                const { proposal, items, processing } = result.data

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
                    mockup: processing?.mockup_ascii || ''
                })
            }
            setLoading(false)
        }

        loadData()
    }, [id])

    const handleDownload = async () => {
        if (data) {
            await generateProposalPDF(data)
        }
    }

    const handleWhatsApp = () => {
        if (!data) return

        const message = `Olá ${data.clientName}, aqui está o seu orçamento para redes de proteção da Preventiva Centro. Total: € ${data.total.toFixed(2)}. Podemos agendar a instalação?`
        const encoded = encodeURIComponent(message)
        window.open(`https://wa.me/?text=${encoded}`, '_blank')
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
    )

    if (!data) return <div className="p-8 text-center">Dados da proposta não encontrados.</div>

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
                <div className="flex justify-center">
                    <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Proposta Gerada!</h1>
                    <p className="text-gray-500 mt-2">O orçamento para <span className="font-semibold">{data.clientName}</span> está pronto.</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500">Valor Total</p>
                    <p className="text-3xl font-bold text-[var(--color-primary)]">€ {data.total.toFixed(2)}</p>
                </div>

                <div className="space-y-3">
                    <Button onClick={handleDownload} className="w-full h-12 text-lg gap-2">
                        <Download className="h-5 w-5" />
                        Baixar PDF
                    </Button>

                    <Button variant="outline" onClick={handleWhatsApp} className="w-full h-12 text-lg gap-2 border-green-500 text-green-600 hover:bg-green-50">
                        <MessageCircle className="h-5 w-5" />
                        Enviar via WhatsApp
                    </Button>

                    <Button variant="ghost" onClick={() => router.push('/painel')} className="w-full">
                        <Home className="h-4 w-4 mr-2" />
                        Voltar ao Início
                    </Button>
                </div>
            </div>
        </div>
    )
}
