import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/upload
 * Recebe um arquivo via multipart/form-data e faz upload para o Supabase Storage
 * usando a service role key (bypassa RLS).
 * Body: FormData com campos "file" (File) e "path" (string)
 */
export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    try {
        const form = await req.formData()
        const file = form.get('file') as File | null
        const path = form.get('path') as string | null
        const bucket = (form.get('bucket') as string | null) || 'proposals'

        if (!file || !path) {
            return NextResponse.json({ error: 'Faltam campos: file e path' }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { error } = await supabase.storage
            .from(bucket)
            .upload(path, buffer, { contentType: file.type, upsert: false })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
        return NextResponse.json({ url: publicUrl })
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
