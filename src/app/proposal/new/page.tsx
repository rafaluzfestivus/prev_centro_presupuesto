import { redirect } from 'next/navigation'
import { createProposalAction } from '@/actions/proposal'

interface Props {
    searchParams: Promise<{
        name?: string
        whatsapp?: string
        message?: string
        source?: string
    }>
}

// Server component: creates the proposal from URL params (e.g. from LeadsManager)
// then redirects to the builder. No UI needed — the redirect is immediate.
export default async function NewProposalPage({ searchParams }: Props) {
    const sp = await searchParams
    const name = (sp.name ?? '').trim() || 'Cliente'

    const result = await createProposalAction({
        clientName: name,
        city: 'Preventiva Centro',
        observations: sp.message,
        whatsapp: sp.whatsapp,
    })

    if (!result.success || !result.id) {
        redirect('/dashboard/presupuestos')
    }

    redirect(`/proposal/${result.id}/builder`)
}
