# Task 4-b — friends-subagent

**Scope:** Friends system API + Friends panel UI for the Ludo Stars Next.js 16 app.

## What I built

### API routes (all auth-guarded with `getServerSession(authOptions)`)
- `src/app/api/friends/route.ts` — GET: returns `{ friends: [...] }`. Each friend = `{ id, username, name, avatar, friendshipId, online:false }`. Friendship is undirected, so I fetch both `fromId == me` and `toId == me` rows in parallel and merge.
- `src/app/api/friends/search/route.ts` — GET `?q=`: searches `User.username` with Prisma `contains` (case-insensitive), excludes self + existing friends, returns top 10 with `isFriend` and `hasPendingRequest` flags (computed from a single batch of friendship + pending-request queries).
- `src/app/api/friends/requests/route.ts`:
  - GET: pending incoming requests for me, newest first, with sender profile.
  - POST `{ toUserId }`: rejects self / not-found / already-friends. If the target already sent me a pending request, auto-accepts it (creates both Friendship rows + marks request `accepted` in a transaction) and returns `autoAccepted:true`. If a previously-declined outgoing request exists, reactivates it to `pending`. Otherwise creates a new pending request (201).
- `src/app/api/friends/requests/[id]/accept/route.ts` — POST: transactional upsert of both `Friendship` rows + update request to `accepted`. Guards: 404 / not-addressed-to-you (403) / not-pending (409). Uses the compound unique `fromId_toId` key from the schema's `@@unique([fromId, toId])`.
- `src/app/api/friends/requests/[id]/decline/route.ts` — POST: marks request `declined`. Same 404/403/409 guards.
- `src/app/api/friends/[id]/remove/route.ts` — DELETE: `[id]` is the OTHER user's id. Transactionally `deleteMany` on both `Friendship` directions and any `FriendRequest` rows linking the two users, so a re-add starts clean.

### UI
- `src/components/friends/friends-panel.tsx` — named export `FriendsPanel`, takes no props, fetches its own data.
  - Uses TanStack Query (`useQuery` + `useMutation`) and a module-level singleton `QueryClient` so it works even without a top-level provider.
  - shadcn `Card`, `Tabs`, `Button`, `Input`, `Avatar`, `Badge`; lucide icons (`Search`, `UserPlus`, `Check`, `X`, `Users`, `UserX`, `Inbox`).
  - Three tabs: **Friends** (list with mock online dot — all offline — + Remove button), **Find** (debounced 300ms search with skeleton loaders + Add Friend button), **Requests** (Accept/Decline).
  - Empty states for every tab + error states.
  - `max-h-96 overflow-y-auto` per tab with a custom scoped scrollbar (inline `<style>` block using `var(--border)` — no mutation to shared `globals.css`).
  - Mobile-friendly: TabsList is a 3-col grid; row layout stacks gracefully; touch targets ≥ 28px on action buttons.
  - Mounts its own Sonner `<Toaster richColors />` so toasts work regardless of app-level providers.

## Conventions / notes for downstream agents
- I import `authOptions` from `@/lib/auth` and use `getServerSession` from `next-auth` exactly as Task 4-a's spec requires. The session is expected to have `session.user.id`.
- All API responses are JSON via `NextResponse.json(...)`. Errors follow `{ error: string }`.
- Friend rows returned from `GET /api/friends` carry a `friendshipId` field (the Friendship row id) in case the UI later needs to target a specific edge; the remove endpoint instead takes the friend's **user id** for simpler client ergonomics.
- The `online` flag is hardcoded `false` — real presence will be owned by the game-service websocket mini-service (Task 5). When that lands, the `GET /api/friends` route can be extended to merge presence state.
- Outgoing/pending requests tab is not included (only incoming). If Task 4-c or the lobby wants to show outgoing pending requests, the same `GET /api/friends/requests` route can be extended with a `?direction=outgoing` param.

## Files
- `src/app/api/friends/route.ts`
- `src/app/api/friends/search/route.ts`
- `src/app/api/friends/requests/route.ts`
- `src/app/api/friends/requests/[id]/accept/route.ts`
- `src/app/api/friends/requests/[id]/decline/route.ts`
- `src/app/api/friends/[id]/remove/route.ts`
- `src/components/friends/friends-panel.tsx`

## Lint
Run `bun run lint` — see any errors below; fix only files in my scope.
