'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COMPANIES } from '@/hooks/useProfile'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Building2, CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ConfigPage() {
    const supabase = createClient()
    const router = useRouter()
    const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [userEmail, setUserEmail] = useState('')

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return
            setUserEmail(user.email ?? '')

            const { data } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single()

            setCurrentCompanyId(data?.company_id ?? 1)
        })
    }, [])

    const handleSave = async (companyId: number) => {
        setSaving(true)
        setSaved(false)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase
            .from('profiles')
            .upsert({ id: user.id, company_id: companyId })

        setCurrentCompanyId(companyId)
        setSaving(false)
        setSaved(true)
        setTimeout(() => { setSaved(false); router.refresh() }, 1500)
    }

    return (
        <DashboardLayout>
            <header className="mb-8">
                <h1 className="text-3xl font-bold mb-2 text-navy">Mi <span className="accent-text">Configuración</span></h1>
                <p className="text-text-muted">{userEmail}</p>
            </header>

            <div className="max-w-lg">
                <div className="glass-card p-8 bg-white border-none shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-accent/10 rounded-xl">
                            <Building2 size={22} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-navy">Mi Empresa</h2>
                            <p className="text-xs text-text-muted">Preventiva Este está temporalmente pausada — todo el sistema está enfocado en Preventiva Centro por ahora.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {Object.entries(COMPANIES).filter(([id]) => id === '1').map(([id, co]) => {
                            const companyId = Number(id)
                            const isActive = currentCompanyId === companyId
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleSave(companyId)}
                                    disabled={saving}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                                        isActive
                                            ? 'border-accent bg-accent/5'
                                            : 'border-border hover:border-accent/40 bg-white'
                                    }`}
                                >
                                    <div>
                                        <p className="font-bold text-navy">{co.name}</p>
                                        <p className="text-xs text-text-muted">{co.city}</p>
                                    </div>
                                    {isActive && (
                                        saving ? (
                                            <Loader2 size={18} className="text-accent animate-spin" />
                                        ) : saved ? (
                                            <CheckCircle2 size={18} className="text-green-500" />
                                        ) : (
                                            <CheckCircle2 size={18} className="text-accent" />
                                        )
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {saved && (
                        <p className="mt-4 text-center text-sm text-green-600 font-semibold">
                            ✓ Empresa actualizada — recargando...
                        </p>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
