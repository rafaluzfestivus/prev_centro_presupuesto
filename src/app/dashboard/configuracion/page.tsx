'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COMPANIES } from '@/hooks/useProfile'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Building2, CheckCircle2 } from 'lucide-react'

export default function ConfigPage() {
    const supabase = createClient()
    const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
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
                            <p className="text-xs text-text-muted">Preventiva Este está temporalmente pausada — todo el sistema está enfocado en Preventiva Centro por ahora. La empresa asignada a tu usuario solo puede cambiarla un administrador.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {Object.entries(COMPANIES).filter(([id]) => Number(id) === currentCompanyId).map(([id, co]) => (
                            <div
                                key={id}
                                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-accent bg-accent/5 text-left"
                            >
                                <div>
                                    <p className="font-bold text-navy">{co.name}</p>
                                    <p className="text-xs text-text-muted">{co.city}</p>
                                </div>
                                <CheckCircle2 size={18} className="text-accent" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
