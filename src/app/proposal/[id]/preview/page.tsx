'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, Check, AlertCircle, Edit2, Save, Trash2, Plus, ArrowRight } from 'lucide-react'
import { interpretProposalAction, getProposalDetailsAction } from '@/actions/proposal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function PreviewPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [items, setItems] = useState<any[]>([])
    const [mockup, setMockup] = useState('')
    const [missingInfo, setMissingInfo] = useState<string | null>(null)
    const [isInterpreting, setIsInterpreting] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [clientName, setClientName] = useState('')
    const [whatsapp, setWhatsapp] = useState('')

    const hasInterpreted = useRef(false)

    useEffect(() => {
        const loadData = async () => {
            try {
                // Check if already interpreted
                const details = await getProposalDetailsAction(id)
                if (details.success && details.data) {
                    const { proposal, items: dbItems, processing } = details.data
                    setClientName(proposal.cliente_nome || '')
                    setWhatsapp(proposal.whatsapp || '')

                    if (dbItems && dbItems.length > 0) {
                        setItems(dbItems.map((it: any) => ({
                            name: it.nome_ambiente,
                            width: it.largura,
                            height: it.altura,
                            description: ''
                        })))
                        setMockup(processing?.mockup_ascii || '')
                        setLoading(false)
                        return
                    }
                }

                if (hasInterpreted.current) return
                hasInterpreted.current = true

                setIsInterpreting(true)
                const result = await interpretProposalAction(id)
                if (result.success && result.data) {
                    setItems(result.data.items || [])
                    setMockup(result.data.ascii_mockup || '')
                    setMissingInfo(result.data.missing_info)
                } else {
                    setError(result.error || 'Falha ao interpretar pedido')
                }
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar prévia')
            } finally {
                setLoading(false)
                setIsInterpreting(false)
            }
        }

        loadData()
    }, [id])

    const handleUpdateItem = (index: number, field: string, value: any) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [field]: value }
        setItems(newItems)
    }

    const handleDeleteItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const handleAddItem = () => {
        setItems([...items, { name: 'Novo Ambiente', width: 0, height: 0, description: '' }])
        setEditingIndex(items.length)
    }

    const handleConfirm = () => {
        if (!clientName.trim()) {
            alert('Por favor, informe o nome do cliente.')
            return
        }
        // Save items and client info
        localStorage.setItem(`confirmed_items_${id}`, JSON.stringify(items))
        localStorage.setItem(`client_info_${id}`, JSON.stringify({ clientName, whatsapp }))
        router.push(`/proposal/${id}/processing?source=preview`)
    }

    if (loading || isInterpreting) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center space-y-8 border-none">
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping" />
                        <div className="relative bg-white rounded-full p-4 shadow-lg border-2 border-accent/10">
                            <Loader2 className="h-12 w-12 text-navy animate-spin" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-navy uppercase tracking-tight">Analisando Pedido</h2>
                        <p className="text-gray-400 font-medium text-sm">O Cérebro IA está organizando as medidas e ambientes para você.</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full rounded-[2rem] shadow-xl border-none">
                    <CardHeader className="text-center pt-10">
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={40} />
                        </div>
                        <CardTitle className="text-2xl font-black text-navy uppercase tracking-tight">Erro na Interpretação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-10">
                        <p className="text-sm font-medium text-gray-400 text-center px-4">{error}</p>
                        <div className="space-y-2">
                            <Button onClick={() => window.location.reload()} className="w-full h-14 bg-navy text-white font-bold rounded-xl shadow-lg">Tentar Novamente</Button>
                            <Button variant="ghost" onClick={() => router.push('/dashboard/presupuestos')} className="w-full h-12 text-gray-400 font-bold hover:text-navy">Voltar ao Painel</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-12">
            <div className="max-w-6xl mx-auto space-y-12">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-accent text-navy text-[10px] font-black uppercase px-3 py-1 rounded-full">Etapa 2 de 4</span>
                            <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest">Confirmação de Dados</span>
                        </div>
                        <h1 className="text-4xl font-black text-navy dark:text-white tracking-tighter">Validar Pedido</h1>
                        <p className="text-gray-400 font-medium">Ajuste os ambientes e valide os dados do cliente antes de gerar o orçamento.</p>
                    </div>
                    <Button onClick={handleConfirm} className="bg-navy hover:bg-navy/90 text-white font-black px-10 py-8 h-auto text-xl rounded-2xl shadow-2xl group transition-all transform hover:-translate-y-1 active:scale-95">
                        Calcular Orçamento
                        <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform h-6 w-6" />
                    </Button>
                </header>

                {/* Funnel Progress */}
                <div className="flex items-center justify-center gap-3 uppercase text-[10px] font-black tracking-tighter text-gray-300">
                    <span className="flex items-center gap-1 text-navy opacity-40"><Check size={12} /> Pedido</span>
                    <div className="h-[2px] w-8 bg-gray-200" />
                    <span className="text-navy bg-accent/20 px-3 py-1 rounded-full border border-accent/20">Validação</span>
                    <div className="h-[2px] w-8 bg-gray-200" />
                    <span>Revisão</span>
                    <div className="h-[2px] w-8 bg-gray-200" />
                    <span>Fechamento</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8 space-y-10">
                        {/* Client Validation */}
                        <section className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Dados do Funil</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-navy/50 ml-1">Nome do Cliente</Label>
                                    <Input
                                        placeholder="Nome Completo"
                                        className="h-14 bg-gray-50 border-none rounded-xl font-bold text-navy focus-visible:ring-2 focus-visible:ring-accent"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-navy/50 ml-1">WhatsApp (Envio)</Label>
                                    <Input
                                        placeholder="Ex: 34 600 000 000"
                                        className="h-14 bg-gray-50 border-none rounded-xl font-bold text-navy focus-visible:ring-2 focus-visible:ring-accent"
                                        value={whatsapp}
                                        onChange={(e) => setWhatsapp(e.target.value)}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Items Validation */}
                        <Card className="rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between p-8 pb-4">
                                <CardTitle className="text-xl font-black text-navy uppercase tracking-tight">Ambientes Reportados</CardTitle>
                                <Button variant="outline" size="sm" onClick={handleAddItem} className="rounded-full border-2 border-accent text-navy hover:bg-accent font-black gap-2 px-4">
                                    <Plus size={16} /> Adicionar
                                </Button>
                            </CardHeader>
                            <CardContent className="p-8 pt-0">
                                <div className="space-y-4">
                                    {items.map((item, index) => (
                                        <div key={index} className={`p-6 rounded-2xl border-2 transition-all ${editingIndex === index ? 'border-accent bg-accent/5' : 'border-gray-50 bg-white hover:border-gray-100'}`}>
                                            {editingIndex === index ? (
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                    <div className="md:col-span-2">
                                                        <Label className="text-[9px] font-black uppercase text-gray-400 block mb-2">Nome do Local</Label>
                                                        <Input className="font-bold rounded-lg border-gray-200" value={item.name} onChange={(e) => handleUpdateItem(index, 'name', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[9px] font-black uppercase text-gray-400 block mb-2">L (m)</Label>
                                                        <Input type="number" step="0.01" className="font-bold rounded-lg border-gray-200" value={item.width} onChange={(e) => handleUpdateItem(index, 'width', parseFloat(e.target.value))} />
                                                    </div>
                                                    <div className="flex items-end gap-3">
                                                        <div className="flex-1">
                                                            <Label className="text-[9px] font-black uppercase text-gray-400 block mb-2">A (m)</Label>
                                                            <Input type="number" step="0.01" className="font-bold rounded-lg border-gray-200" value={item.height} onChange={(e) => handleUpdateItem(index, 'height', parseFloat(e.target.value))} />
                                                        </div>
                                                        <Button size="icon" onClick={() => setEditingIndex(null)} className="shrink-0 bg-navy hover:bg-navy/90 rounded-lg h-10 w-10">
                                                            <Save size={18} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center font-black text-navy text-xs">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-black text-navy text-lg leading-tight uppercase tracking-tight">{item.name}</h3>
                                                            <p className="text-xs font-bold text-gray-400 mt-1">
                                                                Dimensões: <span className="text-navy">{item.width}m</span> x <span className="text-navy">{item.height}m</span> • <span className="text-accent">{(item.width * item.height).toFixed(2)}m²</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => setEditingIndex(index)} className="rounded-full hover:bg-accent/10 hover:text-navy text-gray-300">
                                                            <Edit2 size={18} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(index)} className="rounded-full hover:bg-red-50 hover:text-red-500 text-gray-300">
                                                            <Trash2 size={18} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {items.length === 0 && (
                                        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Nenhum ambiente detectado.</p>
                                            <Button variant="ghost" onClick={handleAddItem} className="mt-4 text-navy font-black text-xs hover:bg-white underline underline-offset-4">Clique para adicionar manualmente</Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-4 space-y-10">
                        {/* Mockup Preview */}
                        <section className="space-y-4">
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Referência Visual</h2>
                            <div className="bg-navy rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                                    <Check size={120} />
                                </div>
                                <pre className="text-accent font-mono text-[9px] leading-tight overflow-x-auto min-h-[300px]">
                                    {mockup || 'Processando 3D...'}
                                </pre>
                                <div className="mt-6 pt-6 border-t border-white/10 text-center">
                                    <p className="text-[8px] font-black uppercase text-white/30 tracking-[0.3em]">Projetista Digital Preventiva</p>
                                </div>
                            </div>
                        </section>

                        {/* IA Alerts */}
                        {missingInfo && (
                            <div className="bg-orange-50 border-2 border-orange-100 p-6 rounded-[2rem] flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <AlertCircle className="text-orange-500 shrink-0 h-6 w-6" />
                                <div>
                                    <h4 className="font-black text-orange-900 text-xs italic uppercase tracking-tighter">Nota do Cérebro IA:</h4>
                                    <p className="text-orange-700/80 text-xs font-bold leading-relaxed mt-2">{missingInfo}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
