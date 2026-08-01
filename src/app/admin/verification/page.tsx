'use client';

import { ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Card } from '@/components/ui/shared';
import { fetchVerificationDocuments, verifyDocument, approveClientDocuments, type VerificationDocumentRecord } from '@/lib/admin-portal-api';
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

type DocumentWithClient = VerificationDocumentRecord & { clientName: string };

export default function AdminVerificationPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentWithClient[] | null>(null);
  const [rejections, setRejections] = useState<Record<string, string>>({});

  async function loadData() {
    try {
      const data = await fetchVerificationDocuments();
      setDocuments(data as DocumentWithClient[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verification documents');
      setDocuments([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function approve(id: string) {
    setError(null);
    setMessage(null);
    try {
      await verifyDocument(id, 'approved');
      setMessage('Document approved.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve document');
    }
  }

  async function reject(id: string, reason: string) {
    if (!reason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await verifyDocument(id, 'rejected', reason);
      setMessage('Document rejected.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject document');
    }
  }

  async function approveAll(clientId: string) {
    setError(null);
    setMessage(null);
    try {
      await approveClientDocuments(clientId);
      setMessage('All documents approved for this client.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve documents');
    }
  }

  if (!documents) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Verification</h2>
        <p className="mt-1 text-sm text-text-secondary">Review client-submitted documents before they take effect.</p>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold text-text-primary">Submitted documents</h3>
          <p className="mt-0.5 text-sm text-text-secondary">Approve or reject each submission. Rejections require a reason.</p>
        </div>
        <div className="divide-y divide-border">
          {documents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-secondary">No verification documents submitted yet.</p>
          ) : documents.map((document) => (
            <article key={document.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_170px_140px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-text-primary">{document.clientName || document.clientEmail || 'Unknown client'}</p>
                  <Badge variant={statusVariant(document.status)}>{document.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary capitalize">{document.documentType}{document.documentNumber ? ` - ${document.documentNumber}` : ''}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {document.fileName ? `${document.fileName} • ` : ''}Submitted {formatDate(document.createdAt ?? null)}
                </p>
                {document.rejectionReason && <p className="mt-1 text-sm text-danger">Reason: {document.rejectionReason}</p>}
              </div>
              <div className="text-sm text-text-secondary">
                <a href={document.fileUrl ?? '#'} target="_blank" rel="noreferrer" className="font-medium text-primary hover:text-primary-600">
                  {document.fileUrl ? 'View document' : 'No file'}
                </a>
              </div>
              <div>
                {document.status === 'pending' ? (
                  <input
                    placeholder="Rejection reason"
                    value={rejections[document.id] ?? ''}
                    onChange={(e) => setRejections((prev) => ({ ...prev, [document.id]: e.target.value }))}
                    className={inputClass()}
                  />
                ) : (
                  <p className="text-sm text-text-secondary">Decision recorded</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {document.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => approve(document.id)}
                      className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-success/20 bg-success-50 px-3 text-sm font-semibold text-success hover:bg-success/10"
                    >
                      <ShieldCheck size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(document.id, rejections[document.id] ?? '')}
                      className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-danger/20 bg-danger-50 px-3 text-sm font-semibold text-danger hover:bg-danger/10"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </>
                )}
                {document.status === 'pending' && document.clientId && (
                  <button
                    type="button"
                    onClick={() => approveAll(document.clientId)}
                    className="inline-flex h-9 items-center rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text-secondary hover:bg-surface-tertiary"
                  >
                    Approve all for client
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
