'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import FrictionCountdown from '@/components/FrictionCountdown';
import { api, ApiError, Account, HistoryItem, MoneyRequest, Transfer } from '@/lib/api';

export default function DashboardPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [incoming, setIncoming] = useState<MoneyRequest[]>([]);
  const [pending, setPending] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Security controls
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [acc, hist, inc, pend] = await Promise.all([
      api.me(),
      api.history(),
      api.incomingRequests(),
      api.pendingTransfers(),
    ]);
    setAccount(acc);
    setRecent(hist.items.slice(0, 5));
    setIncoming(inc.filter((r) => r.status === 'PENDING'));
    setPending(pend);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const freeze = async () => {
    setBusy(true);
    setNotice('');
    try {
      const res = await api.freeze();
      setNotice(
        `Account frozen. ${res.cancelledTransfers} pending transfer(s) cancelled and refunded.`,
      );
      await load();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'Freeze failed');
    } finally {
      setBusy(false);
    }
  };

  const unfreeze = async () => {
    setBusy(true);
    setNotice('');
    try {
      await api.unfreeze(account?.hasPin ? pin : undefined);
      setPin('');
      setNotice('Account unfrozen.');
      await load();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'Unfreeze failed (wrong PIN?)');
    } finally {
      setBusy(false);
    }
  };

  const savePin = async () => {
    setBusy(true);
    setNotice('');
    try {
      await api.setPin(pin);
      setPin('');
      setShowPin(false);
      setNotice('PIN set. It will be required to unfreeze your account.');
      await load();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'Could not set PIN');
    } finally {
      setBusy(false);
    }
  };

  const features: { href: string; label: string; desc: string; show: boolean }[] = [
    { href: '/agent', label: 'Agent cash-in', desc: 'Top up a user with cash', show: !!account?.isAgent },
    { href: '/groups', label: 'Community wallet', desc: 'Group funds, vote to spend', show: true },
    { href: '/validators', label: 'Validators', desc: 'Network health & votes', show: true },
    { href: '/ledger', label: 'Ledger explorer', desc: 'Verify the hash-chain', show: true },
    { href: '/report', label: 'Report a user', desc: 'Flag a suspicious account', show: true },
  ];

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Frozen banner */}
          {account?.frozen && (
            <div className="card border-red-300 bg-red-50">
              <p className="font-semibold text-red-800">🔒 Account frozen</p>
              <p className="text-sm text-red-700 mt-1">
                New sends are blocked and all pending transfers were cancelled. Unfreeze below
                {account.hasPin ? ' with your PIN' : ''} to resume.
              </p>
            </div>
          )}

          {/* Balance */}
          <div className="rounded-2xl bg-gradient-to-br from-green-600 to-brand-700 text-white p-6 shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-brand-100 text-sm">Available balance</p>
              {account?.isAgent && (
                <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">AGENT</span>
              )}
            </div>
            <p className="text-4xl font-bold mt-1">৳{account?.balanceTaka}</p>
            <p className="text-brand-100 text-sm mt-3">
              {account?.name} · {account?.phone}
            </p>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/send"
              className={`btn-primary py-4 text-base ${account?.frozen ? 'pointer-events-none opacity-50' : ''}`}
            >
              Send money
            </Link>
            <Link href="/request" className="btn-ghost py-4 text-base">
              Request money
            </Link>
          </div>

          {/* Pending (in friction window) */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">In the friction window</h3>
              {pending.map((t) => (
                <FrictionCountdown key={t.id} transfer={t} onResolved={load} />
              ))}
            </div>
          )}

          {/* Security / Emergency Freeze */}
          <div className="card">
            <h3 className="font-semibold mb-1">Security</h3>
            <p className="text-xs text-slate-400 mb-3">
              Emergency Freeze instantly cancels every pending outgoing transfer and blocks new
              sends — your one-tap panic button.
            </p>

            {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-lg p-2 mb-3">{notice}</p>}

            {(account?.hasPin || showPin) && (
              <input
                className="input mb-3"
                inputMode="numeric"
                type="password"
                placeholder={account?.hasPin ? 'Enter PIN to unfreeze' : 'Choose a 4–6 digit PIN'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            )}

            <div className="flex flex-wrap gap-2">
              {!account?.frozen ? (
                <button className="btn-danger" onClick={freeze} disabled={busy}>
                  🔒 Freeze my account
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={unfreeze}
                  disabled={busy || (!!account?.hasPin && !pin)}
                >
                  Unfreeze
                </button>
              )}

              {!account?.hasPin && !showPin && (
                <button className="btn-ghost" onClick={() => setShowPin(true)} disabled={busy}>
                  Set a PIN
                </button>
              )}
              {!account?.hasPin && showPin && (
                <button className="btn-primary" onClick={savePin} disabled={busy || pin.length < 4}>
                  Save PIN
                </button>
              )}
            </div>
          </div>

          {/* More features */}
          <div className="grid grid-cols-2 gap-3">
            {features
              .filter((f) => f.show)
              .map((f) => (
                <Link key={f.href} href={f.href} className="card hover:border-brand-300 transition">
                  <p className="font-medium text-sm">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                </Link>
              ))}
          </div>

          {/* Pending requests to pay */}
          {incoming.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3">Requests to pay</h3>
              <div className="space-y-2">
                {incoming.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>
                      <b>{r.requester.name}</b> requests ৳{r.amountTaka}
                    </span>
                    <Link href="/request" className="text-brand-600 font-medium">
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Recent activity</h3>
              <Link href="/history" className="text-sm text-brand-600">
                See all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-400">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm">{t.title}</p>
                      {t.note && <p className="text-xs text-slate-400">{t.note}</p>}
                    </div>
                    <span
                      className={`font-semibold text-sm ${
                        t.direction === 'CREDIT' ? 'text-green-600' : 'text-slate-700'
                      }`}
                    >
                      {t.direction === 'CREDIT' ? '+' : '−'}৳{t.amountTaka}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
