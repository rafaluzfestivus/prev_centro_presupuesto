import DashboardLayout from '@/components/layout/DashboardLayout';
import LeadsManager from '@/components/dashboard/LeadsManager';

export default function LeadsPage() {
    return (
        <DashboardLayout>
            <LeadsManager />
        </DashboardLayout>
    );
}
