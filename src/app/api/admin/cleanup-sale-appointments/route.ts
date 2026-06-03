import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/profile'
import { NextResponse } from 'next/server'

// ONE-TIME cleanup: delete appointments created by closeSaleAction
// These are identified by notes containing "Venta cerrada desde presupuesto"
// Manual calendar appointments and proposals are NOT affected.
export async function POST() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
        }

        const profile = await getUserProfile()

        const { data: deleted, error } = await supabase
            .from('appointments')
            .delete()
            .like('notes', '%Venta cerrada desde presupuesto%')
            .eq('company_id', profile.company_id)
            .select('id')

        if (error) throw error

        return NextResponse.json({
            success: true,
            deleted: deleted?.length ?? 0,
            message: `${deleted?.length ?? 0} appointments de vendas fechadas removidos.`
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
