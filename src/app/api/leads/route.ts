import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Resolve company_id from the request token.
// Configure LEADS_TOKEN_CENTRO and LEADS_TOKEN_ESTE in Vercel env vars.
// The website form sends the token in the request body.
function resolveCompanyId(token: string): number | null {
    const centro = process.env.LEADS_TOKEN_CENTRO
    const este   = process.env.LEADS_TOKEN_ESTE
    if (centro && token === centro) return 1
    if (este   && token === este)   return 2
    return null
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        const { token, name, email, whatsapp, message, location, postal_code, service_requested } = body

        if (!token) {
            return NextResponse.json({ ok: false, error: 'Token obrigatório' }, { status: 401, headers: CORS_HEADERS })
        }

        const companyId = resolveCompanyId(token)
        if (!companyId) {
            return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 403, headers: CORS_HEADERS })
        }

        if (!name && !whatsapp && !email) {
            return NextResponse.json({ ok: false, error: 'Nome, email ou whatsapp são obrigatórios' }, { status: 400, headers: CORS_HEADERS })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )

        const { data, error } = await supabase
            .from('clients')
            .upsert({
                name:              name || whatsapp || email || 'Desconhecido',
                email:             email   || null,
                whatsapp:          whatsapp || null,
                message:           message  || null,
                location:          location || null,
                postal_code:       postal_code || null,
                service_requested: service_requested || null,
                source:            'site',
                status:            'new',
                company_id:        companyId,
              }, { onConflict: 'whatsapp' })
            .select('id')
            .single()

        if (error) {
            console.error('[/api/leads]', error)
            return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: CORS_HEADERS })
        }

        return NextResponse.json({ ok: true, id: data.id }, { headers: CORS_HEADERS })
    } catch (err) {
        console.error('[/api/leads]', err)
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: CORS_HEADERS })
    }
}
