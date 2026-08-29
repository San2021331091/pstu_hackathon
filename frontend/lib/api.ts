'use client';

import { getToken, clearSession } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

const post = (path: string, body?: any) =>
  request(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });

export const api = {
  register: (body: {
    name: string;
    phone: string;
    password: string;
    accountType?: 'USER' | 'AGENT';
    pin?: string;
  }) => post('/auth/register', body) as Promise<AuthResponse>,

  login: (body: { phone: string; password: string }) =>
    post('/auth/login', body) as Promise<AuthResponse>,

  me: () => request<Account>('/accounts/me'),
  lookup: (phone: string) =>
    request<{ id: string; name: string; phone: string }>(
      `/accounts/lookup?phone=${encodeURIComponent(phone)}`,
    ),

  // Account safety (F5)
  setPin: (pin: string) => post('/accounts/pin', { pin }) as Promise<{ ok: boolean; hasPin: boolean }>,
  freeze: () => post('/accounts/freeze') as Promise<{ frozen: boolean; cancelledTransfers: number }>,
  unfreeze: (pin?: string) => post('/accounts/unfreeze', pin ? { pin } : {}) as Promise<{ frozen: boolean }>,

  // Friction transfers (F2/F3)
  initiateSend: (body: {
    recipientPhone: string;
    amount: string;
    note?: string;
    idempotencyKey: string;
  }) => post('/transfers', body) as Promise<{ transfer: Transfer; deduped?: boolean; dualConfirm?: boolean }>,
  pendingTransfers: () => request<Transfer[]>('/transfers/pending'),
  getTransfer: (id: string) => request<TransferDetail>(`/transfers/${id}`),
  cancelTransfer: (id: string) => post(`/transfers/${id}/cancel`) as Promise<Transfer>,
  finalizeTransfer: (id: string) =>
    post(`/transfers/${id}/finalize`) as Promise<{ transfer: Transfer; consensus: Consensus }>,

  history: (cursor?: string) =>
    request<HistoryPage>(`/transactions?limit=20${cursor ? `&cursor=${cursor}` : ''}`),

  // Requests (F2 - approval enters the friction pipeline)
  createRequest: (body: { payerPhone: string; amount: string; note?: string }) =>
    post('/requests', body) as Promise<MoneyRequest>,
  incomingRequests: () => request<MoneyRequest[]>('/requests/incoming'),
  outgoingRequests: () => request<MoneyRequest[]>('/requests/outgoing'),
  payRequest: (id: string) =>
    post(`/requests/${id}/pay`) as Promise<{ request: MoneyRequest; transfer: Transfer }>,
  declineRequest: (id: string) => post(`/requests/${id}/decline`) as Promise<MoneyRequest>,
  cancelRequest: (id: string) => post(`/requests/${id}/cancel`) as Promise<MoneyRequest>,

  // Flags (feeds R4 + vote-to-ban)
  flag: (phone: string, reason: string) =>
    post('/flags', { phone, reason }) as Promise<{ ok: boolean; phone: string; reports: number; riskRuleR4Active: boolean }>,
  flagCount: (phone: string) =>
    request<{ phone: string; reports: number; riskRuleR4Active: boolean }>(
      `/flags?phone=${encodeURIComponent(phone)}`,
    ),

  // Agent cash-in (F7)
  cashIn: (targetPhone: string, amount: string) =>
    post('/agent/cash-in', { targetPhone, amount }) as Promise<{
      ok: boolean;
      target: { name: string; phone: string };
      amountTaka: string;
      newBalanceTaka: string;
    }>,

  // Validators (F8)
  validators: () => request<Validator[]>('/validators'),

  // Community wallet (F4)
  createGroup: (body: { name: string; memberPhones: string[] }) =>
    post('/groups', body) as Promise<Group>,
  myGroups: () => request<Group[]>('/groups'),
  getGroup: (id: string) => request<GroupDetail>(`/groups/${id}`),
  fundGroup: (id: string, amount: string) =>
    post(`/groups/${id}/fund`, { amount }) as Promise<{ ok: boolean; groupBalanceTaka: string }>,
  propose: (id: string, body: { amount: string; recipientPhone: string; reason: string }) =>
    post(`/groups/${id}/proposals`, body) as Promise<{ id: string; status: string }>,
  voteProposal: (proposalId: string, approve: boolean) =>
    post(`/groups/proposals/${proposalId}/vote`, { approve }) as Promise<{
      status: string;
      yes?: number;
      no?: number;
      majority?: number;
    }>,

  // Ledger explorer (F6)
  ledger: (limit = 50) => request<LedgerRow[]>(`/ledger?limit=${limit}`),
  verifyLedger: () =>
    request<{ valid: boolean; count: number; brokenAtSeq?: number; headHash?: string }>('/ledger/verify'),
};

// ---- Types ----
export interface AuthResponse {
  accessToken: string;
  user: { id: string; name: string; phone: string; accountType?: 'USER' | 'AGENT' };
}
export interface Account {
  id: string;
  name: string;
  phone: string;
  accountType: 'USER' | 'AGENT';
  isAgent: boolean;
  frozen: boolean;
  hasPin: boolean;
  balancePoisha: string;
  balanceTaka: string;
}
export type TransferStatus = 'PENDING' | 'FINALIZED' | 'CANCELLED' | 'BANNED';
export interface Transfer {
  id: string;
  status: TransferStatus;
  amountTaka: string;
  note?: string | null;
  riskScore: number;
  delaySeconds: number;
  reasons: string[];
  executeAt?: string | null;
  finalizedAt?: string | null;
  createdAt: string;
  sender?: { name: string; phone: string };
  receiver?: { name: string; phone: string };
  requestId?: string;
}
export interface Consensus {
  banned: boolean;
  banVotes: number;
  total: number;
  threshold: number;
  ballots: { validator: string; ban: boolean; reason?: string }[];
}
export interface TransferDetail extends Transfer {
  ballots: { validator: string; ban: boolean; reason?: string }[];
}
export interface HistoryItem {
  id: string;
  type: string;
  direction: 'CREDIT' | 'DEBIT';
  title: string;
  note: string | null;
  counterparty: { name: string; phone: string } | null;
  amountTaka: string;
  signedAmountTaka: string;
  balanceAfterTaka: string;
  createdAt: string;
}
export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}
export interface MoneyRequest {
  id: string;
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED';
  amountTaka: string;
  note: string | null;
  requester: { name: string; phone: string };
  payer: { name: string; phone: string };
  createdAt: string;
}
export interface Validator {
  id: string;
  name: string;
  online: boolean;
  votesCast: number;
  createdAt: string;
}
export interface Group {
  id: string;
  name: string;
  balanceTaka: string;
  members: { name: string; phone: string }[];
  memberCount: number;
  createdAt: string;
}
export interface Proposal {
  id: string;
  status: 'OPEN' | 'EXECUTED' | 'REJECTED';
  amountTaka: string;
  reason: string;
  recipient?: { name: string; phone: string };
  proposer: { name: string; phone: string };
  yes: number;
  no: number;
  majorityNeeded: number;
  votes: { voter: { name: string; phone: string }; approve: boolean }[];
  createdAt: string;
}
export interface GroupDetail extends Group {
  majorityNeeded: number;
  proposals: Proposal[];
}
export interface LedgerRow {
  seq: number;
  type: string;
  account: { name: string; phone: string };
  amountTaka: string;
  balanceAfterTaka: string;
  memo: string | null;
  prevHash: string;
  hash: string;
  createdAt: string;
}
