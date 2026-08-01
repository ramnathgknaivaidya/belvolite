'use client';

import { Link } from 'wouter';
import { AdminTimelineTable } from '@/components/admin/admin-timeline-table';
import { fetchClients, fetchTimeline, type AdminClientRecord, type AdminTimelineEventRecord, timelineEventTypes } from '@/lib/admin-portal-api';
import { useEffect, useState } from 'react';

function inputClass(extra = '') {
  return `h-9 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${extra}`;
}

export default function AdminTimelinePage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<AdminClientRecord[]>([]);
  const [events, setEvents] = useState<AdminTimelineEventRecord[] | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  async function loadAll() {
    try {
      const clientData = await fetchClients();
      setClients(clientData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    }
  }

  async function loadEvents() {
    try {
      const data = await fetchTimeline({
        clientId: selectedClientId || undefined,
        type: selectedType ? (selectedType as AdminTimelineEventRecord['type']) : undefined,
        status: selectedStatus ? (selectedStatus as AdminTimelineEventRecord['status']) : undefined,
      });
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
      setEvents([]);
    }
  }

  useEffect(() => {
    loadAll();
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedClientId !== '' || selectedType !== '' || selectedStatus !== '') {
      loadEvents();
    }
  }, [selectedClientId, selectedType, selectedStatus]);

  if (events === null) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Timeline</h2>
          <p className="mt-1 text-sm text-text-secondary">Create milestone, payment, meeting, and onboarding timeline events for clients.</p>
        </div>
        <Link href="/admin/clients" className="inline-flex h-9 items-center rounded-[8px] border border-border bg-white px-3 text-sm font-medium text-text-secondary hover:bg-surface-tertiary">
          View clients
        </Link>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm font-medium text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

      <section className="card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto_auto]">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Client</span>
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className={inputClass()}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.fullName || client.email}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Type</span>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={inputClass()}>
              <option value="">All types</option>
              {timelineEventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Status</span>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={inputClass()}>
              <option value="">All statuses</option>
              <option value="completed">completed</option>
              <option value="upcoming">upcoming</option>
            </select>
          </label>
          <button type="button" onClick={loadEvents} className="mt-auto inline-flex h-9 items-center justify-center rounded-[8px] bg-primary px-3.5 text-sm font-medium text-white hover:bg-primary-600">
            Filter
          </button>
          <button type="button" onClick={() => { setSelectedClientId(''); setSelectedType(''); setSelectedStatus(''); }} className="mt-auto inline-flex h-9 items-center justify-center rounded-[8px] border border-border bg-white px-3.5 text-sm font-medium text-text-secondary hover:bg-surface-tertiary">
            Reset
          </button>
        </div>
      </section>

      <AdminTimelineTable
        events={events}
        clients={clients}
        onMessage={(m, isError) => { setError(null); if (isError) setError(m); else setMessage(m); }}
        onRefresh={loadEvents}
      />
    </div>
  );
}
