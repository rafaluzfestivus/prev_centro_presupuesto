'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    MessageSquare,
    BookOpen,
    Settings,
    LogOut,
    Calendar,
    Users,
    FileText
} from 'lucide-react';

const Sidebar = () => {
    const pathname = usePathname();

    const menuItems = [
        { id: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: '/dashboard/propostas', label: 'Propostas IA', icon: FileText },
        { id: '/dashboard/leads', label: 'Leads do Site', icon: Users },
        { id: '/dashboard/agenda', label: 'Agenda', icon: Calendar },
        { id: '/dashboard/conversas', label: 'Conversas', icon: MessageSquare },
        { id: '/dashboard/conhecimento', label: 'Conhecimento', icon: BookOpen },
        { id: '/dashboard/config', label: 'Cérebro IA', icon: Settings },
    ];

    return (
        <aside className="w-64 bg-navy h-screen fixed left-0 top-0 flex flex-col p-6 z-50">
            <div className="px-2 mb-8">
                <h2 className="text-accent text-2xl font-extrabold tracking-tight">PREVENTIVA</h2>
                <p className="text-white/40 text-[10px] font-bold tracking-[0.2em]">SISTEMA INTEGRADO</p>
            </div>

            <nav className="flex-1 flex flex-col gap-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.id || (item.id !== '/dashboard' && pathname.startsWith(item.id));

                    return (
                        <Link
                            key={item.id}
                            href={item.id}
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

            <div className="pt-6 border-t border-white/10 mt-6">
                <button className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-red-500/10 group w-full text-left">
                    <LogOut size={20} className="text-white/50 group-hover:text-red-400" />
                    <span className="text-sm font-semibold text-white/50 group-hover:text-red-400">Sair</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
