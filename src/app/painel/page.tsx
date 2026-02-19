'use client'


import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProposalAction, getProposalsAction, deleteProposalAction } from '@/actions/proposal'
import { Proposal } from '@/lib/types'
import { Loader2, Upload, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'


export default function DashboardPage() {
    const router = useRouter()

    // History data
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [loadingHistory, setLoadingHistory] = useState(true)

    // New Proposal Form State
    const [clientName, setClientName] = useState('')
    const [city, setCity] = useState('')
    const [measurements, setMeasurements] = useState('')
    const [observations, setObservations] = useState('')
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
                        if (file) {
                            setSelectedFile(file)
                            break
                        }
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
        if (result.success && result.data) {
            setProposals(result.data)
        }
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

                const { error: uploadError } = await supabase.storage
                    .from('proposals')
                    .upload(fileName, selectedFile)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('proposals')
                    .getPublicUrl(fileName)

                imageUrl = publicUrl
                setUploading(false)
            }

            if (!measurements && !imageUrl) {
                alert('Por favor, ingresa las medidas o sube una imagen.')
                setLoading(false)
                return
            }

            const result = await createProposalAction({
                clientName,
                city,
                measurements,
                observations,
                imageUrl
            })

            if (result.success && result.id) {
                router.push(`/proposal/${result.id}/processing`)
            } else {
                alert('Erro ao criar proposta: ' + (result.error || 'Erro desconhecido'))
            }
        } catch (error) {
            console.error(error)
            alert('Erro ao criar proposta')
        } finally {
            setLoading(false)
            setUploading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }

    const clearFile = () => {
        setSelectedFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // Removed form-level onPaste in favor of global listener


    const handleLogout = () => {
        // Implement logout logic
        router.push('/login')
    }

    const handleDeleteProposal = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm('¿Estás seguro de que quieres eliminar esta propuesta?')) {
            const result = await deleteProposalAction(id)
            if (result.success) {
                loadProposals()
            } else {
                alert('Erro ao excluir proposta')
            }
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white font-bold">P</div>
                        <h1 className="text-xl font-bold text-[var(--color-secondary)]">Preventiva Propuestas - Histórico</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
                            Cerrar sesión
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Column: New Proposal */}
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-fit">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 border-b pb-2">Nueva Propuesta</h2>
                    <form className="space-y-4" onSubmit={handleGenerate}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="clientName">Nombre del cliente</Label>
                                <Input
                                    id="clientName"
                                    required
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    placeholder="Ej: Ana Garcia"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Ciudad</Label>
                                <Input
                                    id="city"
                                    required
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="Ej: Madrid"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="measurements">Medidas (Texto libre)</Label>
                            <textarea
                                id="measurements"
                                required={!selectedFile}
                                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Pegue aqui o texto do WhatsApp ou digite as medidas..."
                                value={measurements}
                                onChange={(e) => setMeasurements(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Ex: "2 janelas de 1.20 x 1.40 e uma varanda de 3m x 2m"
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="observations">Observaciones (Opcional)</Label>
                            <Input
                                id="observations"
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                placeholder="Ej: Cliente quer instalação urgente"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="file">Imagen / Diseño (Opcional)</Label>
                            {!selectedFile ? (
                                <div
                                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-500">Clic para subir imagen</span>
                                    <input
                                        type="file"
                                        id="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                                        <img
                                            src={URL.createObjectURL(selectedFile)}
                                            alt="Preview"
                                            className="w-full h-48 object-contain bg-black/5"
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md bg-white/80 hover:bg-white"
                                            onClick={clearFile}
                                        >
                                            <X className="h-4 w-4 text-gray-700" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-center text-gray-500 truncate px-2">{selectedFile.name}</p>
                                </div>
                            )}
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? (uploading ? 'Subiendo imagen...' : 'Procesando...') : 'Generar Propuesta con IA'}
                        </Button>
                    </form>
                </section>

                {/* Right Column: History */}
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historial</h2>
                        <Button variant="ghost" size="sm" onClick={loadProposals} disabled={loadingHistory}>
                            <Loader2 className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    <div className="mb-4">
                        <Input placeholder="Buscar por cliente..." className="w-full" />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {loadingHistory ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            </div>
                        ) : proposals.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                No hay propuestas generadas.
                            </div>
                        ) : (
                            proposals.map((proposal) => (
                                <div
                                    key={proposal.id}
                                    className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 hover:border-[var(--color-primary)] transition-colors cursor-pointer group"
                                    onClick={() => router.push(proposal.status === 'Rascunho' ? `/proposal/${proposal.id}/processing` : `/proposal/${proposal.id}/review`)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100">{proposal.cliente_nome}</h3>
                                            <p className="text-sm text-gray-500">{proposal.cidade}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${proposal.status === 'Confirmada' ? 'bg-green-100 text-green-700' :
                                            proposal.status === 'Processada' ? 'bg-blue-100 text-blue-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {proposal.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">{new Date(proposal.data_criacao).toLocaleDateString()}</span>
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {proposal.total_geral ? `€ ${Number(proposal.total_geral).toFixed(2)}` : '-'}
                                        </span>
                                    </div>
                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={(e) => handleDeleteProposal(e, proposal.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 text-[var(--color-primary)]">
                                            {proposal.status === 'Rascunho' ? 'Continuar' : 'Ver Detalles'}
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>


            </main>
        </div>
    )
}
