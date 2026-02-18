'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { processProposalWithAIAction } from '@/actions/proposal'

const STEPS = [
    "Organizando medidas...",
    "Aplicando reglas de cálculo...",
    "Generando mockup ASCII...",
    "Finalizando propuesta..."
]

export default function ProcessingPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [currentStep, setCurrentStep] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const processingRef = useRef(false)

    useEffect(() => {
        if (processingRef.current) return
        processingRef.current = true

        const processProposal = async () => {
            try {
                // Start animation
                const interval = setInterval(() => {
                    setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev))
                }, 1500)

                // Call Server Action
                const result = await processProposalWithAIAction(id)

                clearInterval(interval)
                setCurrentStep(STEPS.length - 1)

                if (!result.success) {
                    throw new Error(result.error || 'Falha no processamento')
                }

                // Redirect
                setTimeout(() => router.push(`/proposal/${id}/review`), 1000)

            } catch (err: any) {
                console.error(err)
                setError(err.message || 'Error processing')
            }
        }

        processProposal()
    }, [id, router])

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center text-red-500 flex-col gap-4">
                <p>Error: {error}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded">Tentar Novamente</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">

                <div className="flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-[var(--color-primary)] opacity-20 rounded-full animate-ping"></div>
                        <div className="relative bg-white dark:bg-gray-700 p-4 rounded-full shadow-sm">
                            <Loader2 className="h-12 w-12 text-[var(--color-primary)] animate-spin" />
                        </div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-[var(--color-secondary)]">
                    Procesando propuesta
                </h2>

                <div className="space-y-4">
                    {STEPS.map((step, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-3 transition-all duration-500 ${index === currentStep
                                ? 'opacity-100 transform scale-105 font-medium text-[var(--color-primary)]'
                                : index < currentStep
                                    ? 'opacity-40 text-gray-400'
                                    : 'opacity-10 text-gray-300'
                                }`}
                        >
                            <div className={`h-2 w-2 rounded-full ${index <= currentStep ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />
                            <span>{step}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
