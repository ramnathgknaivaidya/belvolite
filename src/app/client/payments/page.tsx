'use client';

import { ClientPaymentsView } from '@/components/client/client-payments-view';
import { useState, useEffect } from 'react';

const MOCK_PAYMENTS = [
  { id: 'mock-pay-1', invoiceNumber: 'INV-001', title: 'Initial deposit', amount: 150000, currency: 'INR', status: 'pending', dueDate: '2026-08-15T00:00:00.000Z', projectName: 'Website Redesign', description: 'Initial deposit' },
  { id: 'mock-pay-2', invoiceNumber: 'INV-002', title: 'Milestone 1 payment', amount: 200000, currency: 'INR', status: 'paid', dueDate: '2026-07-01T00:00:00.000Z', projectName: 'Website Redesign', description: 'Milestone 1 payment', paidAt: '2026-06-28T00:00:00.000Z' },
  { id: 'mock-pay-3', invoiceNumber: 'INV-003', title: 'Design phase payment', amount: 75000, currency: 'INR', status: 'overdue', dueDate: '2026-06-01T00:00:00.000Z', projectName: 'Mobile App', description: 'Design phase payment' },
];

const MOCK_PAYMENT_SETTINGS = { upiId: 'belvo@upi', receiverName: 'Belvo', qrCodeUrl: null };

export default function PaymentsPage() {
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [payments, setPayments] = useState<any[] | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<any | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/client/payments');
        if (res.ok) {
          const json = await res.json();
          setPayments(json.payments && json.payments.length > 0 ? json.payments : MOCK_PAYMENTS);
          setPaymentSettings(json.settings || MOCK_PAYMENT_SETTINGS);
          return;
        }
      } catch {
        // fall through to mocks
      }
      setPayments(MOCK_PAYMENTS);
      setPaymentSettings(MOCK_PAYMENT_SETTINGS);
    }
    fetchData();
  }, []);

  if (!payments || !paymentSettings) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  return <ClientPaymentsView payments={payments} paymentSettings={paymentSettings} message={message} error={error} />;
}
