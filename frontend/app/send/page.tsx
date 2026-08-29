'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import FrictionCountdown from '@/components/FrictionCountdown';
import { api, ApiError, Transfer, newIdempotencyKey } from '@/lib/api';

export default function SendPage() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState<{ name: string; phone: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // The PENDING transfer currently in its friction window, if any.
  const [pending, setPending] = useState<Transfer | null>(null);

  // Generated ONCE per send attempt and reused on retry, so a flaky network or
  // double click can never open two holds for the same intended transfer.
  const idemKey = useRef<string | null>(null);

  const verify = async () => {
    setError('');
    setRecipient(null);
    try {
      const r = await api.lookup(phone);
      setRecipient(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lookup failed');
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!idemKey.current) idemKey.current = newIdempotencyKey();
    setLoading(true);
    try {
      const res = await api.initiateSend({
        recipientPhone: phone,
        amount,
        note: note || undefined,
        idempotencyKey: idemKey.current,
      });
      idemKey.current = null; // fresh key for the next distinct send
      setPending(res.transfer);
    } catch (err) {
      // Keep idemKey so a retry is deduped to the same hold.
      setError(err instanceof ApiError ? err.message : 'Send failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPending(null);
    setAmount('');
    setNote('');
    setError('');
    setRecipient(null);
    setPhone('');
  };

  if (pending) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold mb-4">Sending money</h1>
        <FrictionCountdown transfer={pending} />
        <button className="btn-ghost w-full mt-4" onClick={reset}>
          Send another
        </button>
        <p className="text-xs text-slate-400 text-center mt-3">
          The hold is fully cancellable until it finalizes — this is the friction window
          that stops scams and mistakes before the money is gone.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-4">Send money</h1>
      <form onSubmit={send} className="card space-y-4">
        <div>
          <label className="label">Recipient phone</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="01712345678"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setRecipient(null);
              }}
            />
            <button type="button" className="btn-ghost" onClick={verify}>
              Verify
            </button>
          </div>
          {recipient && (
            <p className="text-sm text-green-600 mt-2">
              ✓ Sending to <b>{recipient.name}</b>
            </p>
          )}
        </div>

        <div>
          <label className="label">Amount (৳)</label>
          <input
            className="input"
            inputMode="decimal"
            placeholder="2500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">
            Larger amounts and first-time recipients get a longer safety hold.
          </p>
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input
            className="input"
            placeholder="Lunch, rent, etc."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn-primary w-full" disabled={loading || !recipient || !amount}>
          {loading ? 'Scoring risk…' : 'Review & send'}
        </button>
        {!recipient && (
          <p className="text-xs text-slate-400 text-center">
            Verify the recipient before sending.
          </p>
        )}
      </form>

      <p className="text-xs text-slate-400 text-center mt-4">
        Worried about a recipient?{' '}
        <Link href="/report" className="text-brand-600 font-medium">
          Report them
        </Link>{' '}
        — 3+ reports raises everyone&apos;s risk score against that account.
      </p>
    </AppShell>
  );
}
