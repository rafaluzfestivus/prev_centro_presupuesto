'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COMPANIES, type UserProfile } from '@/lib/profile'

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
                const { data: created } = await supabase
                    .from('profiles')
                    .insert({ id: user.id, company_id: 1 })
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
