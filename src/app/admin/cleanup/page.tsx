'use client'

import { useState } from 'react'

export default function CleanupPage() {
    const [status, setStatus] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleCleanup() {
        if (!confirm('Tem certeza? Isso vai deletar todas as vendas fechadas da agenda.')) return
        setLoading(true)
        try {
            const res = await fetch('/api/admin/cleanup-sale-appointments', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                setStatus(`✅ Pronto! ${data.message}`)
            } else {
                setStatus(`❌ Erro: ${data.error}`)
            }
        } catch {
            setStatus('❌ Erro ao conectar.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 500 }}>
            <h1>Limpeza de Vendas Fechadas</h1>
            <p>Clique no botão abaixo para remover os appointments de vendas fechadas da agenda.</p>
            <p style={{ color: '#666', fontSize: 14 }}>
                ⚠️ Orçamentos e visitas manuais <strong>não serão afetados</strong>.
            </p>
            <button
                onClick={handleCleanup}
                disabled={loading}
                style={{
                    padding: '12px 24px',
                    background: loading ? '#ccc' : '#e53e3e',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 16,
                }}
            >
                {loading ? 'A limpar...' : 'Limpar Vendas Fechadas'}
            </button>
            {status && (
                <p style={{ marginTop: 20, fontWeight: 'bold' }}>{status}</p>
            )}
        </div>
    )
}
