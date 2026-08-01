const API_BASE = import.meta.env.VITE_API_URL || "";

function getToken(): string | null {
  return localStorage.getItem("belvo_admin_token");
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data as T;
}

// ── Types ──────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type TimelineEventType = 'milestone' | 'meeting' | 'payment' | 'document' | 'update';
export type TimelineEventStatus = 'upcoming' | 'completed' | 'cancelled';
export type MeetingStatus = 'upcoming' | 'accepted' | 'completed' | 'cancelled';

export interface AdminClientRecord {
  id: string;
  email: string;
  fullName: string | null;
  company: string | null;
  phone: string | null;
  gender: string | null;
  age: number | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  gstNumber: string | null;
  bpitNumber: string | null;
  emailNotifications: boolean;
  weeklySummary: boolean;
  twoFactorEnabled: boolean;
  createdAt: string | null;
  paymentsCount: number;
  timelineEventsCount: number;
}

export interface PaymentProofRecord {
  id: string;
  paymentId: string;
  fileName: string;
  filePath: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string | null;
}

export interface AdminPaymentRecord {
  id: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  title: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string | null;
  proofs?: PaymentProofRecord[];
}

export interface AdminTimelineEventRecord {
  id: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  title: string;
  description: string | null;
  type: TimelineEventType;
  eventDate: string | null;
  status: TimelineEventStatus;
  visibleToClient: boolean;
  createdAt: string | null;
}

export interface MeetingRecord {
  id: string;
  clientId: string | null;
  clientName?: string;
  clientEmail?: string;
  title: string;
  agenda: string | null;
  scheduledAt: string | null;
  durationMinutes: number;
  participants: string | null;
  meetingLink: string | null;
  status: MeetingStatus;
  createdAt: string | null;
}

export interface PaymentSettingsRecord {
  upiId: string | null;
  receiverName: string | null;
  qrCodePath: string | null;
  qrCodeUrl: string | null;
  updatedAt: string | null;
}

export interface VerificationDocumentRecord {
  id: string;
  clientId: string | null;
  clientName?: string;
  clientEmail?: string;
  documentType: string;
  documentNumber: string | null;
  fileName: string;
  filePath: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
}

export interface AdminDashboardData {
  totalClients: number;
  pendingPayments: number;
  overduePayments: number;
  outstandingAmount: number;
  timelineEvents: number;
  recentPayments: AdminPaymentRecord[];
  recentTimelineEvents: AdminTimelineEventRecord[];
}

export interface ChatThreadRecord {
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  lastMessage: string;
  lastMessageAt: string | null;
  lastSenderRole: string;
  messageCount: number;
}

export interface ChatMessageRecord {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
}

export interface AdminDocumentRecord {
  id: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  name: string;
  type: string;
  version: number;
  projectId: string | null;
  projectName: string | null;
  milestoneTitle: string | null;
  createdAt: string | null;
  fileSize: number | null;
  fileUrl: string | null;
}

export interface ChangeRequestRecord {
  id: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  impact: string;
  priority: string;
  description: string;
  estimatedCost: number;
  timelineImpact: string | null;
  projectName: string | null;
  adminNote: string | null;
  createdAt: string | null;
}

export interface MilestoneRecord {
  id: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  status: string;
  description: string | null;
  progress: number;
  expectedDate: string | null;
  completionDate: string | null;
  deliverables: { id?: string; name: string; fileUrl?: string }[];
}

export const paymentStatuses: PaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];
export const timelineEventTypes: TimelineEventType[] = ['milestone', 'meeting', 'payment', 'document', 'update'];
export const timelineEventStatuses: TimelineEventStatus[] = ['upcoming', 'completed', 'cancelled'];
export const meetingStatuses: MeetingStatus[] = ['upcoming', 'accepted', 'completed', 'cancelled'];

// ── Dashboard ──────────────────────────────────────────────────────

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const data = await api<{ success: boolean; data: AdminDashboardData }>('/api/admin/dashboard');
  return data.data;
}

// ── Clients ────────────────────────────────────────────────────────

export async function fetchClients(): Promise<AdminClientRecord[]> {
  const data = await api<{ success: boolean; data: AdminClientRecord[] }>('/api/admin/clients');
  return data.data;
}

export async function updateClientProfile(clientId: string, profile: Record<string, string | number | boolean | null>): Promise<void> {
  await api(`/api/admin/clients/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function deleteClient(clientId: string): Promise<void> {
  await api(`/api/admin/clients/${clientId}`, {
    method: 'DELETE',
  });
}

// ── Payments ───────────────────────────────────────────────────────

export async function fetchPayments(filters: { clientId?: string; status?: PaymentStatus } = {}): Promise<AdminPaymentRecord[]> {
  const params = new URLSearchParams();
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  const data = await api<{ success: boolean; data: AdminPaymentRecord[] }>(`/api/admin/payments${qs ? `?${qs}` : ''}`);
  return data.data;
}

export async function createPayment(payment: {
  clientId: string;
  title: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  dueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
}): Promise<void> {
  await api('/api/admin/payments', {
    method: 'POST',
    body: JSON.stringify(payment),
  });
}

export async function updatePayment(
  id: string,
  payment: {
    title: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    dueDate?: string | null;
    paidAt?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  await api(`/api/admin/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payment),
  });
}

export async function cancelPayment(id: string): Promise<void> {
  await api(`/api/admin/payments/${id}/cancel`, {
    method: 'POST',
  });
}

export async function fetchPaymentSettings(): Promise<PaymentSettingsRecord> {
  const data = await api<{ success: boolean; data: PaymentSettingsRecord }>('/api/admin/payment-settings');
  return data.data;
}

