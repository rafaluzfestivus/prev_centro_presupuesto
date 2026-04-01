'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import Image from 'next/image'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
            setLoading(false)
        } else {
            const next = searchParams.get('next') || '/dashboard'
            router.push(next)
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen bg-navy flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Logo / Brand */}
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-4">
                        <Image src="/icon.png" alt="Preventiva" width={64} height={64} className="rounded-2xl" />
                    </div>
                    <h1 className="text-accent text-3xl font-extrabold tracking-tight">PREVENTIVA</h1>
                    <p className="text-white/40 text-xs font-bold tracking-[0.25em] uppercase mt-1">Sistema Integrado</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <ShieldCheck size={16} className="text-accent" />
                        <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Acceso restringido</span>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">
                                Correo electrónico
                            </label>
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="correo@preventiva.com"
                                className="w-full bg-white/10 border border-white/15 text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-transparent transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/10 border border-white/15 text-white placeholder-white/25 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-transparent transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-accent hover:bg-accent/90 text-navy font-extrabold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-2"
                        >
                            {loading ? (
                                <><Loader2 size={16} className="animate-spin" /> Verificando...</>
                            ) : (
                                'Iniciar sesión'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-white/20 text-[10px] mt-8">
                    Preventiva Centro · Madrid · Uso interno
                </p>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    )
}
