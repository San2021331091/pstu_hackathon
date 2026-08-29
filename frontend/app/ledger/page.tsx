'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, LedgerRow } from '@/lib/api';

function short(hash: string) {
  if (!hash) return '—';
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

export default function LedgerPage() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [verify, setVerify] = useState<{ valid: boolean; count: number; brokenAtSeq?: number; headHash?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = () =>
    api
      .ledger(100)
      .then((r) => {
        setRows(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const runVerify = async () => {
    setVerifying(true);
    try {
      setVerify(await api.verifyLedger());
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-1">Ledger explorer</h1>
      <p className="text-sm text-slate-500 mb-4">
        Every entry stores the hash of the entry before it (SHA-256 hash-chain). Edit any past row
        and the chain breaks — the same tamper-evidence as Bitcoin/Ethereum block headers.
      </p>

      <div className="card mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Chain integrity</p>
          {verify ? (
            verify.valid ? (
              <p className="font-semibold text-emerald-700">
                ✅ Valid · {verify.count} entries
              </p>
            ) : (
              <p className="font-semibold text-red-700">
                ⛔ Broken at seq #{verify.brokenAtSeq}
              </p>
            )
          ) : (
            <p className="font-semibold text-slate-700">Not verified yet</p>
          )}
          {verify?.headHash && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">head {short(verify.headHash)}</p>
          )}
        </div>
        <button className="btn-primary" onClick={runVerify} disabled={verifying}>
          {verifying ? 'Verifying…' : 'Verify chain'}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No ledger entries yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.seq} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">#{r.seq}</span>
                  <span className="text-sm font-medium">{r.type}</span>
                </div>
                <span
                  className={`font-semibold text-sm ${
                    r.amountTaka.startsWith('-') ? 'text-slate-700' : 'text-emerald-600'
                  }`}
                >
                  ৳{r.amountTaka}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {r.account.name} · bal ৳{r.balanceAfterTaka}
                {r.memo ? ` · ${r.memo}` : ''}
              </p>
              <div className="text-[10px] text-slate-400 font-mono mt-1 flex gap-3">
                <span>prev {short(r.prevHash)}</span>
                <span>hash {short(r.hash)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
