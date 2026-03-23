'use server'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ONE-TIME cleanup: delete appointments created by closeSaleAction
// These are identified by notes containing "Venta cerrada desde presupuesto"
// Manual calendar appointments and proposals are NOT affected.
export async function POST() {
    try {
        const supabase = await createClient()

        const { data: deleted, error } = await supabase
            .from('appointments')
            .delete()
            .like('notes', '%Venta cerrada desde presupuesto%')
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
