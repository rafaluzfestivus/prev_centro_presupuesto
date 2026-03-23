'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { getSalesAction } from '@/actions/proposal'
import {
    TrendingUp, Euro, Layers, Users, ClipboardList,
    RefreshCw, MapPin, Phone, Calendar, ChevronRight,
    AlertCircle
} from 'lucide-react'

interface SaleRow {
    id: string
    cliente_nome: string
    cidade: string
    whatsapp?: string
    data_confirmacao?: string
    data_criacao: string
    total_geral?: number
    installation_address?: string
    installation_notes?: string
    totalM2: number
    totalItems: number
    items: any[]
}

export default function VentasPage() {
    const router = useRouter()
    const [sales, setSales] = useState<SaleRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = async () => {
        setLoading(true)
        setError('')
        const result = await getSalesAction()
        if (result.success && result.data) {
            setSales(result.data as SaleRow[])
        } else {
            setError(result.error || 'Error al cargar ventas')
        }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    // Aggregates
    const totalRevenue = sales.reduce((s, v) => s + (Number(v.total_geral) || 0), 0)
    const totalM2 = sales.reduce((s, v) => s + (v.totalM2 || 0), 0)
    const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0

    const stats = [
        {
            label: 'Facturación Total',
            value: `€ ${totalRevenue.toFixed(2)}`,
            icon: Euro,
            color: 'text-green-600',
            bg: 'bg-green-50'
        },
        {
            label: 'Ventas Confirmadas',
            value: sales.length,
            icon: TrendingUp,
            color: 'text-accent',
            bg: 'bg-accent/10'
        },
        {
            label: 'Total m² Instalados',
            value: `${totalM2.toFixed(2)} m²`,
            icon: Layers,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            label: 'Ticket Médio',
            value: `€ ${avgTicket.toFixed(2)}`,
            icon: Users,
            color: 'text-purple-600',
            bg: 'bg-purple-50'
        },
    ]

    return (
        <DashboardLayout>
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Índice de <span className="accent-text">Ventas</span></h1>
                    <p className="text-text-muted">Todas las ventas confirmadas — clientes, valores, direcciones e instalaciones.</p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {stats.map((s) => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="glass-card p-6 bg-white border-none shadow-sm">
                            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-4`}>
                                <Icon size={20} className={s.color} />
                            </div>
                            <p className="text-2xl font-black text-navy">{s.value}</p>
                            <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">{s.label}</p>
                        </div>
                    )
                })}
            </div>

            {error && (
                <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden border-none shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b-2 border-border text-navy text-xs uppercase tracking-wider">
                            <th className="p-4 font-bold">Cliente</th>
                            <th className="p-4 font-bold">Ciudad</th>
                            <th className="p-4 font-bold">Dirección</th>
                            <th className="p-4 font-bold">WhatsApp</th>
                            <th className="p-4 font-bold text-right">m²</th>
                            <th className="p-4 font-bold text-right">Piezas</th>
                            <th className="p-4 font-bold text-right">Total</th>
                            <th className="p-4 font-bold text-center">Fecha</th>
                            <th className="p-4 font-bold text-center">Ficha</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/50">
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="p-12 text-center text-text-muted">
                                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                                    Cargando ventas...
                                </td>
                            </tr>
                        ) : sales.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-12 text-center text-text-muted">
                                    No hay ventas confirmadas aún.
                                </td>
                            </tr>
                        ) : (
                            sales.map((sale, idx) => (
                                <tr
                                    key={sale.id}
                                    className="border-b border-border hover:bg-white transition-colors cursor-pointer group"
                                    onClick={() => router.push(`/proposal/${sale.id}/report`)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center font-black text-sm shrink-0">
                                                {(sale.cliente_nome || '?')[0].toUpperCase()}
                                            </div>
                                            <span className="font-bold text-navy text-sm">{sale.cliente_nome || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-text-muted font-medium">{sale.cidade || '—'}</td>
                                    <td className="p-4">
                                        {sale.installation_address ? (
                                            <div className="flex items-start gap-1.5 text-sm text-navy max-w-[200px]">
                                                <MapPin size={13} className="text-accent shrink-0 mt-0.5" />
                                                <span className="truncate" title={sale.installation_address}>{sale.installation_address}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-text-muted/50 italic">Sin dirección</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {sale.whatsapp ? (
                                            <div className="flex items-center gap-1.5 text-sm text-navy">
                                                <Phone size={13} className="text-text-muted shrink-0" />
                                                <span>{sale.whatsapp}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-text-muted/50 italic">—</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right font-bold text-navy text-sm">{sale.totalM2.toFixed(2)}</td>
                                    <td className="p-4 text-right text-sm text-text-muted font-medium">{sale.totalItems}</td>
                                    <td className="p-4 text-right">
                                        <span className="font-black text-navy text-sm">
                                            € {Number(sale.total_geral || 0).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted font-medium">
                                            <Calendar size={12} />
                                            {sale.data_confirmacao
                                                ? new Date(sale.data_confirmacao).toLocaleDateString('es-ES')
                                                : new Date(sale.data_criacao).toLocaleDateString('es-ES')}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); router.push(`/proposal/${sale.id}/report`) }}
                                            className="p-2 bg-navy/5 text-navy rounded-lg hover:bg-navy hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                            title="Ver Ficha de Instalación"
                                        >
                                            <ClipboardList size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {sales.length > 0 && (
                    <div className="p-4 bg-navy/5 border-t border-border flex justify-end gap-8 text-sm font-black text-navy">
                        <span>Total m²: {totalM2.toFixed(2)}</span>
                        <span>Ventas: {sales.length}</span>
                        <span>Facturación: € {totalRevenue.toFixed(2)}</span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
