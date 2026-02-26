import { Suspense } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CalendarView from '@/components/dashboard/CalendarView';

export default function AgendaPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<div className="p-10 text-center">Carregando Agenda...</div>}>
                <CalendarView />
            </Suspense>
        </DashboardLayout>
    );
}
