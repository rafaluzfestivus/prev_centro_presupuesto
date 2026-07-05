/**
 * Appends a row to the Fechamentos Google Sheet via Google Apps Script webhook.
 *
 * Required env var:
 *   GOOGLE_SHEETS_WEBHOOK_URL  — URL do web app publicado no Google Apps Script
 *
 * Setup: see README or instructions in the app.
 */

const SPREADSHEET_ID = '1ZbxC3OxwacQJ5OnJdOuRs6ecIZiO2zHi7GZoA_yRunc'

export interface ClosedSaleRow {
    date: Date
    clientName: string
    valorCobrado: number  // base amount without IVA
    totalM2: number
}

export async function appendFechamentoRow(sale: ClosedSaleRow): Promise<void> {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL

    if (!webhookUrl) {
        throw new Error('GOOGLE_SHEETS_WEBHOOK_URL não configurado')
    }

    const d = sale.date
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    const instaladores = parseFloat((sale.totalM2 * 6).toFixed(2))
    const iva          = parseFloat((sale.valorCobrado * 0.21).toFixed(2))
    const saldo        = parseFloat((sale.valorCobrado - instaladores).toFixed(2))
    const valorConIva  = parseFloat((sale.valorCobrado + iva).toFixed(2))

    const payload = {
        spreadsheetId: SPREADSHEET_ID,
        row: [dateStr, timeStr, sale.clientName, sale.valorCobrado, sale.totalM2, instaladores, iva, saldo, valorConIva],
    }

    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Erro no webhook Google Sheets: ${res.status} — ${body}`)
    }
}
