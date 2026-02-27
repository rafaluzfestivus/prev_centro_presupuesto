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

    const hasInterpreted = useRef(false)

    useEffect(() => {
        const loadData = async () => {
            try {
                // Check if already interpreted
                const details = await getProposalDetailsAction(id)
                if (details.success && details.data?.items && details.data.items.length > 0) {
                    setItems(details.data.items.map((it: any) => ({
                        name: it.nome_ambiente,
                        width: it.largura,
                        height: it.altura,
                        description: ''
                    })))
                    setMockup(details.data.processing?.mockup_ascii || '')
                    setLoading(false)
                    return
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
        // Encode items in session storage or state to pass to processing
        // For simplicity and since it's small, we can use localStorage or just hit the action with state
        // Let's use localStorage to pass data between pages if we want to keep the "processing" page as a separate step
        localStorage.setItem(`confirmed_items_${id}`, JSON.stringify(items))
        router.push(`/proposal/${id}/processing?source=preview`)
    }

    if (loading || isInterpreting) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
                    <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto" />
                    <h2 className="text-2xl font-bold text-gray-800">Entendendo o pedido...</h2>
                    <p className="text-gray-500 text-sm">A IA está organizando as medidas e ambientes.</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardHeader className="text-center">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                            <AlertCircle size={24} />
                        </div>
                        <CardTitle className="text-red-600">Erro na Interpretação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600 text-center">{error}</p>
                        <Button onClick={() => window.location.reload()} className="w-full">Tentar Novamente</Button>
                        <Button variant="ghost" onClick={() => router.push('/dashboard/presupuestos')} className="w-full">Voltar</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Confirmação do Pedido</h1>
                        <p className="text-gray-500 mt-2">Verifique se as medidas e ambientes estão corretos antes de calcular o preço.</p>
                    </div>
                    <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-6 h-auto text-lg rounded-xl shadow-lg group">
                        Confirmar e Calcular
                        <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-lg font-bold">Ambientes e Medidas</CardTitle>
                                <Button variant="outline" size="sm" onClick={handleAddItem} className="gap-2">
                                    <Plus size={16} /> Adicionar
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {items.map((item, index) => (
                                        <div key={index} className={`p-4 rounded-lg border transition-all ${editingIndex === index ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50' : 'border-gray-100 bg-white'}`}>
                                            {editingIndex === index ? (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="md:col-span-1">
                                                        <Label className="text-[10px] font-bold uppercase">Ambiente</Label>
                                                        <Input value={item.name} onChange={(e) => handleUpdateItem(index, 'name', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] font-bold uppercase">Largura (m)</Label>
                                                        <Input type="number" step="0.01" value={item.width} onChange={(e) => handleUpdateItem(index, 'width', parseFloat(e.target.value))} />
                                                    </div>
                                                    <div className="flex items-end gap-2">
                                                        <div className="flex-1">
                                                            <Label className="text-[10px] font-bold uppercase">Altura (m)</Label>
                                                            <Input type="number" step="0.01" value={item.height} onChange={(e) => handleUpdateItem(index, 'height', parseFloat(e.target.value))} />
                                                        </div>
                                                        <Button size="icon" onClick={() => setEditingIndex(null)} className="shrink-0 bg-blue-600">
                                                            <Save size={16} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-gray-800">{item.name}</h3>
                                                        <p className="text-sm text-gray-500">
                                                            {item.width} m x {item.height} m ({(item.width * item.height).toFixed(2)} m²)
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => setEditingIndex(index)}>
                                                            <Edit2 size={16} className="text-gray-400" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(index)}>
                                                            <Trash2 size={16} className="text-red-400" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {items.length === 0 && (
                                        <p className="text-center py-8 text-gray-400 italic">Nenhum item encontrado.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {missingInfo && (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
                                <AlertCircle className="text-amber-600 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-amber-800 text-sm italic">Observação da IA:</h4>
                                    <p className="text-amber-700 text-sm mt-1">{missingInfo}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Visualização ASCII</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto min-h-[300px] leading-relaxed">
                                    {mockup || 'Mockup não disponível'}
                                </pre>
                                <p className="text-[10px] text-gray-400 mt-4 uppercase font-bold tracking-widest text-center">Referência Visual 3D</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
