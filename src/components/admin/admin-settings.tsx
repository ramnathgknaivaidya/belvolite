'use client';

import { Avatar, Card } from '@/components/ui/shared';

export function AdminSettings({ profile }: { profile: { fullName: string; email: string; role: string } | null }) {
  if (!profile) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">Loading account details...</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-base font-semibold text-text-primary">Account</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile.fullName} size="lg" />
            <div>
              <p className="text-sm font-semibold text-text-primary">{profile.fullName}</p>
              <p className="text-xs text-text-secondary">{profile.role}</p>
            </div>
          </div>
          {profile.email && (
            <div className="rounded-[8px] border border-border bg-surface-secondary px-3 py-2">
              <p className="text-xs text-text-secondary">Email</p>
              <p className="text-sm font-medium text-text-primary">{profile.email}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
