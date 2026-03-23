'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { getSalesAction } from '@/actions/proposal'
import {
    TrendingUp, Euro, Layers, Users, ClipboardList,
    RefreshCw, MapPin, Phone, Calendar, Search,
    AlertCircle, X
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

type Preset = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'

function startOf(unit: 'day' | 'week' | 'month' | 'year'): Date {
    const d = new Date()
    if (unit === 'day') { d.setHours(0, 0, 0, 0); return d }
    if (unit === 'week') { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d }
    if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d }
    d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d
}

function toInputDate(d: Date) {
    return d.toISOString().slice(0, 10)
}

export default function VentasPage() {
    const router = useRouter()
    const [sales, setSales] = useState<SaleRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Filters
    const [search, setSearch] = useState('')
    const [preset, setPreset] = useState<Preset>('month')
    const [dateFrom, setDateFrom] = useState(toInputDate(startOf('month')))
    const [dateTo, setDateTo] = useState(toInputDate(new Date()))

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

    const applyPreset = (p: Preset) => {
        setPreset(p)
        if (p === 'today') { setDateFrom(toInputDate(startOf('day'))); setDateTo(toInputDate(new Date())) }
        else if (p === 'week') { setDateFrom(toInputDate(startOf('week'))); setDateTo(toInputDate(new Date())) }
        else if (p === 'month') { setDateFrom(toInputDate(startOf('month'))); setDateTo(toInputDate(new Date())) }
        else if (p === 'year') { setDateFrom(toInputDate(startOf('year'))); setDateTo(toInputDate(new Date())) }
        else if (p === 'all') { setDateFrom(''); setDateTo('') }
    }

    const clearSearch = () => setSearch('')

    // Filtered dataset
    const filtered = useMemo(() => {
        return sales.filter(sale => {
            // Search filter
            if (search.trim()) {
                const q = search.toLowerCase()
                const match = (sale.cliente_nome || '').toLowerCase().includes(q) ||
                    (sale.cidade || '').toLowerCase().includes(q) ||
                    (sale.whatsapp || '').includes(q) ||
                    (sale.installation_address || '').toLowerCase().includes(q)
                if (!match) return false
            }
            // Date filter
            if (preset !== 'all' && (dateFrom || dateTo)) {
                const saleDate = new Date(sale.data_confirmacao || sale.data_criacao)
                if (dateFrom && saleDate < new Date(dateFrom)) return false
                if (dateTo) {
                    const end = new Date(dateTo); end.setHours(23, 59, 59, 999)
                    if (saleDate > end) return false
                }
            }
            return true
        })
    }, [sales, search, preset, dateFrom, dateTo])

    // Aggregates over filtered set
    const totalRevenue = filtered.reduce((s, v) => s + (Number(v.total_geral) || 0), 0)
    const totalM2 = filtered.reduce((s, v) => s + (v.totalM2 || 0), 0)
    const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0

    const stats = [
        { label: 'Facturación Total', value: `€ ${totalRevenue.toFixed(2)}`, icon: Euro, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Ventas Confirmadas', value: filtered.length, icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10' },
        { label: 'Total m² Instalados', value: `${totalM2.toFixed(2)} m²`, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Ticket Médio', value: `€ ${avgTicket.toFixed(2)}`, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    ]

    const presets: { key: Preset; label: string }[] = [
        { key: 'today', label: 'Hoy' },
        { key: 'week', label: 'Esta semana' },
        { key: 'month', label: 'Este mes' },
        { key: 'year', label: 'Este año' },
        { key: 'all', label: 'Todo' },
        { key: 'custom', label: 'Personalizado' },
    ]

    const isFiltered = search.trim() || preset !== 'all'

    return (
        <DashboardLayout>
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Índice de <span className="accent-text">Ventas</span></h1>
                    <p className="text-text-muted">Ventas confirmadas — clientes, valores, direcciones e instalaciones.</p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* Filter bar */}
            <div className="bg-white border border-border rounded-2xl p-4 mb-8 flex flex-wrap gap-4 items-end">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Buscar</label>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cliente, ciudad, dirección…"
                            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-xl focus:outline-none focus:border-accent text-navy"
                        />
                        {search && (
                            <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Period presets */}
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Período</label>
                    <div className="flex gap-1 flex-wrap">
                        {presets.map(p => (
                            <button
                                key={p.key}
                                onClick={() => applyPreset(p.key)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${preset === p.key
                                    ? 'bg-navy text-white'
                                    : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom date range — visible always but highlighted when preset=custom */}
                <div className="flex gap-2 items-end">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Desde</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPreset('custom') }}
                            className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:border-accent text-navy ${preset === 'custom' ? 'border-accent' : 'border-border'}`}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Hasta</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPreset('custom') }}
                            className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:border-accent text-navy ${preset === 'custom' ? 'border-accent' : 'border-border'}`}
                        />
                    </div>
                </div>
            </div>

            {/* Stats — reflect filtered data */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                {isFiltered && (
                    <div className="px-4 py-2.5 bg-accent/5 border-b border-border flex items-center gap-2 text-xs text-accent font-bold">
                        <Search size={12} />
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
                        {sales.length !== filtered.length && (
                            <span className="text-text-muted font-normal ml-1">de {sales.length} en total</span>
                        )}
                    </div>
                )}
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
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-12 text-center text-text-muted">
                                    {sales.length === 0
                                        ? 'No hay ventas confirmadas aún.'
                                        : 'Ninguna venta coincide con los filtros aplicados.'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((sale) => (
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

                {filtered.length > 0 && (
                    <div className="p-4 bg-navy/5 border-t border-border flex justify-end gap-8 text-sm font-black text-navy">
                        <span>Total m²: {totalM2.toFixed(2)}</span>
                        <span>Ventas: {filtered.length}</span>
                        <span>Facturación: € {totalRevenue.toFixed(2)}</span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
