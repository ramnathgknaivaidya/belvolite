'use client';

import { Calendar, CheckCircle2, Milestone as MilestoneIcon, Plus } from 'lucide-react';
import { Badge, Card, ProgressBar } from '@/components/ui/shared';
import { createMilestone, fetchAdminMilestones, fetchClients, updateMilestone, type MilestoneRecord } from '@/lib/admin-portal-api';
import { useEffect, useState } from 'react';

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusVariant(status: string): 'green' | 'purple' | 'orange' | 'red' | 'gray' {
  if (status === 'completed') return 'green';
  if (status === 'in_progress' || status === 'under_review') return 'purple';
  if (status === 'needs_revision') return 'orange';
  if (status === 'delayed') return 'red';
  return 'gray';
}

function inputClass(extra = '') {
  return `h-9 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${extra}`;
}

const MILESTONE_STATUSES = ['not_started', 'in_progress', 'under_review', 'needs_revision', 'delayed', 'completed'];

export default function AdminMilestonesPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRecord[] | null>(null);
  const [clients, setClients] = useState<{ id: string; label: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ clientId: '', title: '', description: '', status: 'not_started', progress: 0, expectedDate: '' });

  async function loadData() {
    try {
      const data = await fetchAdminMilestones();
      setMilestones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load milestones');
      setMilestones([]);
    }
  }

  useEffect(() => {
    loadData();
    fetchClients().then((cs) => {
      setClients(cs.map((c) => ({ id: c.id, label: c.fullName || c.email })));
    }).catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId || !form.title.trim()) {
      setError('Client and title are required.');
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await createMilestone({
        clientId: form.clientId,
        title: form.title,
        description: form.description || null,
        status: form.status,
        progress: Number(form.progress || 0),
        expectedDate: form.expectedDate || null,
      });
      setShowCreate(false);
      setForm({ clientId: '', title: '', description: '', status: 'not_started', progress: 0, expectedDate: '' });
      setMessage('Milestone created.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone');
    }
  }

  async function updateProgress(id: string, progress: number, status?: string) {
    setError(null);
    setMessage(null);
    try {
      await updateMilestone(id, {
        progress,
        status: status || (progress >= 100 ? 'completed' : 'in_progress'),
      });
      setMessage('Milestone updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update milestone');
    }
  }

  if (!milestones) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Milestones</h2>
          <p className="mt-1 text-sm text-text-secondary">Track client project milestones and their progress.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-primary px-3.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600"
        >
          <Plus size={16} />
          New milestone
        </button>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      {showCreate && (
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-text-primary">Create milestone</h3>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
            <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} className={inputClass()} required>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <input placeholder="Milestone title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass()} required />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={`${inputClass()} h-20 resize-none md:col-span-2`} />
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputClass()}>
              {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
            </select>
            <input type="date" value={form.expectedDate} onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))} className={inputClass()} />
            <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="inline-flex h-9 items-center rounded-[8px] border border-border bg-white px-3.5 text-sm font-medium text-text-secondary hover:bg-surface-tertiary">
                Cancel
              </button>
              <button type="submit" className="inline-flex h-9 items-center justify-center rounded-[8px] bg-primary px-3.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600">
                Create milestone
              </button>
            </div>
          </form>
        </Card>
      )}

      {milestones.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-5 py-14 text-center">
          <MilestoneIcon size={30} className="mb-3 text-text-tertiary" />
          <p className="text-sm font-semibold text-text-primary">No milestones yet</p>
          <p className="mt-1 max-w-md text-sm text-text-secondary">Create the first milestone for a client using the button above.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {milestones.map((milestone) => (
            <Card key={milestone.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-text-primary">{milestone.title}</h3>
                    <Badge variant={statusVariant(milestone.status)}>{milestone.status.replaceAll('_', ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-medium text-text-tertiary">
                    {milestone.clientName}{milestone.projectName ? ` • ${milestone.projectName}` : ''}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{milestone.description || 'No milestone detail added.'}</p>
                </div>
                <div className="shrink-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={milestone.progress}
                      onChange={(e) => updateProgress(milestone.id, Math.min(100, Math.max(0, Number(e.target.value || 0))))}
                      className={`${inputClass('w-20 text-right')} [appearance:textfield]`}
                    />
                    <span className="text-sm font-semibold text-text-primary">%</span>
                    <button
                      type="button"
                      onClick={() => updateProgress(milestone.id, milestone.progress >= 100 ? 100 : milestone.progress + 10)}
                      className="inline-flex h-9 items-center rounded-[8px] border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-tertiary"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <ProgressBar progress={milestone.progress} />
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1.5"><Calendar size={13} />Expected {formatDate(milestone.expectedDate)}</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} />Completed {formatDate(milestone.completionDate)}</span>
              </div>

              {milestone.deliverables.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-text-primary">Deliverables</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {milestone.deliverables.map((deliverable, idx) => (
                      <div key={deliverable.id || idx} className="flex items-center gap-3 rounded-[8px] border border-border bg-surface-secondary px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{deliverable.name}</span>
                        {deliverable.fileUrl && <a href={deliverable.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-600">Open</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
