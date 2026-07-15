import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ONE-TIME SETUP ROUTE — delete after use
// Call: GET /api/admin-setup-users?secret=preventiva2026

export async function GET(req: Request) {
    const secret = new URL(req.url).searchParams.get('secret')
    if (secret !== 'preventiva2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const users = [
        { email: 'carvalhodlucas@gmail.com', password: '45123',     name: 'Lucas Carvalho',    company_id: 1 },
        { email: 'omachadojean@gmail.com',   password: 'havaianas',  name: 'Jean Marcel Gatti', company_id: 1 },
    ]

    const results: any[] = []

    for (const u of users) {
        // Delete existing user if any
        const { data: existing } = await supabase.auth.admin.listUsers()
        const found = existing?.users?.find((x: any) => x.email === u.email)

        if (found) {
            await supabase.auth.admin.deleteUser(found.id)
        }

        // Create fresh via admin API
        const { data, error } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { display_name: u.name },
        })

        if (error) {
            results.push({ email: u.email, error: error.message })
            continue
        }

        // Upsert profile
        await supabase.from('profiles').upsert({
            id: data.user.id,
            company_id: u.company_id,
            display_name: u.name,
            is_admin: false,
        })

        results.push({ email: u.email, id: data.user.id, ok: true })
    }

    return NextResponse.json({ results })
}
