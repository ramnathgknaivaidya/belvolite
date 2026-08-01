'use client';

import { MessageSquare, Send } from 'lucide-react';
import { Avatar, Badge, Card, Select } from '@/components/ui/shared';
import { fetchChatThreads, fetchChatMessages, sendAdminChatMessage, fetchClients, type ChatMessageRecord, type ChatThreadRecord } from '@/lib/admin-portal-api';
import { useEffect, useRef, useState } from 'react';

function formatTime(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function AdminChatPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThreadRecord[] | null>(null);
  const [clients, setClients] = useState<{ id: string; label: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessageRecord[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    try {
      const data = await fetchChatThreads();
      setThreads(data);
      if (data.length > 0 && !selectedClient) {
        setSelectedClient(data[0].clientId || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      setThreads([]);
    }
  }

  useEffect(() => {
    loadThreads();
    fetchClients().then((cs) => {
      setClients(cs.map((c) => ({ id: c.id, label: c.fullName || c.email })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    fetchChatMessages(selectedClient).then(setMessages).catch(() => setMessages([]));
  }, [selectedClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !selectedClient) return;
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      await sendAdminChatMessage(selectedClient, body);
      setDraft('');
      setMessage('Message sent.');
      const data = await fetchChatMessages(selectedClient);
      setMessages(data);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  const currentThread = threads?.find((t) => t.clientId === selectedClient);

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Client Chat</h2>
        <p className="mt-1 text-sm text-text-secondary">Conversations between clients and the Belvo team.</p>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="flex min-h-[560px] flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Project Thread</h3>
            <p className="text-xs text-text-secondary">
              {currentThread ? `${currentThread.clientName} - ${currentThread.messageCount} messages` : 'Select a client to view the conversation'}
            </p>
          </div>
          <Select
            id="chat-client"
            options={[
              ...clients.map((c) => ({ label: c.label, value: c.id })),
            ]}
            value={selectedClient}
            onChange={(v) => { setSelectedClient(v); setMessage(null); setError(null); }}
            className="min-w-52"
          />
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {!selectedClient ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
              <MessageSquare size={30} className="mb-3 text-text-tertiary" />
              <p className="text-sm font-semibold text-text-primary">No conversation selected</p>
              <p className="mt-1 max-w-md text-sm text-text-secondary">Choose a client from the dropdown above to start messaging.</p>
            </div>
          ) : messages === null ? (
            <div className="flex items-center justify-center h-full min-h-80"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
              <MessageSquare size={30} className="mb-3 text-text-tertiary" />
              <p className="text-sm font-semibold text-text-primary">No messages yet</p>
              <p className="mt-1 max-w-md text-sm text-text-secondary">Send the first message below to start the conversation.</p>
            </div>
          ) : messages.map((item) => {
            const own = item.senderRole === 'admin';
            return (
              <article key={item.id} className={`flex gap-3 ${own ? 'justify-end' : ''}`}>
                {!own && <Avatar name={item.senderName} size="sm" />}
                <div className={`max-w-2xl rounded-[8px] border px-3 py-2.5 ${own ? 'border-primary/20 bg-primary-50' : 'border-border bg-surface-secondary'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-primary">{own ? 'You (Belvo Admin)' : item.senderName}</p>
                    <span className="text-xs text-text-tertiary">{formatTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{item.body}</p>
                  {item.attachmentUrl && item.attachmentName && (
                    <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-primary hover:text-primary-600">
                      {item.attachmentName}
                    </a>
                  )}
                </div>
                {own && <Avatar name="A" size="sm" />}
              </article>
            );
          })}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="border-t border-border p-4"
        >
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={selectedClient ? 'Write a message...' : 'Select a client first'}
              disabled={!selectedClient}
              className="h-10 min-w-0 flex-1 rounded-[8px] border border-border bg-white px-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!selectedClient || !draft.trim() || sending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={16} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
