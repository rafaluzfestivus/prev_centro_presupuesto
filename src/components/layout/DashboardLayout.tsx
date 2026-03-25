'use client'

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-bg-dark">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <main className="md:pl-64 min-h-screen">
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    {/* Mobile header */}
                    <div className="md:hidden flex items-center gap-3 mb-6 bg-white border border-border rounded-2xl px-4 py-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-1.5 rounded-lg text-navy hover:bg-gray-100 transition-colors"
                        >
                            <Menu size={22} />
                        </button>
                        <span className="text-navy font-extrabold text-base tracking-tight">PREVENTIVA</span>
                    </div>

                    {children}
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
