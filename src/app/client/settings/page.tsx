'use client';

import { Bell, Globe, Lock, MapPin, Shield, User } from 'lucide-react';
import { useState, useEffect } from 'react';

function inputClass(extra = '') {
  return `h-9 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${extra}`;
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  placeholder,
  className = '',
  readOnly = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-medium text-text-primary">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ''} placeholder={placeholder} readOnly={readOnly} className={inputClass(readOnly ? 'bg-surface-secondary text-text-secondary' : '')} />
    </label>
  );
}

function Checkbox({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-text-primary">{label}</span>
        <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>
      </span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-primary" />
    </label>
  );
}

export default function SettingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/client/profile');
        if (res.ok) {
          const json = await res.json();
          setProfile(json.profile || {});
          return;
        }
      } catch {
        // fall through
      }
      setProfile({});
    }
    loadProfile();
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);
    const body: Record<string, string | boolean> = {};
    fd.forEach((value, key) => {
      if (key === 'email') return;
      body[key] = value === 'on' ? true : String(value);
    });
    try {
      const res = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage(json.message || 'Profile updated');
        const reload = await fetch('/api/client/profile');
        if (reload.ok) {
          const reloadJson = await reload.json();
          setProfile(reloadJson.profile || {});
        }
      } else {
        setError(json.message || 'Failed to save profile');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const currentPassword = String(fd.get('currentPassword') || '');
    const newPassword = String(fd.get('newPassword') || '');
    const confirmPassword = String(fd.get('confirmPassword') || '');
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    try {
      const res = await fetch('/api/client/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (res.ok) {
        event.currentTarget.reset();
        setMessage(json.message || 'Password updated');
      } else {
        setError(json.message || 'Failed to update password');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }

  if (!profile) {
    return <div className="animate-fade-in space-y-5"><p className="text-sm text-text-secondary">Loading...</p></div>;
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage the real account details connected to your client profile.</p>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm font-medium text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

      <form onSubmit={saveProfile} className="space-y-5">
        <section className="card p-4">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <User size={16} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="fullName" defaultValue={profile.fullName} placeholder="Your name" />
            <Field label="Company" name="company" defaultValue={profile.company} placeholder="Company name" />
            <Field label="Email" name="email" defaultValue={profile.email} readOnly className="sm:col-span-2" />
            <Field label="Phone" name="phone" defaultValue={profile.phone} placeholder="+1 555 000 0000" />
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-text-primary">Gender</span>
              <select name="gender" defaultValue={profile.gender ?? ''} className={inputClass()}>
                <option value="">Not specified</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
            <Field label="Age" name="age" type="number" defaultValue={profile.age} placeholder="Age" />
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <Globe size={16} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Social Links</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" name="website" defaultValue={profile.website} placeholder="https://example.com" />
            <Field label="Instagram" name="instagram" defaultValue={profile.instagram} placeholder="@username" />
            <Field label="LinkedIn" name="linkedin" defaultValue={profile.linkedin} placeholder="linkedin.com/company/example" className="sm:col-span-2" />
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <MapPin size={16} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Address</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Street address" name="street" defaultValue={profile.street} className="sm:col-span-2" />
            <Field label="City" name="city" defaultValue={profile.city} />
            <Field label="State" name="state" defaultValue={profile.state} />
            <Field label="Postal code" name="postalCode" defaultValue={profile.postalCode} />
            <Field label="Country" name="country" defaultValue={profile.country} />
            <Field label="GST number" name="gstNumber" defaultValue={profile.gstNumber} />
            <Field label="BPIT number" name="bpitNumber" defaultValue={profile.bpitNumber} />
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-2 flex items-center gap-2 border-b border-border pb-3">
            <Bell size={16} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Preferences</h2>
          </div>
          <div className="divide-y divide-border">
            <Checkbox name="emailNotifications" label="Email notifications" description="Project updates, invoice reminders, and meeting changes." defaultChecked={profile.emailNotifications} />
            <Checkbox name="weeklySummary" label="Weekly summary" description="A compact weekly digest of project movement." defaultChecked={profile.weeklySummary} />
            <Checkbox name="twoFactorEnabled" label="Two-factor authentication" description="Mark this account as using an extra verification step." defaultChecked={profile.twoFactorEnabled} />
          </div>
        </section>

        <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface-secondary/90 py-3 backdrop-blur">
          <button type="submit" className="inline-flex h-9 items-center rounded-[8px] bg-primary px-4 text-sm font-medium text-white hover:bg-primary-600">
            Save profile
          </button>
        </div>
      </form>

      <section className="card p-4">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <Lock size={16} className="text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" name="currentPassword" type="password" />
          <Field label="New password" name="newPassword" type="password" />
          <Field label="Confirm password" name="confirmPassword" type="password" />
          <div className="sm:col-span-3">
            <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-white px-3.5 text-sm font-medium text-text-primary hover:bg-surface-tertiary">
              <Shield size={16} />
              Update password
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
