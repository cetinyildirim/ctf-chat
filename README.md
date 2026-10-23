# CTF Operations Chat Platform

A production-grade realtime communication platform built for cyber-security CTF operations. Discord-style channels, granular RBAC, live scoreboard, support tickets, incident management, and a polished cyber/neon dark UI — all wired to a real Socket.IO realtime layer with seeded demo data.

> Full-stack TypeScript monorepo. **Phase 1 + Realtime slice** as defined in the design plan.

---

## Stack

| Layer    | Tech                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Web      | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · shadcn/ui · Framer Motion · TanStack Query · Zustand · Socket.IO client · React Hook Form + Zod · Recharts · `react-virtuoso` · `react-markdown` + Shiki · `cmdk` · `sonner` |
| Server   | Node 20 · Express · Socket.IO · Prisma (SQLite dev, Postgres-portable schema) · argon2 · JWT (httpOnly cookies) · Helmet · CORS · `express-rate-limit` · Pino |
| Shared   | RBAC matrix (`Role` × `Permission`) · Zod schemas · Typed `ServerToClient`/`ClientToServer` Socket.IO events                       |

---

## Repository layout

```
sydt-chat/
├── apps/
│   ├── web/         Next.js 15 + React 19 frontend
│   └── server/      Express + Socket.IO + Prisma backend
├── packages/
│   └── shared/      RBAC, Zod schemas, typed socket events, shared DTOs
├── pnpm-workspace.yaml
└── package.json     concurrently-based dev script
```

---

## Quick start

Prereqs: **Node ≥ 20** and **pnpm 9** (`corepack enable && corepack prepare pnpm@9.15.0 --activate`).

```bash
# 1. install workspaces
pnpm install

# 2. push the Prisma schema to SQLite (apps/server/dev.db)
pnpm db:push

# 3. seed the demo dataset (teams, users, channels, challenges, messages, ...)
pnpm seed

# 4. boot both apps concurrently
pnpm dev
```

| Service | URL                       |
| ------- | ------------------------- |
| Web     | http://localhost:3100     |
| API     | http://localhost:4000/api |
| Health  | http://localhost:4000/health |

> The web port is `3100` (not 3000) to avoid conflicts with other dev servers; the API CORS origin is preconfigured to match in `apps/server/.env`.

---

## Demo credentials

All accounts created by the seed script.

| Role             | Username                         | Password         |
| ---------------- | -------------------------------- | ---------------- |
| Super Admin      | `admin`                          | `Admin!2345`     |
| Super Admin      | `odin`                           | `Admin!2345`     |
| Comp Admin       | `freya` · `loki`                 | `Admin!2345`     |
| Challenge Author | `thor` · `sif`                   | `Admin!2345`     |
| Moderator        | `heimdall` · `tyr`               | `Admin!2345`     |
| Team Captain     | `cap-<team-slug>` (e.g. `cap-sigma-si`) | `Operator!2345` |
| Team Member      | `<team-slug>-mX` (e.g. `sigma-sigops-m1`) | `Operator!2345` |

Sign in with any of these on the `/login` page (you can use either the username or the email `<username>@sydt.local`).

---

## Keyboard shortcuts

| Action                    | Shortcut       |
| ------------------------- | -------------- |
| Open command palette      | `Ctrl/⌘ + K`   |
| Close palette / modals    | `Esc`          |
| Send chat message         | `Enter`        |
| Newline in chat composer  | `Shift + Enter`|
| Search in command palette | type a query   |

---

## Architecture highlights

- **Auth.** Argon2 hashing; short-lived access JWT in an httpOnly cookie + long-lived refresh JWT in another httpOnly cookie. Refresh endpoint rotates the refresh token. Axios interceptor catches `401` → retries via `/auth/refresh`. Socket.IO handshake authenticates with the same cookie.
- **RBAC.** `packages/shared/src/rbac.ts` is the single source of truth for `Role` × `Permission`. Server enforces via `requirePermission()` middleware **and** per-event guards inside Socket.IO handlers. Web mirrors via `<Can>` component and `useCan()` hook, and `apps/web/src/middleware.ts` performs a route-level redirect when unauthenticated.
- **Realtime.** Socket.IO rooms: `ch:<id>`, `team:<id>`, `staff`, `global`. Typed `ServerToClientEvents` / `ClientToServerEvents` are imported by both apps. The web `SocketBridge` translates incoming events into TanStack Query cache mutations + Zustand store updates (no double source of truth).
- **Chat.** `react-virtuoso` virtualized list, cursor-paginated upward, Shiki for code blocks, custom IOC/IP/hash/URL/JSON/terminal highlighting on top of `react-markdown`. Reactions, replies, edit/delete with optimistic updates, typing indicators, presence.
- **Scoreboard.** Snapshot cached server-side and broadcast as `scoreboard:update` every 5 s. Rank changes animate via Framer Motion. Recharts solve-timeline + category-mix.
- **Tickets.** Full lifecycle: open → claim → in-progress → resolved → closed. Internal-note tab gated behind `TICKET_INTERNAL_NOTE` permission. Realtime push to staff + reporter.
- **Admin.** RBAC-gated `/admin` overview: KPI cards, Recharts activity stream (5-min buckets × 2 h), staff online list, audit log. Other admin sub-pages are clearly labeled as forthcoming.
- **Notifications.** WebAudio-synthesized cyber-feel sound effects, sonner toasts, browser `Notification` API for mentions/announcements/tickets, in-app notification center popover with sound + DND toggles.

---

## NPM scripts (root)

```bash
pnpm dev          # run both apps (server + web) with colored, prefixed logs
pnpm build        # build shared → server → web
pnpm typecheck    # tsc --noEmit across all workspaces
pnpm db:push      # apply Prisma schema to dev.db
pnpm db:generate  # regenerate Prisma client
pnpm seed         # populate demo dataset
pnpm format       # prettier --write across the repo
```

---

## Environment

Server reads `apps/server/.env` (see `apps/server/.env.example`):

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="file:./dev.db"
JWT_ACCESS_SECRET=...     # ≥ 32 chars
JWT_REFRESH_SECRET=...    # ≥ 32 chars (different from access)
ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=2592000
CORS_ORIGIN=http://localhost:3100
COOKIE_SECURE=false       # set to true behind HTTPS
LOG_LEVEL=info
```

Web reads `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
```

---

## Deferred to the next phase

These were intentionally stubbed or scoped out for Phase 1 — placeholders are visible in the UI so the gaps are obvious:

- **Voice channels** — placeholder card; no WebRTC media yet.
- **Incident detail page** — list ships; standalone `/incidents/[id]` deferred.
- **Drag-and-drop channel reordering** — sidebar renders categories/channels; reorder mutation deferred.
- **Service-worker push** — in-app sound, toasts, and browser `Notification` API ship; SW-driven push deferred.
- **Per-user notification preferences UI** — store + DND/sound toggles ship; dedicated settings page deferred.
- **Admin sub-pages** — `/admin` overview ships; user/team/channel/role management + moderation queue + spam rules + system health get standalone pages in Phase 2.
- **File uploads** — implemented: `POST /api/channels/:channelId/messages` accepts `multipart/form-data` (`content`, optional `replyToId`, `files[]`). Files are stored under `UPLOAD_DIR` and served at `GET /api/files/:attachmentId` (cookie auth + channel access). Client: composer paperclip / drag-and-drop.
- **Message search index** — full-text search beyond client-side filtering.

---

## License

Internal / proprietary. Not for redistribution.
