'use client';

import { Link } from 'wouter';
import { AdminClientsTable } from '@/components/admin/admin-clients-table';
import { fetchClients, fetchPayments, fetchTimeline, type AdminClientRecord, type AdminPaymentRecord, type AdminTimelineEventRecord } from '@/lib/admin-portal-api';
import { useEffect, useState } from 'react';

export default function AdminClientsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<AdminClientRecord[] | null>(null);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [timeline, setTimeline] = useState<AdminTimelineEventRecord[]>([]);

  async function refresh() {
    try {
      const [clientData, paymentData, timelineData] = await Promise.all([
        fetchClients(),
        fetchPayments(),
        fetchTimeline(),
      ]);
      setClients(clientData);
      setPayments(paymentData);
      setTimeline(timelineData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
      setClients([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (clients === null) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Clients</h2>
          <p className="mt-1 text-sm text-text-secondary">Manage profile details, payments, and timeline records from one client drawer.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/payments" className="inline-flex h-9 items-center rounded-[8px] border border-border bg-white px-3 text-sm font-medium text-text-secondary hover:bg-surface-tertiary">Payments</Link>
          <Link href="/admin/timeline" className="inline-flex h-9 items-center rounded-[8px] border border-border bg-white px-3 text-sm font-medium text-text-secondary hover:bg-surface-tertiary">Timeline</Link>
        </div>
      </div>

      {message && <p className="rounded-[8px] border border-primary/20 bg-primary-50 px-3 py-2 text-sm font-medium text-primary">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

      <AdminClientsTable
        clients={clients}
        payments={payments}
        timeline={timeline}
        onMessage={(m, isError) => { setError(null); if (isError) setError(m); else setMessage(m); }}
        onRefresh={refresh}
      />
    </div>
  );
}
