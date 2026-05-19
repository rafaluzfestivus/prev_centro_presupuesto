'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, RefreshCw, Send, Loader2, Trash2, Plus, Download, MessageCircle, Home, AlertCircle, MapPin, Camera, X, FileText, Calendar } from 'lucide-react'
import { getProposalDetailsAction, processProposalWithAIAction, confirmProposalAction, updateProposalAction } from '@/actions/proposal'
import { ProposalItem as DBProposalItem } from '@/lib/types'
import { PRICING } from '@/lib/constants'
import { downloadProposalPPTX, ProposalDataPPTX } from '@/services/pptxGenerator'
import { generateProposalBlob, generateProposalPDF } from '@/services/pdfGenerator'
import { sendDocumentMessage } from '@/lib/evolution'
import { createClient } from '@/lib/supabase/client'

type ProposalItem = {
  id: string
  name: string
  width: number
  height: number
  area: number
  price: number
  price_rule?: string
}

type ProposalData = {
  clientName: string
  city: string
  items: ProposalItem[]
  mockup: string
  logic: string
  total: number
  whatsapp: string
  imageUrl?: string
}

export default function ReviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<ProposalData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)

  // Close-sale modal
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [installAddress, setInstallAddress] = useState('')
  const [installNotes, setInstallNotes] = useState('')
  const [installDate, setInstallDate] = useState('')
  const [beforePhotoFiles, setBeforePhotoFiles] = useState<File[]>([])
  const [beforePhotoUrls, setBeforePhotoUrls] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    setLoading(true)
    const result = await getProposalDetailsAction(id)
    if (result.success && result.data) {
      const { proposal, items, processing } = result.data
      const mappedItems: ProposalItem[] = items.map(item => ({
        id: item.id,
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
        mockup: processing?.mockup_ascii || '',
        logic: processing?.logica_calculo || '',
        total: Number(proposal.total_geral || processing?.total_calculado || 0),
        whatsapp: proposal.whatsapp || '',
        imageUrl: proposal.input_image_url
      })
    }
    setLoading(false)
  }

  const handleUpdateItem = (id: string, field: keyof ProposalItem, value: string | number) => {
    if (!data) return
    const newItems = data.items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        if (field === 'width' || field === 'height') {
          const w = field === 'width' ? Number(value) : item.width
          const h = field === 'height' ? Number(value) : item.height
          updated.area = w * h
          const calculated = updated.area * PRICING.PRICE_PER_M2
          updated.price = Math.max(PRICING.MIN_PRICE_PER_ITEM, calculated)
        }
        if (field === 'price') {
          updated.price = Number(value)
          updated.price_rule = 'Manual'
        }
        return updated
      }
      return item
    })
    const newTotal = newItems.reduce((acc, item) => acc + item.price, 0)
    setData(prev => prev ? ({ ...prev, items: newItems, total: newTotal }) : null)
  }

  const handleAddItem = () => {
    if (!data) return
    const newItem: ProposalItem = {
      id: `new_${Date.now()}`,
      name: 'Nuevo Ítem',
      width: 0, height: 0, area: 0,
      price: PRICING.MIN_PRICE_PER_ITEM,
      price_rule: 'Manual'
    }
    const newItems = [...data.items, newItem]
    const newTotal = newItems.reduce((acc, item) => acc + item.price, 0)
    setData({ ...data, items: newItems, total: newTotal })
  }

  const handleDeleteItem = (id: string) => {
    if (!data) return
    const newItems = data.items.filter(item => item.id !== id)
    const newTotal = newItems.reduce((acc, item) => acc + item.price, 0)
    setData({ ...data, items: newItems, total: newTotal })
  }

  const handleConfirm = async () => {
    if (!data) return
    setIsConfirming(true)
    setActionError(null)
    try {
      const result = await confirmProposalAction(id, data.total, data.items)
      if (result.success) {
        router.push(`/proposal/${id}/success`)
      } else {
        setActionError(result.error || 'Error al guardar el presupuesto')
      }
    } catch (error) {
      console.error(error)
      setActionError('Error al guardar presupuesto')
    } finally {
      setIsConfirming(false)
    }
  }

  const [aiInstruction, setAiInstruction] = useState('')
  const handleReprocess = async () => {
    if (!aiInstruction.trim()) return
    setIsReprocessing(true)
    setActionError(null)
    try {
      const result = await processProposalWithAIAction(id, aiInstruction, data)
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al reajustar')
      }
      const newData = result.data
      setData(prev => ({
        ...prev!,
        items: newData.items.map((item: any, idx: number) => ({ ...item, id: idx.toString() })),
        mockup: newData.ascii_mockup,
        logic: newData.pricing_logic,
        total: newData.total
      }))
      setAiInstruction('')
    } catch (error: any) {
      console.error(error)
      setActionError(error.message || 'Error al reajustar con IA')
    } finally {
      setIsReprocessing(false)
    }
  }

  const handleBeforePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files)
    setBeforePhotoFiles(prev => [...prev, ...newFiles])
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    setBeforePhotoUrls(prev => [...prev, ...newPreviews])
  }

  const removeBeforePhoto = (index: number) => {
    setBeforePhotoFiles(prev => prev.filter((_, i) => i !== index))
    setBeforePhotoUrls(prev => prev.filter((_, i) => i !== index))
  }

  const handleCloseSale = async () => {
    setIsConfirming(true)
    setActionError(null)
    const supabase = createClient()
    try {
      // 1. Upload before photos
      let uploadedPhotoUrls: string[] = []
      if (beforePhotoFiles.length > 0) {
        setUploadingPhotos(true)
        for (const file of beforePhotoFiles) {
          const ext = file.name.split('.').pop()
          const fileName = `${id}/before/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error } = await supabase.storage.from('proposals').upload(fileName, file)
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from('proposals').getPublicUrl(fileName)
            uploadedPhotoUrls.push(publicUrl)
          }
        }
        setUploadingPhotos(false)
      }

      // 2. Find or create client (same pattern as CalendarView)
      const cleanWhatsapp = (data?.whatsapp || '').replace(/\D/g, '')
      let clientId: string | null = null

      if (cleanWhatsapp) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('whatsapp', cleanWhatsapp)
          .limit(1)
        if (existing && existing.length > 0) {
          clientId = existing[0].id
        } else {
          const { data: newClient } = await supabase
            .from('clients')
            .insert({ name: data?.clientName || 'Cliente', whatsapp: cleanWhatsapp, source: 'proposta' })
            .select('id')
            .single()
          clientId = newClient?.id ?? null
        }
      }

      if (!clientId) {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({ name: data?.clientName || 'Cliente', source: 'proposta' })
          .select('id')
          .single()
        clientId = newClient?.id ?? null
      }

      if (!clientId) throw new Error('Não foi possível identificar o cliente')

      // 3. Create appointment (same pattern as CalendarView)
      const isoDate = installDate
        ? new Date(installDate).toISOString()
        : new Date().toISOString()

      const { error: aptErr } = await supabase
        .from('appointments')
        .insert({
          client_id: clientId,
          date_start: isoDate,
          date_end: isoDate,
          scheduled_at: isoDate,
          status: 'confirmed',
          attachment_url: null,
          installation_address: installAddress || data?.city || null,
          total_value: data?.total ?? null,
          total_m2: data?.items.reduce((s, i) => s + i.area, 0) ?? null,
          special_attention: false,
          notes: `Venta cerrada desde presupuesto ${id}.`,
          before_photos: uploadedPhotoUrls.length ? uploadedPhotoUrls : null,
          installation_notes: installNotes || null,
        })

      if (aptErr) throw new Error(aptErr.message)

      // 4. Mark proposal as Confirmada
      await updateProposalAction(id, { status: 'Confirmada' })

      router.push('/dashboard/citas')
    } catch (error: any) {
      console.error('[handleCloseSale]', error)
      setActionError(error.message || 'Error al cerrar venta')
      setShowCloseModal(false)
    } finally {
      setIsConfirming(false)
      setUploadingPhotos(false)
    }
  }

  const handleDownloadPPTX = () => {
    if (!data) return
    downloadProposalPPTX(data)
  }

  const [generatingPDF, setGeneratingPDF] = useState(false)
  const handleDownloadPDF = async () => {
    if (!data) return
    setGeneratingPDF(true)
    setActionError(null)
    try {
      await generateProposalPDF({
        clientName: data.clientName,
        city: data.city,
        items: data.items,
        total: data.total,
        mockup: data.mockup,
      })
    } catch (err: any) {
      setActionError(err.message || 'Error al generar el PDF')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const WA_CAPTION = 'Te paso el presupuesto. Mira si esta todo bien y si necesitas cualquier cambio me dices, vale? Atencion que con el calor tenemos cada día menos fechas disponibles.'

  const handleWhatsApp = async () => {
    if (!data) return
    setSendingWhatsApp(true)
    setActionError(null)

    try {
      const phone = data.whatsapp?.trim()
      if (!phone) throw new Error('Introduce el número de WhatsApp del cliente (campo editable arriba).')

      // Generate PDF blob
      const pdfBlob = await generateProposalBlob({
        clientName: data.clientName,
        city: data.city,
        items: data.items,
        total: data.total,
        mockup: data.mockup,
      })

      const safeName = (data.clientName || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const fileName = `Preventiva_Presupuesto_${safeName}.pdf`

      // Try Evolution API first
      const evolutionUrl = process.env.NEXT_PUBLIC_EVOLUTION_API_URL
      if (evolutionUrl) {
        await sendDocumentMessage(phone, pdfBlob, fileName, WA_CAPTION)
        return
      }

      // Fallback: open wa.me with message text
      const encoded = encodeURIComponent(WA_CAPTION)
      const digits = phone.replace(/\D/g, '')
      window.open(`https://wa.me/${digits}?text=${encoded}`, '_blank')
    } catch (err: any) {
      console.error(err)
      setActionError(err.message || 'Error al enviar WhatsApp')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (!data) return <div className="p-8 text-center">No se encontraron datos para este presupuesto.</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b sticky top-0 z-10 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-[var(--color-secondary)] leading-tight">Revisión Final</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Embudo de Ventas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/dashboard')} className="hidden md:flex font-bold text-gray-500 hover:text-navy">
              <Home className="w-4 h-4 mr-2" />
              Inicio
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="hidden md:flex">
              {isEditing ? 'Cancelar Edición' : 'Editar Manualmente'}
            </Button>
            <Button onClick={handleDownloadPDF} disabled={generatingPDF} className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-4 border border-red-200">
              {generatingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              PDF
            </Button>
            <Button onClick={handleDownloadPPTX} className="bg-gray-100 hover:bg-gray-200 text-navy font-bold px-4">
              <Download className="w-4 h-4 mr-2" />
              PPTX
            </Button>
            <Button onClick={handleConfirm} disabled={isConfirming} className="bg-navy hover:bg-navy/90 text-white font-bold px-6">
              {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
            <Button onClick={handleWhatsApp} disabled={sendingWhatsApp} className="bg-green-500 hover:bg-green-600 text-white font-extrabold px-6">
              {sendingWhatsApp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              WhatsApp
            </Button>
            <Button onClick={() => router.push(`/proposal/${id}/report`)} variant="ghost" className="hidden md:flex font-bold text-gray-500 hover:text-navy">
              <FileText className="w-4 h-4 mr-2" />
              Ver Ficha
            </Button>
            <Button onClick={() => setShowCloseModal(true)} disabled={isConfirming} className="bg-accent hover:shadow-accent/20 hover:shadow-lg text-navy font-extrabold px-6">
              <Send className="w-4 h-4 mr-2" />
              Cerrar Venta
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8 space-y-8 mt-4">
        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-red-700 text-sm font-medium flex-1">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 mb-8 uppercase text-[10px] font-black tracking-tighter text-gray-400">
          <span className="text-navy">1. Pedido</span>
          <div className="h-[2px] w-8 bg-gray-200" />
          <span className="text-navy">2. Interpretación</span>
          <div className="h-[2px] w-8 bg-gray-200" />
          <span className="text-accent bg-accent/10 px-2 py-1 rounded">3. Revisión y Ajuste</span>
          <div className="h-[2px] w-8 bg-gray-200" />
          <span>4. Instalación</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
            <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border-none overflow-hidden relative group">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-navy bg-accent/20 px-3 py-1 rounded-full">Plano de la Instalación</h2>
              </div>
              <textarea
                value={data.mockup}
                onChange={(e) => setData(prev => prev ? ({ ...prev, mockup: e.target.value }) : null)}
                className="w-full h-80 bg-navy text-accent p-6 rounded-xl font-mono text-[10px] leading-tight resize-none border-none focus:ring-2 focus:ring-accent/50 selection:bg-accent/30"
                placeholder="Genera o dibuja el plano aquí..."
                spellCheck={false}
              />
              <p className="text-[9px] text-gray-400 mt-3 italic text-center">
                * Puedes editar el plano 3D manualmente.
              </p>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Memoria de Cálculo</h2>
              <pre className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans bg-gray-50 p-4 rounded-xl">
                {data.logic}
              </pre>
            </section>
          </div>

          <div className="lg:col-span-8 space-y-8 order-1 lg:order-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-[10px] font-black uppercase text-gray-400">Cliente</span>
                <p className="text-lg font-bold text-navy truncate">{data.clientName}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-[10px] font-black uppercase text-gray-400">WhatsApp</span>
                <Input
                  value={data.whatsapp || ''}
                  onChange={e => setData(prev => prev ? { ...prev, whatsapp: e.target.value } : null)}
                  placeholder="34600000000"
                  className="border-none shadow-none p-0 h-auto text-lg font-bold text-navy focus-visible:ring-0"
                />
              </div>
              <div className="bg-navy p-6 rounded-2xl shadow-xl text-white flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase text-white/50">Total del Presupuesto</span>
                <p className="text-3xl font-black text-accent tracking-tighter">€ {data.total.toFixed(2)}</p>
              </div>
            </div>

            <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-navy tracking-tight">Detalle Técnico</h2>
                <Button size="sm" variant="outline" onClick={handleAddItem} className="rounded-full border-2 border-accent text-navy hover:bg-accent font-bold">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo Ítem
                </Button>
              </div>
              <div className="space-y-4">
                {data.items.map((item, idx) => (
                  <div key={item.id} className="group p-6 bg-white hover:bg-gray-50 dark:bg-gray-700/30 rounded-2xl border-2 border-gray-50 hover:border-accent/10 transition-all">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-accent/20 text-navy font-black flex items-center justify-center text-xs">{idx + 1}</span>
                          <Input
                            className="font-black text-navy border-none shadow-none focus-visible:ring-1 focus-visible:ring-accent group-hover:bg-white text-lg p-0 h-auto"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                          <div>
                            <Label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Largo (m)</Label>
                            <Input type="number" step="0.01" className="bg-gray-50 border-none rounded-lg font-bold" value={item.width} onChange={(e) => handleUpdateItem(item.id, 'width', Number(e.target.value))} />
                          </div>
                          <div>
                            <Label className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Alto (m)</Label>
                            <Input type="number" step="0.01" className="bg-gray-50 border-none rounded-lg font-bold" value={item.height} onChange={(e) => handleUpdateItem(item.id, 'height', Number(e.target.value))} />
                          </div>
                          <div className="flex flex-col justify-end">
                            <span className="text-[9px] font-black uppercase text-gray-400 mb-2 block">Área M²</span>
                            <span className="font-black text-navy text-lg">{item.area.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between border-l border-gray-100 pl-6 min-w-[150px]">
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase text-gray-400 block mb-1">Precio Ítem</span>
                          <div className="flex items-center gap-1">
                            <span className="font-black text-navy text-2xl tracking-tighter">€</span>
                            <Input type="number" step="0.01" className="font-black text-navy text-2xl tracking-tighter border-none p-0 h-auto w-24 text-right shadow-none focus-visible:ring-0" value={item.price} onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))} />
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" onClick={() => handleDeleteItem(item.id)}>
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    {(item.price_rule === 'Minimo' || item.price === PRICING.MIN_PRICE_PER_ITEM) && (
                      <div className="mt-4 text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-3 py-1 rounded-full inline-block">
                        * Tarifa mínima aplicada (80,00 €)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-accent/10 dark:bg-accent/5 rounded-2xl p-8 border-2 border-accent/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <RefreshCw className={`h-5 w-5 text-navy ${isReprocessing ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="font-black text-navy uppercase tracking-tight">Refinar con IA</h3>
                  <p className="text-[10px] text-navy/50 font-bold">La IA ajusta las medidas y el plano 3D automáticamente.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Input
                  placeholder="Ej: 'Quitar el techo y añadir lateral izquierdo de 1.20m...'"
                  className="bg-white border-2 border-transparent focus:border-accent rounded-xl h-14 font-medium px-6 text-navy"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReprocess()}
                />
                <Button onClick={handleReprocess} disabled={isReprocessing || !aiInstruction.trim()} className="h-14 px-8 bg-navy text-white font-black rounded-xl hover:shadow-lg">
                  Reajustar
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Close Sale Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                  <Send className="w-5 h-5 text-navy" />
                </div>
                <div>
                  <h2 className="font-black text-navy uppercase tracking-tight">Cerrar Venta</h2>
                  <p className="text-[10px] text-gray-400 font-bold">Datos de instalación para el equipo</p>
                </div>
              </div>
              <button onClick={() => { setShowCloseModal(false); setInstallDate('') }} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date & time */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-navy/60 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Fecha y hora de instalación
              </Label>
              <input
                type="datetime-local"
                required
                value={installDate}
                onChange={e => setInstallDate(e.target.value)}
                className="w-full h-12 px-4 bg-gray-50 border-none rounded-xl font-medium text-navy focus:ring-2 focus:ring-accent/50 outline-none text-sm"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-navy/60 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Dirección de instalación
              </Label>
              <Input
                placeholder="Calle, número, piso, código postal, ciudad..."
                className="h-12 bg-gray-50 border-none rounded-xl font-medium text-navy focus-visible:ring-2 focus-visible:ring-accent"
                value={installAddress}
                onChange={e => setInstallAddress(e.target.value)}
              />
            </div>

            {/* Before Photos */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-navy/60 flex items-center gap-1">
                <Camera className="w-3 h-3" /> Fotos del lugar (antes de la instalación)
              </Label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors"
                onClick={() => document.getElementById('before-photos-input')?.click()}
              >
                <Camera className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-400">Clic para subir fotos</p>
                <p className="text-[10px] text-gray-300">Múltiples imágenes permitidas</p>
                <input
                  id="before-photos-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleBeforePhotoSelect}
                />
              </div>
              {beforePhotoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {beforePhotoUrls.map((url, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden aspect-square">
                      <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeBeforePhoto(i)}
                        className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Installer Notes */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-navy/60">Notas para el instalador</Label>
              <textarea
                placeholder="Acceso al edificio, horarios, dificultades previstas..."
                className="w-full min-h-[80px] p-4 bg-gray-50 border-none rounded-xl text-sm font-medium text-navy resize-none focus:ring-2 focus:ring-accent/30 outline-none"
                value={installNotes}
                onChange={e => setInstallNotes(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCloseSale}
                disabled={isConfirming}
                className="flex-1 h-14 bg-accent hover:bg-accent/90 text-navy font-black rounded-xl shadow-lg hover:shadow-xl"
              >
                {(isConfirming || uploadingPhotos) ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />{uploadingPhotos ? 'Subiendo fotos...' : 'Cerrando...'}</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Confirmar y Cerrar Venta</>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowCloseModal(false); setInstallDate('') }}
                disabled={isConfirming}
                className="h-14 px-6 text-gray-500 font-bold rounded-xl hover:bg-gray-100"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
