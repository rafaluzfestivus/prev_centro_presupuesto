'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COMPANIES } from '@/lib/companies'
import type { UserProfile } from '@/lib/profile'

export { COMPANIES }
export type { UserProfile }

export function useProfile() {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) { setLoading(false); return }

            let { data } = await supabase
                .from('profiles')
                .select('id, company_id, display_name')
                .eq('id', user.id)
                .single()

            if (!data) {
                // company_id is intentionally omitted — the DB column default
                // (1) applies; authenticated users can't set it directly
                // (see migration 010_lock_profile_columns.sql).
                const { data: created } = await supabase
                    .from('profiles')
                    .insert({ id: user.id })
                    .select('id, company_id, display_name')
                    .single()
                data = created
            }

            setProfile(data as UserProfile)
            setLoading(false)
        })
    }, [])

    const company = profile ? COMPANIES[profile.company_id] : null

    return { profile, loading, company }
}
