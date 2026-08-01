'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { Card } from '@/components/ui/shared';
import { fetchAdminDocuments, type AdminDocumentRecord } from '@/lib/admin-portal-api';
import { useEffect, useState } from 'react';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes: number | null) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDocumentsPage() {
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<AdminDocumentRecord[] | null>(null);

  useEffect(() => {
    fetchAdminDocuments()
      .then(setDocuments)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
        setDocuments([]);
      });
  }, []);

  if (!documents) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Client Documents</h2>
        <p className="mt-1 text-sm text-text-secondary">Files clients have uploaded to their project workspaces.</p>
      </div>

      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold text-text-primary">Uploaded files</h3>
          <p className="mt-0.5 text-sm text-text-secondary">Open any file to view or download it.</p>
        </div>
        <div className="divide-y divide-border">
          {documents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-secondary">No client documents uploaded yet.</p>
          ) : documents.map((doc) => (
            <article key={doc.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_160px_150px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="shrink-0 text-text-secondary" />
                  <p className="truncate font-medium text-text-primary">{doc.name}</p>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {doc.clientName}{doc.projectName ? ` • ${doc.projectName}` : ''}{doc.milestoneTitle ? ` • ${doc.milestoneTitle}` : ''}
                </p>
              </div>
              <div className="text-sm text-text-secondary capitalize">{doc.type}</div>
              <div className="text-xs text-text-secondary">
                <p>{formatDate(doc.createdAt)}</p>
                {formatSize(doc.fileSize) && <p>{formatSize(doc.fileSize)}</p>}
              </div>
              <div className="lg:justify-end">
                <a
                  href={doc.fileUrl ?? '#'}
                  target={doc.fileUrl ? '_blank' : undefined}
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text-secondary hover:bg-surface-tertiary"
                >
                  {doc.fileUrl ? 'Open' : 'No file'}
                  {doc.fileUrl && <ExternalLink size={14} />}
                </a>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
