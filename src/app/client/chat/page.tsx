'use client';

import { MessageSquare, Send } from 'lucide-react';
import { Avatar, Badge, Card } from '@/components/ui/shared';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { useState, useEffect } from 'react';

function formatTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface PortalMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
}

export default function ChatPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<PortalMessage[] | null>(null);
  const [user, setUser] = useState({ id: 'mock-client-id' });

  useEffect(() => {
    async function fetchData() {
      try {
        const [meRes, chatRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/client/chat'),
        ]);
        const me = await meRes.json();
        if (me?.user?.id) setUser({ id: me.user.id });
        if (chatRes.ok) {
          const json = await chatRes.json();
          setMessages(Array.isArray(json.data) ? json.data : []);
          return;
        }
      } catch {
        // leave empty on error
      }
      setMessages([]);
    }
    fetchData();
  }, []);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const body = String(fd.get('body') || '').trim();
    if (!body) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/client/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (res.ok) {
        event.currentTarget.reset();
        setMessage(json.message || 'Message sent');
        const chatRes = await fetch('/api/client/chat');
        if (chatRes.ok) {
          const data = await chatRes.json();
          setMessages(Array.isArray(data.data) ? data.data : []);
        }
      } else {
        setError(json.message || 'Failed to send message');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }

  if (!messages) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Chat</h1>
        <p className="mt-1 text-sm text-text-secondary">Messages stored against your client account.</p>
      </div>

      {message && <p className="rounded-[8px] border border-success/20 bg-success-50 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="rounded-[8px] border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="flex min-h-[560px] flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Project Thread</h2>
            <p className="text-xs text-text-secondary">{messages.length} messages</p>
          </div>
          <Badge variant="purple">DB-backed</Badge>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
              <MessageSquare size={30} className="mb-3 text-text-tertiary" />
              <p className="text-sm font-semibold text-text-primary">No messages yet</p>
              <p className="mt-1 max-w-md text-sm text-text-secondary">Send a message below. It will be saved for the team to review.</p>
            </div>
          ) : messages.map((item) => {
            const own = item.senderId === user.id;
            return (
              <article key={item.id} className={`flex gap-3 ${own ? 'justify-end' : ''}`}>
                {!own && <Avatar name={item.senderName} size="sm" />}
                <div className={`max-w-2xl rounded-[8px] border px-3 py-2.5 ${own ? 'border-primary/20 bg-primary-50' : 'border-border bg-surface-secondary'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-primary">{item.senderName}</p>
                    <span className="text-xs text-text-tertiary">{formatTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{item.body}</p>
                  {item.attachmentUrl && item.attachmentName && (
                    <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-primary hover:text-primary-600">
                      {item.attachmentName}
                    </a>
                  )}
                </div>
                {own && <Avatar name={item.senderName} size="sm" />}
              </article>
            );
          })}
        </div>

        <form onSubmit={sendMessage} className="border-t border-border p-4">
          <div className="flex gap-2">
            <input
              name="body"
              placeholder="Write a message..."
              className="h-10 min-w-0 flex-1 rounded-[8px] border border-border bg-white px-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-primary/20"
              required
            />
            <FormSubmitButton pendingLabel="Sending..." className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60">
              <Send size={16} />
              Send
            </FormSubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
