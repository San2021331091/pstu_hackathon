'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api, ApiError, Account } from '@/lib/api';

export default function AgentPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ name: string; phone: string; amountTaka: string; newBalanceTaka: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.me().then(setAccount).catch(() => {});
  }, []);

  const cashIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await api.cashIn(phone, amount);
      setResult({
        name: res.target.name,
        phone: res.target.phone,
        amountTaka: res.amountTaka,
        newBalanceTaka: res.newBalanceTaka,
      });
      setPhone('');
      setAmount('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cash-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-1">Agent cash-in</h1>
      <p className="text-sm text-slate-500 mb-4">
        The on-ramp: convert a customer&apos;s physical cash into digital balance. Tagged
        distinctly in the ledger for reconciliation — like a Stellar &ldquo;anchor.&rdquo;
      </p>

      {account && !account.isAgent ? (
        <div className="card border-amber-300 bg-amber-50">
          <p className="font-semibold text-amber-800">Agent account required</p>
          <p className="text-sm text-amber-700 mt-1">
            This screen is only for Agent accounts. Register a new account and pick
            &ldquo;Agent&rdquo; to try cash-in.
          </p>
          <Link href="/dashboard" className="text-brand-600 text-sm font-medium mt-2 inline-block">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <form onSubmit={cashIn} className="card space-y-4">
          <div>
            <label className="label">Customer phone</label>
            <input
              className="input"
              placeholder="01712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cash amount (৳)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && (
            <div className="card border-emerald-200 bg-emerald-50">
              <p className="font-semibold text-emerald-800">
                ✅ Cashed in ৳{result.amountTaka} to {result.name}
              </p>
              <p className="text-sm text-emerald-700 mt-1">
                {result.phone} · new balance ৳{result.newBalanceTaka}
              </p>
            </div>
          )}
          <button className="btn-primary w-full" disabled={loading || !phone || !amount}>
            {loading ? 'Processing…' : 'Cash in'}
          </button>
        </form>
      )}
    </AppShell>
  );
}
