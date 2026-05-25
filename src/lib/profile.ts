import { createClient } from '@/lib/supabase/server'
import { COMPANIES } from '@/lib/companies'

export { COMPANIES }

export interface UserProfile {
    id: string
    company_id: number
    display_name: string | null
}

export async function getUserProfile(): Promise<UserProfile> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { id: '', company_id: 1, display_name: null }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id, display_name')
        .eq('id', user.id)
        .single()

    if (profile) return profile as UserProfile

    // Auto-create profile for new users (defaults to Centro)
    const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, company_id: 1 })
        .select('id, company_id, display_name')
        .single()

    return (created ?? { id: user.id, company_id: 1, display_name: null }) as UserProfile
}
