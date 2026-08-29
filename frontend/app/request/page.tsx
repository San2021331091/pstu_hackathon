'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import FrictionCountdown from '@/components/FrictionCountdown';
import { api, ApiError, MoneyRequest, Transfer } from '@/lib/api';

type Tab = 'create' | 'incoming' | 'outgoing';

const statusColor: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50',
  PAID: 'text-green-700 bg-green-50',
  DECLINED: 'text-red-600 bg-red-50',
  CANCELLED: 'text-slate-500 bg-slate-100',
};

export default function RequestPage() {
  const [tab, setTab] = useState<Tab>('create');
  const [incoming, setIncoming] = useState<MoneyRequest[]>([]);
  const [outgoing, setOutgoing] = useState<MoneyRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // When a request is approved, the resulting transfer enters the SAME friction
  // window as a normal send — we surface it here.
  const [pending, setPending] = useState<Transfer | null>(null);

  // create form
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const [inc, out] = await Promise.all([
      api.incomingRequests(),
      api.outgoingRequests(),
    ]);
    setIncoming(inc);
    setOutgoing(out);
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.createRequest({ payerPhone: phone, amount, note: note || undefined });
      setSuccess(`Requested ৳${amount} from ${phone}.`);
      setPhone('');
      setAmount('');
      setNote('');
      await refresh();
      setTab('outgoing');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const pay = async (r: MoneyRequest) => {
    setBusyId(r.id);
    try {
      const res = await api.payRequest(r.id);
      // Approval kicks off a scored, cancellable transfer — show its countdown.
      setPending(res.transfer);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Payment failed');
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (r: MoneyRequest) => {
    setBusyId(r.id);
    try {
      await api.declineRequest(r.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (r: MoneyRequest) => {
    setBusyId(r.id);
    try {
      await api.cancelRequest(r.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const Badge = ({ status }: { status: string }) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[status]}`}>
      {status}
    </span>
  );

  // Paying a request: hand over to the friction window.
  if (pending) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold mb-4">Paying request</h1>
        <FrictionCountdown transfer={pending} />
        <button
          className="btn-ghost w-full mt-4"
          onClick={() => {
            setPending(null);
            setTab('incoming');
            refresh().catch(() => {});
          }}
        >
          Back to requests
        </button>
        <p className="text-xs text-slate-400 text-center mt-3">
          Approving a request runs it through the same Risk Engine and friction hold as a
          direct send — nothing skips the safety window.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-4">Request money</h1>

      <div className="flex gap-2 mb-4">
        {(['create', 'incoming', 'outgoing'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              tab === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t === 'incoming'
              ? `To pay (${incoming.filter((r) => r.status === 'PENDING').length})`
              : t}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <form onSubmit={create} className="card space-y-4">
          <div>
            <label className="label">Collect from (phone)</label>
            <input
              className="input"
              placeholder="01712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Amount (৳)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="1200"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input
              className="input"
              placeholder="For last week"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <button className="btn-primary w-full" disabled={loading || !phone || !amount}>
            {loading ? 'Sending request…' : 'Send request'}
          </button>
        </form>
      )}

      {tab === 'incoming' && (
        <div className="space-y-3">
          {incoming.length === 0 && (
            <p className="text-sm text-slate-400">No incoming requests.</p>
          )}
          {incoming.map((r) => (
            <div key={r.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {r.requester.name} wants ৳{r.amountTaka}
                </p>
                {r.note && <p className="text-xs text-slate-400">{r.note}</p>}
                <div className="mt-1"><Badge status={r.status} /></div>
              </div>
              {r.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    className="btn-primary py-2"
                    disabled={busyId === r.id}
                    onClick={() => pay(r)}
                  >
                    Pay
                  </button>
                  <button
                    className="btn-danger py-2"
                    disabled={busyId === r.id}
                    onClick={() => decline(r)}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'outgoing' && (
        <div className="space-y-3">
          {outgoing.length === 0 && (
            <p className="text-sm text-slate-400">You haven&apos;t requested anything yet.</p>
          )}
          {outgoing.map((r) => (
            <div key={r.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">
                  ৳{r.amountTaka} from {r.payer.name}
                </p>
                {r.note && <p className="text-xs text-slate-400">{r.note}</p>}
                <div className="mt-1"><Badge status={r.status} /></div>
              </div>
              {r.status === 'PENDING' && (
                <button
                  className="btn-ghost py-2"
                  disabled={busyId === r.id}
                  onClick={() => cancel(r)}
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
