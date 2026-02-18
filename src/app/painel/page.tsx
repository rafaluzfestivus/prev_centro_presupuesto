'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Type definition for Proposal (Mock)
type Proposal = {
    id: string
    clientName: string
    city: string
    date: string
    total: string
    status: 'Rascunho' | 'Processada' | 'Confirmada'
}

export default function DashboardPage() {
    const router = useRouter()
    // Mock history data
    const [proposals, setProposals] = useState<Proposal[]>([
        { id: '1', clientName: 'Maria Silva', city: 'Madrid', date: '2023-10-25', total: '€ 450,00', status: 'Confirmada' },
        { id: '2', clientName: 'Juan Perez', city: 'Móstoles', date: '2023-10-26', total: '€ 280,00', status: 'Rascunho' },
    ])

    // New Proposal Form State
    const [clientName, setClientName] = useState('')
    const [city, setCity] = useState('')
    const [measurements, setMeasurements] = useState('')
    const [observations, setObservations] = useState('')
    const [loading, setLoading] = useState(false)

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        // In a real app, we would create a "Draft" proposal in DB first to get an ID.
        // For this MVP, we will pass the data via localStorage or Context to the processing page,
        // or just simulate the ID since we are focusing on the AI flow.
        // Let's create a temporary ID.
        const tempId = crypto.randomUUID()

        // Save input to localStorage to retrieve it in the processing/review steps if needed, 
        // or ideally we should save to DB here. 
        // For now, let's assume we redirect to processing and the processing page handles the API call.
        // But wait, the processing page needs the INPUT data to send to the API.
        // So we should probably call the API *here* or pass the data.

        // Better flow for MVP: 
        // 1. Create Draft in DB (Proposta table) - skipping for speed, we'll use localStorage
        localStorage.setItem(`proposal_${tempId}_input`, JSON.stringify({
            clientName,
            city,
            measurements,
            observations
        }))

        router.push(`/proposal/${tempId}/processing`)
    }

    const handleLogout = () => {
        // Implement logout logic
        router.push('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white font-bold">P</div>
                        <h1 className="text-xl font-bold text-[var(--color-secondary)]">Preventiva Propuestas</h1>
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
                                required
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

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Procesando...' : 'Generar Propuesta con IA'}
                        </Button>
                    </form>
                </section>

                {/* Right Column: History */}
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-[600px]">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 border-b pb-2">Historial</h2>
                    <div className="mb-4">
                        <Input placeholder="Buscar por cliente..." className="w-full" />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {proposals.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                No hay propuestas generadas.
                            </div>
                        ) : (
                            proposals.map((proposal) => (
                                <div key={proposal.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 hover:border-[var(--color-primary)] transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100">{proposal.clientName}</h3>
                                            <p className="text-sm text-gray-500">{proposal.city}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${proposal.status === 'Confirmada' ? 'bg-green-100 text-green-700' :
                                                proposal.status === 'Processada' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {proposal.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">{proposal.date}</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{proposal.total}</span>
                                    </div>
                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                        <Button variant="ghost" size="sm" className="h-8 text-[var(--color-primary)]">Ver Detalhes</Button>
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
