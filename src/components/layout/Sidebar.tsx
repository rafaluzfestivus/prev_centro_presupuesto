'use client'

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    LayoutDashboard,
    LogOut,
    Calendar,
    Users,
    FileText,
    TrendingUp,
    Filter,
    PlusCircle,
    X,
    ExternalLink,
    Settings,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const menuItems = [
        { id: '/dashboard',              label: 'Dashboard',    icon: LayoutDashboard },
        { id: '/dashboard/nova-proposta',label: 'Nova Proposta',icon: PlusCircle },
        { id: '/dashboard/presupuestos', label: 'Propostas',    icon: FileText },
        { id: '/dashboard/clientes',     label: 'Leads',        icon: Users },
        { id: '/dashboard/funil',        label: 'Funil',        icon: Filter },
        { id: '/dashboard/citas',        label: 'Agenda',       icon: Calendar },
        { id: '/dashboard/ventas',       label: 'Ventas',       icon: TrendingUp },
        { id: '/dashboard/configuracion',label: 'Mi Empresa',   icon: Settings },
    ];

    return (
        <aside className={`w-64 bg-navy h-screen fixed left-0 top-0 flex flex-col p-6 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            {/* Close button - mobile only */}
            <button
                onClick={onClose}
                className="md:hidden absolute top-4 right-4 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
                <X size={20} />
            </button>

            <div className="px-2 mb-8 flex flex-col items-center gap-2">
                <Image src="/icon.png" alt="Preventiva Logo" width={60} height={60} className="mb-2" />
                <div className="text-center">
                    <h2 className="text-accent text-2xl font-extrabold tracking-tight leading-tight">PREVENTIVA</h2>
                    <p className="text-white/40 text-[10px] font-bold tracking-[0.2em]">SISTEMA INTEGRADO</p>
                </div>
            </div>

            <nav className="flex-1 flex flex-col gap-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.id || (item.id !== '/dashboard' && pathname.startsWith(item.id));

                    return (
                        <Link
                            key={item.id}
                            href={item.id}
                            onClick={onClose}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-accent/10 border border-accent/20'
                                : 'hover:bg-white/5'
                                }`}
                        >
                            <Icon
                                size={20}
                                className={isActive ? 'text-accent' : 'text-white/50 group-hover:text-white'}
                            />
                            <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white'
                                }`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            <div className="pt-6 border-t border-white/10 mt-6 flex flex-col gap-1">
                <a
                    href="https://chat.preventivacentro.es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/5 group"
                >
                    <ExternalLink size={20} className="text-white/50 group-hover:text-white" />
                    <span className="text-sm font-semibold text-white/50 group-hover:text-white">Chatwoot</span>
                </a>
                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-red-500/10 group w-full text-left">
                    <LogOut size={20} className="text-white/50 group-hover:text-red-400" />
                    <span className="text-sm font-semibold text-white/50 group-hover:text-red-400">Salir</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
