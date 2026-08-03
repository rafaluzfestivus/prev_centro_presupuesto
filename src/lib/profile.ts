import { createClient } from '@/lib/supabase/server'
import { COMPANIES } from '@/lib/companies'

export { COMPANIES }

export interface UserProfile {
    id: string
    company_id: number
    display_name: string | null
    is_admin: boolean
}

export async function getUserProfile(): Promise<UserProfile> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { id: '', company_id: 1, display_name: null, is_admin: false }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id, display_name, is_admin')
        .eq('id', user.id)
        .single()

    if (profile) return profile as UserProfile

    // Auto-create profile for new users. company_id/is_admin are intentionally
    // omitted — the DB column defaults (company_id=1, is_admin=false) apply,
    // and the authenticated role no longer has write privilege on those columns
    // (see migration 010_lock_profile_columns.sql).
    const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id })
        .select('id, company_id, display_name, is_admin')
        .single()

    return (created ?? { id: user.id, company_id: 1, display_name: null, is_admin: false }) as UserProfile
}
