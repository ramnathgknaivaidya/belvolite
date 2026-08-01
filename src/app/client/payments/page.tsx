'use client';

import { ClientPaymentsView } from '@/components/client/client-payments-view';
import { useState, useEffect } from 'react';

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
          setPayments(Array.isArray(json.payments) ? json.payments : []);
          setPaymentSettings(json.settings || { upiId: null, receiverName: null, qrCodeUrl: null });
          return;
        }
      } catch {
        // leave empty on error
      }
      setPayments([]);
      setPaymentSettings({ upiId: null, receiverName: null, qrCodeUrl: null });
    }
    fetchData();
  }, []);

  if (!payments || !paymentSettings) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  return <ClientPaymentsView payments={payments} paymentSettings={paymentSettings} message={message} error={error} />;
}