export async function savePaymentSettings(form: { upiId: string; receiverName?: string; qrCode?: File | null }): Promise<void> {
  const body = new FormData();
  body.append('upiId', form.upiId);
  if (form.receiverName) body.append('receiverName', form.receiverName);
  if (form.qrCode) body.append('qrCode', form.qrCode);
  await api('/api/admin/payment-settings', {
    method: 'PUT',
    body,
  });
}

// ── Meetings ───────────────────────────────────────────────────────

export async function fetchMeetings(): Promise<MeetingRecord[]> {
  const data = await api<{ success: boolean; data: MeetingRecord[] }>('/api/admin/meetings');
  return data.data;
}

export async function createMeeting(meeting: {
  clientId: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  agenda?: string;
  participants?: string;
  meetingLink?: string;
  status?: MeetingStatus;
}): Promise<void> {
  await api('/api/admin/meetings', {
    method: 'POST',
    body: JSON.stringify(meeting),
  });
}

export async function updateMeetingStatus(id: string, status: MeetingStatus): Promise<void> {
  await api(`/api/admin/meetings/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function deleteMeeting(id: string): Promise<void> {
  await api(`/api/admin/meetings/${id}`, {
    method: 'DELETE',
  });
}

// ── Timeline ───────────────────────────────────────────────────────

export async function fetchTimeline(filters: { clientId?: string; type?: TimelineEventType; status?: TimelineEventStatus } = {}): Promise<AdminTimelineEventRecord[]> {
  const params = new URLSearchParams();
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  const data = await api<{ success: boolean; data: AdminTimelineEventRecord[] }>(`/api/admin/timeline${qs ? `?${qs}` : ''}`);
  return data.data;
}

export async function createTimelineEvent(event: {
  clientId: string;
  title: string;
  description?: string | null;
  type: TimelineEventType;
  status: TimelineEventStatus;
  eventDate: string;
  visibleToClient: boolean;
}): Promise<void> {
  await api('/api/admin/timeline', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function updateTimelineEvent(
  id: string,
  event: {
    clientId: string;
    title: string;
    description?: string | null;
    type: TimelineEventType;
    status: TimelineEventStatus;
    eventDate: string;
    visibleToClient: boolean;
  }
): Promise<void> {
  await api(`/api/admin/timeline/${id}`, {
    method: 'PUT',
    body: JSON.stringify(event),
  });
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  await api(`/api/admin/timeline/${id}`, {
    method: 'DELETE',
  });
}

// ── Verification ───────────────────────────────────────────────────

export async function fetchVerificationDocuments(): Promise<VerificationDocumentRecord[]> {
  const data = await api<{ success: boolean; data: VerificationDocumentRecord[] }>('/api/admin/verification');
  return data.data;
}

export async function verifyDocument(id: string, decision: 'approved' | 'rejected', rejectionReason?: string): Promise<void> {
  await api(`/api/admin/verification/${id}`, {
    method: 'POST',
    body: JSON.stringify({ decision, rejectionReason: rejectionReason || undefined }),
  });
}

export async function approveClientDocuments(clientId: string): Promise<void> {
  await api('/api/admin/verification/approve-all', {
    method: 'POST',
    body: JSON.stringify({ clientId }),
  });
}

// ── Chat ───────────────────────────────────────────────────────────

export async function fetchChatThreads(): Promise<ChatThreadRecord[]> {
  const data = await api<{ success: boolean; data: ChatThreadRecord[] }>('/api/admin/chat');
  return data.data;
}

export async function fetchChatMessages(clientId: string): Promise<ChatMessageRecord[]> {
  const data = await api<{ success: boolean; data: ChatMessageRecord[] }>(`/api/admin/chat/${encodeURIComponent(clientId)}`);
  return data.data;
}

export async function sendAdminChatMessage(clientId: string, body: string): Promise<void> {
  await api(`/api/admin/chat/${encodeURIComponent(clientId)}`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

// ── Client documents ───────────────────────────────────────────────

export async function fetchAdminDocuments(): Promise<AdminDocumentRecord[]> {
  const data = await api<{ success: boolean; data: AdminDocumentRecord[] }>('/api/admin/documents');
  return data.data;
}

// ── Change requests ────────────────────────────────────────────────

export async function fetchChangeRequests(): Promise<ChangeRequestRecord[]> {
  const data = await api<{ success: boolean; data: ChangeRequestRecord[] }>('/api/admin/change-requests');
  return data.data;
}

export async function updateChangeRequest(id: string, status: ChangeRequestRecord['status'], adminNote?: string): Promise<void> {
  await api(`/api/admin/change-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status, adminNote: adminNote || undefined }),
  });
}

// ── Milestones ─────────────────────────────────────────────────────

export async function fetchAdminMilestones(): Promise<MilestoneRecord[]> {
  const data = await api<{ success: boolean; data: MilestoneRecord[] }>('/api/admin/milestones');
  return data.data;
}

export async function createMilestone(milestone: {
  clientId: string;
  title: string;
  projectId?: string | null;
  projectName?: string | null;
  description?: string | null;
  status?: string;
  progress?: number;
  expectedDate?: string | null;
}): Promise<void> {
  await api('/api/admin/milestones', {
    method: 'POST',
    body: JSON.stringify(milestone),
  });
}

export async function updateMilestone(
  id: string,
  milestone: {
    title?: string;
    description?: string | null;
    status?: string;
    progress?: number;
    expectedDate?: string | null;
  }
): Promise<void> {
  await api(`/api/admin/milestones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(milestone),
  });
}
