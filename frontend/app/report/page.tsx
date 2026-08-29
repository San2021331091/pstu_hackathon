'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

export default function ReportPage() {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ phone: string; reports: number; r4: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await api.flag(phone, reason || 'Suspicious activity');
      setResult({ phone: res.phone, reports: res.reports, r4: res.riskRuleR4Active });
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Report failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-1">Report a user</h1>
      <p className="text-sm text-slate-500 mb-4">
        Flagging feeds risk rule <b>R4</b>. Once an account is reported by 3+ separate users, every
        transfer to it gets the maximum friction hold — and validators will vote to ban it.
      </p>

      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Account phone</label>
          <input
            className="input"
            placeholder="01712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Reason</label>
          <input
            className="input"
            placeholder="Scam, impersonation, wrong recipient…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <div
            className={`card ${
              result.r4 ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p className={`font-semibold ${result.r4 ? 'text-red-800' : 'text-amber-800'}`}>
              {result.phone} now has {result.reports} report{result.reports === 1 ? '' : 's'}
            </p>
            <p className={`text-sm mt-1 ${result.r4 ? 'text-red-700' : 'text-amber-700'}`}>
              {result.r4
                ? 'R4 is now ACTIVE — max friction + validators will vote to ban transfers to this account.'
                : `${Math.max(0, 3 - result.reports)} more report(s) until R4 activates.`}
            </p>
          </div>
        )}
        <button className="btn-danger w-full" disabled={loading || !phone}>
          {loading ? 'Reporting…' : 'Submit report'}
        </button>
      </form>
    </AppShell>
  );
}
