# Payflow — A Friction-First Money Movement Platform

PSTU IT Carnival 2026 · Hackathon Challenge
**Stack:** Next.js (frontend) · NestJS + Prisma + PostgreSQL (backend)

> **"Instantaneity is not the first priority. Safety is."**

Payflow is a closed-ecosystem money app where users register (and get **৳100,000**
demo funds), **send** and **request/collect** money by phone number, and see a full
**transaction history** — but unlike a typical instant-transfer clone, every transfer
is **scored by a Risk Engine** and passes through a **short, cancellable friction
window** before the money actually moves. Long enough to stop a scam or a fat-fingered
transfer; short enough not to annoy a normal send to a saved contact.

Money is stored as integer **poisha** (`BigInt`, 1 taka = 100 poisha) — never floats —
and moves through a single audited primitive that writes a **hash-chained, double-entry
ledger**.

---

## 1. Run it (≈5 minutes)

**Prerequisites:** Node 18+, Docker (for Postgres), npm.

```bash
# ── Backend ──────────────────────────────────────────────
cd backend
cp .env.example .env              # DATABASE_URL matches docker-compose
docker compose up -d              # Postgres 16 on :5432
npm install
npx prisma generate               # generate the Prisma client  ← REQUIRED
npx prisma migrate dev --name init
npx prisma db seed                # seeds the 3 validator nodes  ← REQUIRED for vote-to-ban
npm run start:dev                 # NestJS API on http://localhost:3001
#                                   Swagger UI: http://localhost:3001/api/docs

# ── Frontend (new terminal) ──────────────────────────────
cd frontend
cp .env.local.example .env.local  # points at http://localhost:3001/api
npm install
npm run dev                       # Next.js on http://localhost:3000
```

> **Note on this environment:** the Prisma client wasn't generated inside the delivery
> sandbox because `binaries.prisma.sh` is network-blocked there. `npx prisma generate`
> on your machine fixes every "type not found on PrismaClient" error in one step — the
> backend code itself is complete.

---

## 2. Feature set → the real system each one is a lightweight version of

This mapping is a scored judging criterion ("can the team name the real-world system?").

| # | Feature | Modeled on |
|---|---------|-----------|
| F1 | Wallet & Account (USER / AGENT, custodial) | Custodial key management → MPC threshold sigs (Fireblocks) |
| F2 | Send/Request with **friction timer** | Risk-scored withdrawal holds at crypto exchanges |
| F3 | **Vote-to-Ban** validators (2-of-3) | Payment consensus: Ripple RCPA / Stellar SCP supermajority |
| F4 | **Community Wallet** (propose + majority vote) | Multisig treasury / Gnosis Safe (t-of-n) |
| F5 | **Emergency Freeze** (PIN-gated unfreeze) | Exchange account-freeze on a risk signal |
| F6 | **Hash-chained ledger** + explorer | Bitcoin/Ethereum tamper-evident block headers |
| F7 | **Agent Cash-In** | Fiat on-ramp "anchors" (Stellar) / bKash-Nagad agents |

---

## 3. The Risk Engine (R1–R6)

Scored at request time; the resulting **delay** is what gets applied. Points stack
additively; the applied delay is the **max** of the fired rules (capped at 120s).

| Rule | Trigger | +Score | Delay |
|------|---------|--------|-------|
| R1 | First-time recipient | 20 | 10s |
| R2 | Amount ৳1,000–5,000 | 25 | 30s |
| R3 | Amount > ৳5,000 | 40 | 60s |
| R4 | Recipient flagged by 3+ users | 45 | 120s |
| R5 | 5+ sends within 1 hour | 35 | 60s |
| R6 | Cumulative score > 70 | escalate | max delay + dual-confirm |

---

## 4. How a transfer actually moves (the friction lifecycle)

There is exactly **one** code path that ever moves money (`LedgerService`), and every
movement is a balanced, hash-chained ledger entry.

```
initiate ─▶ Risk Engine scores it
          ─▶ funds DEBITED from sender into a HOLD (TRANSFER_HOLD)   ← reserved, can't double-spend
          ─▶ Transfer = PENDING, executeAt = now + delay
                     │
        ┌────────────┼─────────────────────────────┐
     cancel      freeze                         countdown hits 0
     (refund)   (refund all)                          │
        │            │                    validators run 2-of-3 consensus
        ▼            ▼                    ┌────────────┴───────────┐
   CANCELLED     CANCELLED           banned?                    passed?
                                   refund sender             credit receiver
                                     ▶ BANNED                 ▶ FINALIZED
```

- **No double-spend:** funds leave available balance the instant a hold opens.
- **Idempotent:** a retried `initiate` returns the same pending transfer.
- **Auditable:** debit + credit always sum to zero; each ledger row stores
  `prevHash` + `hash`, so editing any past row breaks the chain (see the explorer's
  **Verify** button).

---

## 5. Demo script (matches PRD §15)

1. **Register** two accounts (one as **Agent**). Give the main user a **PIN**.
2. **Agent cash-in** ৳5,000 to the user (Agent screen).
3. **Send ৳2,500** to a first-time recipient → friction countdown fires (R1 + R2);
   show *why* the hold applies, then let it finalize.
4. **Request ৳1,200** from the other account → approve → it flows through the *same*
   friction pipeline.
5. **Report** the recipient from 3 accounts (Report screen) → send to them again →
   validators vote **2-of-3 to ban** → funds returned to sender.
6. **Community Wallet:** create a group, fund it, propose a spend, vote it through with
   a majority → a real transfer executes.
7. **Emergency Freeze** mid-countdown on a live transfer → it cancels instantly and
   refunds; unfreeze requires the PIN.
8. **Ledger explorer** → hit **Verify chain** to show hash-chain integrity.

---

## 6. Layout

```
backend/   NestJS + Prisma
  prisma/schema.prisma      hash-chained ledger, friction transfers, groups, validators
  prisma/seed.ts            3 validator nodes (run: npx prisma db seed)
  src/ledger/               the single money primitive + hash-chain + verify
  src/risk/                 R1–R6 scoring
  src/transfers/            initiate / cancel / finalize lifecycle
  src/validators/           2-of-3 vote-to-ban consensus
  src/groups/               community wallet: fund / propose / vote
  src/agent/  src/flags/    cash-in · report-to-flag (feeds R4)
  src/accounts/             balance, set-PIN, freeze, unfreeze
frontend/  Next.js App Router + Tailwind
  components/FrictionCountdown.tsx   the live hold UI (countdown, cancel, outcome)
  app/send  app/request     friction send + request-approval flows
  app/dashboard             balance, freeze/PIN, live pending holds, feature nav
  app/agent app/groups app/validators app/ledger app/report
```

Auth is phone + password + JWT (the PRD mentions OTP; a fixed-OTP toggle is a Phase-2
swap-in). The PIN is used for freeze/unfreeze.
