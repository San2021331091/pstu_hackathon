'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, HistoryItem } from '@/lib/api';

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirst = async () => {
    const page = await api.history();
    setItems(page.items);
    setCursor(page.nextCursor);
    setLoading(false);
  };

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const page = await api.history(cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  };

  useEffect(() => {
    loadFirst().catch(() => setLoading(false));
  }, []);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-4">Transaction history</h1>
      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">No transactions yet.</p>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {items.map((t) => (
                <li key={t.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-sm">{t.title}</p>
                    {t.note && <p className="text-xs text-slate-400">{t.note}</p>}
                    <p className="text-xs text-slate-400">{fmtDate(t.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold text-sm ${
                        t.direction === 'CREDIT' ? 'text-green-600' : 'text-slate-700'
                      }`}
                    >
                      {t.direction === 'CREDIT' ? '+' : '−'}৳{t.amountTaka}
                    </p>
                    <p className="text-xs text-slate-400">Bal ৳{t.balanceAfterTaka}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {cursor && (
            <button
              className="btn-ghost w-full mt-4"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </AppShell>
  );
}
