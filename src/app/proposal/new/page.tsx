import { redirect } from 'next/navigation'
import { createProposalAction } from '@/actions/proposal'
import { getUserProfile, COMPANIES } from '@/lib/profile'

interface Props {
    searchParams: Promise<{
        name?: string
        whatsapp?: string
        message?: string
        source?: string
    }>
}

// Server component: creates the proposal from URL params (e.g. from LeadsManager)
// then redirects to the builder. company_id and city come from the logged-in user's profile.
export default async function NewProposalPage({ searchParams }: Props) {
    const sp = await searchParams
    const name = (sp.name ?? '').trim() || 'Cliente'

    const profile = await getUserProfile()
    const company = COMPANIES[profile.company_id]

    const result = await createProposalAction({
        clientName: name,
        city: company?.name ?? 'Preventiva Centro',
        observations: sp.message,
        whatsapp: sp.whatsapp,
    })

    if (!result.success || !result.id) {
        redirect('/dashboard/presupuestos')
    }

    redirect(`/proposal/${result.id}/builder`)
}
