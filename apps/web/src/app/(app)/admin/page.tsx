import { Suspense } from 'react';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminDashboard />
    </Suspense>
  );
}
