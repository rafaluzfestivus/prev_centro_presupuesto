'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { getSalesAction } from '@/actions/proposal'
import {
    TrendingUp, Euro, Layers, Users, ClipboardList,
    RefreshCw, MapPin, Phone, Calendar, Search,
    AlertCircle, X, Pencil
} from 'lucide-react'

interface SaleRow {
    appointmentId: string
    appointmentStatus: string
    scheduledAt: string
    cliente_nome: string
    whatsapp: string
    cidade: string
    proposalId: string | null
    installation_address: string
    total_geral: number
    items: any[]
    totalM2: number
    totalItems: number
}

type Preset = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pendiente',  cls: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completada', cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelada',  cls: 'bg-red-100 text-red-500' },
}

function startOf(unit: 'day' | 'week' | 'month' | 'year'): Date {
    const d = new Date()
    if (unit === 'day')   { d.setHours(0, 0, 0, 0); return d }
    if (unit === 'week')  { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d }
    if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d }
    d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d
}

function toInputDate(d: Date) { return d.toISOString().slice(0, 10) }

export default function VentasPage() {
    const router = useRouter()
    const [sales, setSales] = useState<SaleRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [search, setSearch] = useState('')
    const [preset, setPreset] = useState<Preset>('month')
    const [dateFrom, setDateFrom] = useState(toInputDate(startOf('month')))
    const [dateTo, setDateTo] = useState(toInputDate(new Date()))

    const load = async () => {
        setLoading(true); setError('')
        const result = await getSalesAction()
        if (result.success && result.data) setSales(result.data as SaleRow[])
        else setError(result.error || 'Error al cargar visitas')
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const applyPreset = (p: Preset) => {
        setPreset(p)
        if (p === 'today')  { setDateFrom(toInputDate(startOf('day')));  setDateTo(toInputDate(new Date())) }
        if (p === 'week')   { setDateFrom(toInputDate(startOf('week'))); setDateTo(toInputDate(new Date())) }
        if (p === 'month')  { setDateFrom(toInputDate(startOf('month')));setDateTo(toInputDate(new Date())) }
        if (p === 'year')   { setDateFrom(toInputDate(startOf('year'))); setDateTo(toInputDate(new Date())) }
        if (p === 'all')    { setDateFrom(''); setDateTo('') }
    }

    const filtered = useMemo(() => {
        return sales.filter(s => {
            if (search.trim()) {
                const q = search.toLowerCase()
                if (!(s.cliente_nome.toLowerCase().includes(q) ||
                      s.cidade.toLowerCase().includes(q) ||
                      s.whatsapp.includes(q) ||
                      (s.installation_address || '').toLowerCase().includes(q))) return false
            }
            if (preset !== 'all' && (dateFrom || dateTo)) {
                const d = new Date(s.scheduledAt)
                if (dateFrom && d < new Date(dateFrom)) return false
                if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); if (d > end) return false }
            }
            return true
        })
    }, [sales, search, preset, dateFrom, dateTo])

    const totalRevenue = filtered.reduce((s, v) => s + (Number(v.total_geral) || 0), 0)
    const totalM2      = filtered.reduce((s, v) => s + (v.totalM2 || 0), 0)
    const avgTicket    = filtered.length > 0 ? totalRevenue / filtered.length : 0

    // Monthly chart — last 6 months from ALL sales (not filtered by preset)
    const monthlyData = useMemo(() => {
        const months: { label: string; revenue: number; count: number }[] = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = d.toLocaleDateString('es-ES', { month: 'short' })
            const rows = sales.filter(s => {
                const sd = new Date(s.scheduledAt)
                return `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}` === key
            })
            months.push({ label, revenue: rows.reduce((a, r) => a + (Number(r.total_geral) || 0), 0), count: rows.length })
        }
        return months
    }, [sales])

    const stats = [
        { label: 'Facturación Total',   value: `€ ${totalRevenue.toFixed(2)}`, icon: Euro,       color: 'text-green-600',  bg: 'bg-green-50' },
        { label: 'Visitas Agendadas',   value: filtered.length,                icon: TrendingUp,  color: 'text-accent',     bg: 'bg-accent/10' },
        { label: 'Total m² Instalados', value: `${totalM2.toFixed(2)} m²`,    icon: Layers,      color: 'text-blue-600',   bg: 'bg-blue-50' },
        { label: 'Ticket Médio',        value: `€ ${avgTicket.toFixed(2)}`,   icon: Users,       color: 'text-purple-600', bg: 'bg-purple-50' },
    ]

    const presets: { key: Preset; label: string }[] = [
        { key: 'today', label: 'Hoy' },
        { key: 'week',  label: 'Esta semana' },
        { key: 'month', label: 'Este mes' },
        { key: 'year',  label: 'Este año' },
        { key: 'all',   label: 'Todo' },
        { key: 'custom',label: 'Personalizado' },
    ]

    return (
        <DashboardLayout>
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Índice de <span className="accent-text">Ventas</span></h1>
                    <p className="text-text-muted">Visitas agendadas — clientes, valores, direcciones e instalaciones.</p>
                </div>
                <button onClick={load} disabled={loading}
                    className="p-2.5 bg-white border border-border rounded-xl text-navy hover:bg-gray-50 transition-colors">
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* Filter bar */}
            <div className="bg-white border border-border rounded-2xl p-4 mb-8 flex flex-col sm:flex-row flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-0 w-full sm:w-auto sm:min-w-[200px]">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Buscar</label>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Cliente, ciudad, dirección…"
                            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-xl focus:outline-none focus:border-accent text-navy" />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Período</label>
                    <div className="flex gap-1 flex-wrap">
                        {presets.map(p => (
                            <button key={p.key} onClick={() => applyPreset(p.key)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${preset === p.key ? 'bg-navy text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 items-end">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Desde</label>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset('custom') }}
                            className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:border-accent text-navy ${preset === 'custom' ? 'border-accent' : 'border-border'}`} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Hasta</label>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset('custom') }}
                            className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:border-accent text-navy ${preset === 'custom' ? 'border-accent' : 'border-border'}`} />
                    </div>
                </div>
            </div>

            {/* Stats */}
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

            {/* Monthly chart */}
            {!loading && sales.length > 0 && (() => {
                const maxRev = Math.max(...monthlyData.map(m => m.revenue), 1)
                return (
                    <div className="bg-white border border-border rounded-2xl p-6 mb-8">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-5">Facturación mensual — últimos 6 meses</p>
                        <div className="flex items-end gap-3 h-36">
                            {monthlyData.map((m, i) => {
                                const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                        <span className="text-[9px] font-black text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                            {m.revenue > 0 ? `€${m.revenue.toFixed(2)}` : '—'}
                                        </span>
                                        <div className="w-full relative" style={{ height: '96px' }}>
                                            <div
                                                className="absolute bottom-0 w-full rounded-t-lg bg-accent transition-all duration-500"
                                                style={{ height: `${Math.max(pct, m.revenue > 0 ? 4 : 0)}%` }}
                                            />
                                            {m.revenue === 0 && (
                                                <div className="absolute bottom-0 w-full h-1 bg-gray-100 rounded-t" />
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-text-muted capitalize">{m.label}</span>
                                        {m.count > 0 && (
                                            <span className="text-[9px] text-text-muted/60">{m.count} vis.</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}

            {error && (
                <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle size={16} className="shrink-0" /><span>{error}</span>
                </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden border-none shadow-sm overflow-x-auto">
                {(search.trim() || preset !== 'all') && (
                    <div className="px-4 py-2.5 bg-accent/5 border-b border-border flex items-center gap-2 text-xs text-accent font-bold">
                        <Search size={12} />
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
                        {sales.length !== filtered.length && <span className="text-text-muted font-normal ml-1">de {sales.length} en total</span>}
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
                            <th className="p-4 font-bold text-center">Visita</th>
                            <th className="p-4 font-bold text-center">Estado</th>
                            <th className="p-4 font-bold text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/50">
                        {loading ? (
                            <tr><td colSpan={10} className="p-12 text-center text-text-muted">
                                <RefreshCw className="animate-spin inline-block mr-2" size={18} />Cargando visitas...
                            </td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={10} className="p-12 text-center text-text-muted">
                                {sales.length === 0 ? 'No hay visitas agendadas aún.' : 'Ninguna visita coincide con los filtros aplicados.'}
                            </td></tr>
                        ) : (
                            filtered.map((sale) => {
                                const status = STATUS_LABELS[sale.appointmentStatus] || { label: sale.appointmentStatus, cls: 'bg-gray-100 text-gray-500' }
                                return (
                                    <tr key={sale.appointmentId}
                                        className="border-b border-border hover:bg-white transition-colors group cursor-pointer"
                                        onClick={() => router.push(`/dashboard/citas/${sale.appointmentId}/report`)}>
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
                                                <div className="flex items-start gap-1.5 text-sm text-navy max-w-[180px]">
                                                    <MapPin size={13} className="text-accent shrink-0 mt-0.5" />
                                                    <span className="truncate" title={sale.installation_address}>{sale.installation_address}</span>
                                                </div>
                                            ) : <span className="text-xs text-text-muted/50 italic">Sin dirección</span>}
                                        </td>
                                        <td className="p-4">
                                            {sale.whatsapp ? (
                                                <div className="flex items-center gap-1.5 text-sm text-navy">
                                                    <Phone size={13} className="text-text-muted shrink-0" />
                                                    <span>{sale.whatsapp}</span>
                                                </div>
                                            ) : <span className="text-xs text-text-muted/50 italic">—</span>}
                                        </td>
                                        <td className="p-4 text-right font-bold text-navy text-sm">{sale.totalM2.toFixed(2)}</td>
                                        <td className="p-4 text-right text-sm text-text-muted font-medium">{sale.totalItems}</td>
                                        <td className="p-4 text-right">
                                            <span className="font-black text-navy text-sm">
                                                {sale.total_geral ? `€ ${Number(sale.total_geral).toFixed(2)}` : '—'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted font-medium">
                                                <Calendar size={12} />
                                                {sale.scheduledAt ? new Date(sale.scheduledAt).toLocaleDateString('es-ES') : '—'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${status.cls}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/citas?apt=${sale.appointmentId}`) }}
                                                    className="p-2 bg-accent/10 text-accent rounded-lg hover:bg-accent hover:text-navy transition-all opacity-0 group-hover:opacity-100"
                                                    title="Editar Cita">
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/citas/${sale.appointmentId}/report`) }}
                                                    className="p-2 bg-navy/5 text-navy rounded-lg hover:bg-navy hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                    title="Ver Ficha de Instalación">
                                                    <ClipboardList size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>

                {filtered.length > 0 && (
                    <div className="p-4 bg-navy/5 border-t border-border flex justify-end gap-8 text-sm font-black text-navy">
                        <span>Total m²: {totalM2.toFixed(2)}</span>
                        <span>Visitas: {filtered.length}</span>
                        <span>Facturación: € {totalRevenue.toFixed(2)}</span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
