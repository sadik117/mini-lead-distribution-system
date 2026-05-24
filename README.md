# Prowider Mini Lead Distribution System

A robust, high-performance, and concurrency-safe full-stack lead distribution system built to simulate a simplified version of a real-world platform like Prowider. It handles customer service enquiries, persists them as leads, enforces strict duplicate rules at the database level, distributes them fairly using a persistent round-robin algorithm, and pushes real-time status updates to a provider dashboard via Server-Sent Events (SSE).

---

## 🛠️ Technology Stack

### Backend
- **Node.js & Express** with **TypeScript**
- **Prisma ORM** connecting to **PostgreSQL (NeonDB)**
- **Zod** for API request payload validation
- **Server-Sent Events (SSE)** for lightweight, low-overhead real-time broadcasts

### Frontend
- **Next.js** (App Router) with **TypeScript**
- **Tailwind CSS** for clean utility-first responsive styling
- **Zustand** for global client state and real-time SSE stream management
- **Lucide React** for UI icons

---

## 🚀 Key Architectural Strengths

### 1. Concurrency-Safe Fair Allocation Algorithm
To allocate exactly 3 providers to each incoming lead:
1. **Mandatory Provider Check**: Evaluates if the service requires mandatory providers (e.g., `Service 1` $\to$ `Provider 1`, `Service 3` $\to$ `Provider 1` and `Provider 4`).
2. **Deterministic Round-Robin**: Pulls remaining slots from the designated pool, rotating sequentially based on a persistent index pointer stored in the `AllocationState` table.
3. **Monthly Quota Enforcement**: Ensures that no provider exceeds their monthly quota of 10 leads.
4. **Deadlock Prevention (Strict Ordering)**: When multiple requests arrive concurrently, database operations can lock rows in different orders, leading to deadlocks. To eliminate this risk, our transaction **pre-locks all candidate providers in strictly ascending ID order** using `SELECT ... FOR UPDATE` before doing any updates.
5. **Atomic Batch Updates**: Lead assignments are written in a single `createMany` batch operation, and provider counters are updated in one atomic Prisma increment action.

### 2. Double-Submit & Duplicate Enforcements
- We enforce the duplicate rule (**same phone number cannot request the same service twice**) directly at the database layer via a `@@unique([phone, serviceId])` composite index on the `Lead` table.
- If a duplicate submission bypasses client-side checks, PostgreSQL throws a unique constraint violation (`P2002`). Our global error handler intercepts this and returns a clean `409 Conflict` response to the user.

### 3. Exactly-Once Webhook Idempotency
- When resetting quotas via `POST /api/webhook/reset-quota`, the webhook simulator provides a client-generated `idempotencyKey`.
- Instead of using a slow "check-then-insert" pattern (which is susceptible to race conditions), we use an **optimistic write strategy** inside a Prisma transaction:
  1. We try to insert the `idempotencyKey` into the `WebhookEvent` table first.
  2. If the insert throws a unique constraint error (`P2002`), we know the event has already been processed. We intercept the error and return a safe `200 OK` (no-op).
  3. If the insert succeeds, we proceed with resetting the quotas.

### 4. Real-Time Push Stream (SSE)
- When a new lead is successfully allocated, the server broadcasts a `dashboard_update` payload to all connected clients over a persistent SSE connection (`/api/events`).
- Dashboard states are refreshed immediately without full-page reloads or high-overhead HTTP polling.

---

## 📂 Project Structure

```
mini-lead-distribution-system/
├── client/                          # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Navbar & main frame
│   │   │   ├── page.tsx             # Redirects to /request-service
│   │   │   ├── request-service/     # Customer enquiry form
│   │   │   ├── dashboard/           # Real-time provider stats
│   │   │   └── test-tools/          # Webhook & concurrency simulators
│   │   ├── store/
│   │   │   └── dashboardStore.ts    # Zustand store & SSE handler
│   │   ├── lib/
│   │   │   └── api.ts               # Axios API client
│   │   └── types/
│   │       └── index.ts             # Shared interfaces
│   └── package.json
│
└── server/                          # Express Backend API
    ├── src/
    │   ├── index.ts                 # Server entry point
    │   ├── routes/                  # API endpoints
    │   ├── services/
    │   │   ├── allocationService.ts # Lead distribution logic
    │   │   └── sseService.ts        # SSE Client broadcasting
    │   ├── middleware/
    │   │   └── errorHandler.ts      # Global Express error filter
    │   └── prisma/
    │       └── seed.ts              # DB seeding script
    ├── prisma/
    │   └── schema.prisma            # Prisma Schema file
    └── package.json
```

---

## ⚙️ Setup and Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A running PostgreSQL instance (or a free NeonDB cluster)

---

### Backend Configuration (`/server`)

1. Navigate to the server folder:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```env
   DATABASE_URL="postgresql://username:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
   PORT=5000
   CLIENT_URL="http://localhost:3000"
   ```

4. Push the schema migrations to your database:
   ```bash
   npx prisma migrate dev --name init
   ```

5. Seed the database with core services, providers, and allocation states:
   ```bash
   npm run db:seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```
   The backend API will run at `http://localhost:5000` with the SSE stream at `http://localhost:5000/api/events`.

---

### Frontend Configuration (`/client`)

1. Navigate to the client folder in a new terminal:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The frontend application will be live at `http://localhost:3000`.

---

## 🧪 Verification & Interactive Testing

Use the **Test Tools** panel on the frontend (`http://localhost:3000/test-tools`) to verify the key engine functionalities:

1. **Trigger Webhook Reset**: Fires an idempotent quota reset request. The dashboard updates dynamically in the background.
2. **Trigger Concurrent Reset**: Spams 5 concurrent webhook calls with the *same* idempotency key. The test log terminal will show exactly 1 execution (success) and 4 immediate blocks (no-op duplicates).
3. **Generate 10 Leads Instantly**: Triggers 10 parallel lead creations on the backend. This validates the database-level locking stability, shows correct round-robin rotation, and checks that providers are skipped gracefully once they hit their 10-lead quota limit.
