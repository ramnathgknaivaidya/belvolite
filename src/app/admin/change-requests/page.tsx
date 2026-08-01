'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge, Card } from '@/components/ui/shared';
import { formatCurrency } from '@/lib/money';
import { fetchChangeRequests, updateChangeRequest, type ChangeRequestRecord } from '@/lib/admin-portal-api';
import { useEffect, useState } from 'react';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusVariant(status: string): 'green' | 'red' | 'gray' {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  return 'gray';
}

function inputClass(extra = '') {
  return `h-9 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${extra}`;
}

export default function AdminChangeRequestsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ChangeRequestRecord[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function loadData() {
    try {
      const data = await fetchChangeRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load change requests');
      setRequests([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function decide(id: string, status: ChangeRequestRecord['status']) {
    const note = notes[id] ?? '';
    if (status === 'rejected' && !note.trim()) {
      setError('Add a note before rejecting this request.');
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await updateChangeRequest(id, status, note || undefined);
      setMessage(`Change request ${status}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update request');
    }
  }

  if (!requests) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Change Requests</h2>
        <p className="mt-1 text-sm text-text-secondary">Approve or reject change requests submitted by clients.</p>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="space-y-4">
        {requests.length === 0 ? (
          <Card className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <CheckCircle2 size={30} className="mb-3 text-text-tertiary" />
            <p className="text-sm font-semibold text-text-primary">No change requests yet</p>
            <p className="mt-1 max-w-md text-sm text-text-secondary">Change requests submitted by clients will appear here.</p>
          </Card>
        ) : requests.map((req) => (
          <Card key={req.id} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-text-primary">{req.title}</h3>
                  <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                </div>
                <p className="mt-1 text-xs font-medium text-text-tertiary">
                  {req.clientName} • {req.projectName || 'No project'} • Submitted {formatDate(req.createdAt)}
                </p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{req.description}</p>
              </div>
              <div className="shrink-0 space-y-1 text-right text-sm">
                <p className="text-text-secondary">Impact: <span className="capitalize font-medium text-text-primary">{req.impact}</span></p>
                <p className="text-text-secondary">Priority: <span className="capitalize font-medium text-text-primary">{req.priority}</span></p>
                <p className="text-text-secondary">Est. cost: <span className="font-medium text-text-primary">{formatCurrency(req.estimatedCost)}</span></p>
                {req.timelineImpact && <p className="text-text-secondary">Timeline: <span className="font-medium text-text-primary">{req.timelineImpact}</span></p>}
              </div>
            </div>

            {req.adminNote && (
              <p className="mt-3 rounded-[8px] bg-surface-secondary px-3 py-2 text-sm text-text-secondary">Admin note: {req.adminNote}</p>
            )}

            {req.status === 'pending' && (
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
                <input
                  placeholder="Note for client (required to reject)"
                  value={notes[req.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  className={inputClass('sm:max-w-md')}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => decide(req.id, 'approved')}
                    className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-success/20 bg-success-50 px-3 text-sm font-semibold text-success hover:bg-success/10"
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(req.id, 'rejected')}
                    className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-danger/20 bg-danger-50 px-3 text-sm font-semibold text-danger hover:bg-danger/10"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
