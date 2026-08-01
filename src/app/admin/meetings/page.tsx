'use client';

import { CalendarDays, CheckCircle2, Clock, Trash2, XCircle } from 'lucide-react';
import { Badge, Card, StatCard } from '@/components/ui/shared';
import { fetchClients, fetchMeetings, createMeeting, updateMeetingStatus, deleteMeeting, meetingStatuses, type AdminClientRecord, type MeetingRecord, type MeetingStatus } from '@/lib/admin-portal-api';
import { useState, useEffect } from 'react';

function formatDateTime(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusVariant(status: MeetingStatus): 'purple' | 'green' | 'red' | 'gray' {
  if (status === 'accepted') return 'green';
  if (status === 'cancelled') return 'red';
  if (status === 'completed') return 'gray';
  return 'purple';
}

function inputClass(extra = '') {
  return `h-9 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${extra}`;
}

export default function AdminMeetingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<AdminClientRecord[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const [clientData, meetingData] = await Promise.all([fetchClients(), fetchMeetings()]);
      setClients(clientData);
      setMeetings(meetingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
      setMeetings([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await createMeeting({
        clientId: fd.get('clientId') as string,
        title: fd.get('title') as string,
        date: fd.get('date') as string,
        time: fd.get('time') as string,
        durationMinutes: Number(fd.get('durationMinutes') || 45),
        agenda: (fd.get('agenda') as string) || undefined,
        participants: (fd.get('participants') as string) || undefined,
        meetingLink: (fd.get('meetingLink') as string) || undefined,
        status: (fd.get('status') as MeetingStatus) || undefined,
      });
      event.currentTarget.reset();
      setMessage('Meeting created.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: MeetingStatus) {
    setError(null);
    setMessage(null);
    try {
      await updateMeetingStatus(id, status);
      setMessage('Meeting status updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update meeting');
    }
  }

  async function removeMeeting(id: string) {
    setError(null);
    setMessage(null);
    try {
      await deleteMeeting(id);
      setMessage('Meeting deleted.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  }

  if (!meetings) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Meetings</h2>
        <p className="mt-1 text-sm text-text-secondary">Create and manage client-facing meetings from live database records.</p>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={String(meetings.length)} icon={<CalendarDays size={18} />} />
        <StatCard label="Upcoming" value={String(meetings.filter((meeting) => meeting.status === 'upcoming').length)} icon={<Clock size={18} />} />
        <StatCard label="Accepted" value={String(meetings.filter((meeting) => meeting.status === 'accepted').length)} icon={<CheckCircle2 size={18} />} color="#10B981" />
        <StatCard label="Cancelled" value={String(meetings.filter((meeting) => meeting.status === 'cancelled').length)} icon={<XCircle size={18} />} color="#EF4444" />
      </div>

      <Card className="p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-text-primary">Create Meeting</h3>
          <p className="mt-1 text-sm text-text-secondary">Choose a client and add the meeting details.</p>
        </div>
        <form onSubmit={submitCreate} className="grid gap-4 lg:grid-cols-[1fr_1fr_140px_120px_140px]">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Client</span>
            <select name="clientId" required defaultValue="" className={inputClass()}>
              <option value="" disabled>Select client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.fullName || client.email}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Title</span>
            <input name="title" required className={inputClass()} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Date</span>
            <input name="date" type="date" required className={inputClass()} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Time</span>
            <input name="time" type="time" required className={inputClass()} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Duration</span>
            <select name="durationMinutes" defaultValue="45" className={inputClass()}>
              {[15, 30, 45, 60, 90].map((duration) => <option key={duration} value={duration}>{duration} min</option>)}
            </select>
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-medium text-text-secondary">Agenda</span>
            <input name="agenda" className={inputClass()} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Participants</span>
            <input name="participants" className={inputClass()} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Meeting link</span>
            <input name="meetingLink" className={inputClass()} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Status</span>
            <select name="status" defaultValue="upcoming" className={inputClass()}>
              {meetingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <div className="lg:col-span-5">
            <button type="submit" disabled={saving || clients.length === 0} className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold text-text-primary">All Meetings</h3>
          <p className="mt-0.5 text-sm text-text-secondary">Use status controls to keep the client view current.</p>
        </div>
        <div className="divide-y divide-border">
          {meetings.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-secondary">No meetings have been created yet.</p>
          ) : meetings.map((meeting) => (
            <article key={meeting.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_210px_180px_220px] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-text-primary">{meeting.title}</h4>
                  <Badge variant={statusVariant(meeting.status)}>{meeting.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{meeting.clientName || meeting.clientEmail || 'Unknown client'} - {meeting.clientEmail}</p>
                <p className="mt-1 line-clamp-1 text-sm text-text-secondary">{meeting.agenda || 'No agenda provided.'}</p>
              </div>
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text-primary">{formatDateTime(meeting.scheduledAt)}</p>
                <p className="mt-1">{meeting.durationMinutes} min</p>
              </div>
              <div>
                <select
                  value={meeting.status}
                  onChange={(e) => updateStatus(meeting.id, e.target.value as MeetingStatus)}
                  className={inputClass()}
                >
                  {meetingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {meeting.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => updateStatus(meeting.id, 'completed')}
                    className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-success/20 bg-success-50 px-3 text-sm font-semibold text-success hover:bg-success/10"
                  >
                    <CheckCircle2 size={14} />
                    Complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeMeeting(meeting.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text-secondary hover:bg-surface-tertiary"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
