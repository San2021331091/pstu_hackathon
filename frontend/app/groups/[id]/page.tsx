'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api, ApiError, GroupDetail } from '@/lib/api';

const propColor: Record<string, string> = {
  OPEN: 'text-amber-600 bg-amber-50',
  EXECUTED: 'text-green-700 bg-green-50',
  REJECTED: 'text-red-600 bg-red-50',
};

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // fund
  const [fundAmount, setFundAmount] = useState('');
  // propose
  const [pAmount, setPAmount] = useState('');
  const [pRecipient, setPRecipient] = useState('');
  const [pReason, setPReason] = useState('');

  const load = useCallback(() => {
    return api
      .getGroup(id)
      .then((g) => {
        setGroup(g);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const fund = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.fundGroup(id, fundAmount);
      setFundAmount('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Funding failed');
    } finally {
      setBusy(false);
    }
  };

  const propose = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.propose(id, { amount: pAmount, recipientPhone: pRecipient, reason: pReason });
      setPAmount('');
      setPRecipient('');
      setPReason('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Proposal failed');
    } finally {
      setBusy(false);
    }
  };

  const vote = async (proposalId: string, approve: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api.voteProposal(proposalId, approve);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Vote failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <p className="text-slate-400">Loading…</p>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell>
        <p className="text-sm text-slate-400">Group not found.</p>
        <Link href="/groups" className="text-brand-600 text-sm font-medium">
          Back to groups
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href="/groups" className="text-sm text-slate-400">
        ← All wallets
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white p-6 shadow-md mt-2">
        <p className="text-brand-100 text-sm">{group.name}</p>
        <p className="text-3xl font-bold mt-1">৳{group.balanceTaka}</p>
        <p className="text-brand-100 text-xs mt-2">
          {group.memberCount} members · majority = {group.majorityNeeded} yes votes
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {/* Members */}
      <div className="card mt-4">
        <h3 className="font-semibold text-sm mb-2">Members</h3>
        <div className="flex flex-wrap gap-2">
          {group.members.map((m) => (
            <span key={m.phone} className="text-xs bg-slate-100 rounded-full px-2.5 py-1">
              {m.name}
            </span>
          ))}
        </div>
      </div>

      {/* Fund */}
      <form onSubmit={fund} className="card mt-4 space-y-3">
        <h3 className="font-semibold text-sm">Add funds from your balance</h3>
        <div className="flex gap-2">
          <input
            className="input"
            inputMode="decimal"
            placeholder="1000"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
          />
          <button className="btn-primary" disabled={busy || !fundAmount}>
            Fund
          </button>
        </div>
      </form>

      {/* Propose */}
      <form onSubmit={propose} className="card mt-4 space-y-3">
        <h3 className="font-semibold text-sm">Propose a spend</h3>
        <input
          className="input"
          inputMode="decimal"
          placeholder="Amount (৳)"
          value={pAmount}
          onChange={(e) => setPAmount(e.target.value)}
        />
        <input
          className="input"
          placeholder="Recipient phone"
          value={pRecipient}
          onChange={(e) => setPRecipient(e.target.value)}
        />
        <input
          className="input"
          placeholder="Reason (e.g. venue booking)"
          value={pReason}
          onChange={(e) => setPReason(e.target.value)}
        />
        <button className="btn-primary w-full" disabled={busy || !pAmount || !pRecipient}>
          Create proposal
        </button>
      </form>

      {/* Proposals */}
      <h3 className="font-semibold mt-6 mb-2">Proposals</h3>
      {group.proposals.length === 0 ? (
        <p className="text-sm text-slate-400">No proposals yet.</p>
      ) : (
        <div className="space-y-3">
          {group.proposals.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  ৳{p.amountTaka} → {p.recipient?.name ?? p.recipient?.phone ?? 'recipient'}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${propColor[p.status]}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{p.reason}</p>
              <p className="text-xs text-slate-400 mt-1">
                Proposed by {p.proposer.name} · {p.yes} yes / {p.no} no · need {p.majorityNeeded} yes
              </p>

              {p.status === 'OPEN' && (
                <div className="flex gap-2 mt-3">
                  <button className="btn-primary flex-1 py-2" disabled={busy} onClick={() => vote(p.id, true)}>
                    Vote yes
                  </button>
                  <button className="btn-danger flex-1 py-2" disabled={busy} onClick={() => vote(p.id, false)}>
                    Vote no
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
