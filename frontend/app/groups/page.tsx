'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api, ApiError, Group } from '@/lib/api';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .myGroups()
      .then((g) => {
        setGroups(g);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const memberPhones = members
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.createGroup({ name, memberPhones });
      setName('');
      setMembers('');
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Community wallets</h1>
        <button className="btn-ghost py-2" onClick={() => setCreating((c) => !c)}>
          {creating ? 'Close' : 'New group'}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Shared funds no single member can move alone. Any spend needs a majority vote — the t-of-n
        multisig treasury pattern (Gnosis Safe), at app scale.
      </p>

      {creating && (
        <form onSubmit={create} className="card space-y-4 mb-4">
          <div>
            <label className="label">Group name</label>
            <input
              className="input"
              placeholder="Hall Committee"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Member phones (comma-separated)</label>
            <input
              className="input"
              placeholder="01700000001, 01700000002"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">You&apos;re added automatically as a member.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || !name}>
            {busy ? 'Creating…' : 'Create group'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-400">No groups yet. Create one to get started.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="card block hover:border-brand-300 transition">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{g.name}</p>
                <span className="font-bold text-brand-600">৳{g.balanceTaka}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
