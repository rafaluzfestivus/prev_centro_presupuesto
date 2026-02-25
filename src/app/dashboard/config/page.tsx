import DashboardLayout from '@/components/layout/DashboardLayout';
import PromptEditor from '@/components/dashboard/PromptEditor';

export default function ConfigPage() {
    return (
        <DashboardLayout>
            <PromptEditor />
        </DashboardLayout>
    );
}
