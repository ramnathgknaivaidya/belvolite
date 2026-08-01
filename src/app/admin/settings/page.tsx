'use client';

import { AdminSettings } from '@/components/admin/admin-settings';
import { useEffect, useState } from 'react';

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<{ fullName: string; email: string; role: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('belvo_admin_token');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setProfile({ fullName: payload.fullName || payload.username || 'Admin', email: payload.email || '', role: payload.role || 'admin' });
    } catch {
      setProfile({ fullName: 'Admin', email: '', role: 'admin' });
    }
  }, []);

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Settings</h2>
        <p className="mt-1 text-sm text-text-secondary">Account and workspace settings.</p>
      </div>

      <AdminSettings profile={profile} />
    </div>
  );
}
