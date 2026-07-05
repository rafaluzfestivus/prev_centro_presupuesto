import { NextResponse } from 'next/server'
import { appendFechamentoRow } from '@/lib/googleSheets'

export async function GET() {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL

    if (!webhookUrl) {
        return NextResponse.json({
            ok: false,
            step: 'env_var',
            error: 'GOOGLE_SHEETS_WEBHOOK_URL não está configurado no Vercel',
        }, { status: 500 })
    }

    try {
        await appendFechamentoRow({
            date: new Date(),
            clientName: 'TESTE AUTOMÁTICO',
            valorCobrado: 500,
            totalM2: 10,
        })

        return NextResponse.json({
            ok: true,
            message: 'Linha de teste inserida com sucesso na folha!',
            webhookUrl: webhookUrl.slice(0, 60) + '…',
        })
    } catch (err: any) {
        return NextResponse.json({
            ok: false,
            step: 'webhook_call',
            error: err.message,
            webhookUrl: webhookUrl.slice(0, 60) + '…',
        }, { status: 500 })
    }
}
