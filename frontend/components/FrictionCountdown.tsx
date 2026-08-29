'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, Transfer, Consensus } from '@/lib/api';

function secondsUntil(executeAt?: string | null): number {
  if (!executeAt) return 0;
  return Math.max(0, Math.ceil((new Date(executeAt).getTime() - Date.now()) / 1000));
}

/**
 * Renders the friction window for a PENDING transfer (F2):
 *  - shows which Risk Engine rules fired and why the hold applies
 *  - live countdown; Cancel refunds instantly
 *  - at zero it finalizes, running 2-of-3 validator consensus (F3) and
 *    showing whether the transfer was delivered or banned.
 */
export default function FrictionCountdown({
  transfer,
  onResolved,
}: {
  transfer: Transfer;
  onResolved?: () => void;
}) {
  const [left, setLeft] = useState(secondsUntil(transfer.executeAt));
  const [status, setStatus] = useState(transfer.status);
  const [consensus, setConsensus] = useState<Consensus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finalizing = useRef(false);

  useEffect(() => {
    if (status !== 'PENDING') return;
    const t = setInterval(() => setLeft(secondsUntil(transfer.executeAt)), 500);
    return () => clearInterval(t);
  }, [status, transfer.executeAt]);

  useEffect(() => {
    if (status === 'PENDING' && left <= 0 && !finalizing.current) {
      void finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, status]);

  async function finalize() {
    if (finalizing.current) return;
    finalizing.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.finalizeTransfer(transfer.id);
      setStatus(res.transfer.status);
      setConsensus(res.consensus);
      onResolved?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Finalize failed');
      finalizing.current = false; // allow retry
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      const res = await api.cancelTransfer(transfer.id);
      setStatus(res.status);
      onResolved?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  const pct =
    transfer.delaySeconds > 0
      ? Math.min(100, Math.round(((transfer.delaySeconds - left) / transfer.delaySeconds) * 100))
      : 100;

  if (status === 'FINALIZED') {
    return (
      <div className="card border-emerald-200 bg-emerald-50">
        <p className="font-semibold text-emerald-800">✅ Sent — ৳{transfer.amountTaka}</p>
        <p className="text-sm text-emerald-700 mt-1">
          Delivered to {transfer.receiver?.name ?? 'recipient'}. Validators approved it
          {consensus ? ` (${consensus.total - consensus.banVotes}/${consensus.total} in favour).` : '.'}
        </p>
      </div>
    );
  }

  if (status === 'BANNED') {
    return (
      <div className="card border-red-200 bg-red-50">
        <p className="font-semibold text-red-800">⛔ Blocked by validator consensus</p>
        <p className="text-sm text-red-700 mt-1">
          {consensus
            ? `${consensus.banVotes} of ${consensus.total} validators voted to ban (threshold ${consensus.threshold}).`
            : 'This transfer was banned.'}{' '}
          Your ৳{transfer.amountTaka} was refunded.
        </p>
        {consensus?.ballots?.length ? (
          <ul className="mt-2 text-xs text-red-600 space-y-0.5">
            {consensus.ballots.map((b) => (
              <li key={b.validator}>
                {b.ban ? '🚫' : '✔️'} {b.validator}
                {b.reason ? ` — ${b.reason}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (status === 'CANCELLED') {
    return (
      <div className="card border-slate-200 bg-slate-50">
        <p className="font-semibold text-slate-700">Cancelled</p>
        <p className="text-sm text-slate-500 mt-1">
          The hold on ৳{transfer.amountTaka} was refunded to your balance.
        </p>
      </div>
    );
  }

  // PENDING
  const highRisk = transfer.riskScore >= 70;
  return (
    <div className={`card ${highRisk ? 'border-amber-300 bg-amber-50' : 'border-brand-200 bg-brand-50'}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          Holding ৳{transfer.amountTaka} → {transfer.receiver?.name ?? transfer.receiver?.phone}
        </p>
        <span className="text-2xl font-bold tabular-nums">{left > 0 ? `${left}s` : '…'}</span>
      </div>

      <div className="mt-2 h-2 w-full rounded-full bg-white/70 overflow-hidden">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <p className="text-xs mt-2 text-slate-500">
        Risk score {transfer.riskScore}. This short, cancellable hold is what stops a scam or a
        fat-fingered transfer before the money is gone.
      </p>

      {transfer.reasons.length > 0 && (
        <ul className="mt-2 text-sm space-y-1">
          {transfer.reasons.map((r, i) => (
            <li key={i} className="text-slate-700">• {r}</li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button className="btn-danger flex-1" onClick={cancel} disabled={busy}>
          Cancel & refund
        </button>
        <button className="btn-primary flex-1" onClick={finalize} disabled={busy || left > 0}>
          {left > 0 ? `Finalizes in ${left}s` : busy ? 'Finalizing…' : 'Finalize now'}
        </button>
      </div>
    </div>
  );
}
