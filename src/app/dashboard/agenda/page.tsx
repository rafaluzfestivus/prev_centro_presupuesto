import DashboardLayout from '@/components/layout/DashboardLayout';
import CalendarView from '@/components/dashboard/CalendarView';

export default function AgendaPage() {
    return (
        <DashboardLayout>
            <CalendarView />
        </DashboardLayout>
    );
}
