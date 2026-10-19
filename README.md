# Ludo Stars 🎲

A full-stack, real-time Ludo game built with Next.js 16, TypeScript, Tailwind CSS 4, Prisma (SQLite), and Socket.IO. Play classic Ludo or the custom **Twist mode** where tokens can move _backward_ as well as forward. Supports 2–6 players, bots, friends, and private rooms.

![Ludo Stars](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4) ![Prisma](https://img.shields.io/badge/Prisma-SQLite-5a67d8)

## ✨ Features

- **Authentication** — register / login with email + username (NextAuth v4, JWT sessions, bcrypt-hashed passwords)
- **Friends system** — search users, send/accept/decline friend requests, manage your friends list
- **Game lobby** — create private rooms (2–6 players, classic or twist mode, 0–5 bots), join by code, browse open rooms, game history with win/loss stats
- **Real-time multiplayer** — live game state over Socket.IO with reconnection support, in-room chat
- **2–6 player support** — standard 4 colors (red/green/yellow/blue) on the board + purple & orange for 5–6 player games (rendered as off-board strips)
- **Smart bots** — heuristic AI that prioritizes finishing, capturing, escaping danger, and advancing
- **Classic Ludo rules** — 52-cell track, 6-cell home columns, 8 safe squares, roll-6-to-release, 3-sixes-pass, exact-roll-to-finish, captures on non-safe squares
- **Twist mode** ⭐ — tokens on the track can move _backward_ by the dice value, bounded by their own start square. Backward moves can capture opponents too. A direction picker appears when both directions are legal.
- **Ludo King–style UI** — colored start squares with direction arrows, safe-star markings, colored home columns, crowned center, framed board, turn glow, glossy 3D tokens
- **Dark mode** — full light/dark theme support via next-themes
- **Responsive** — mobile-first design that works from 375px to 4K

## 🎮 How to Play

1. **Register** an account or **sign in**.
2. From the dashboard, either:
   - **Play vs Bots** — one click starts a 4-player twist game with 3 bots
   - **Create Private Room** — pick mode (classic/twist), player count (2–6), and bot count
   - **Join a game** — enter a room code or browse open rooms
3. In the room lobby, the host can add/remove bots, then click **Ready** → **Start Game**.
4. On your turn, click **Roll the dice**. Then click a highlighted token to move it. If both forward and backward moves are legal (twist mode), a direction picker appears.
5. Roll a **6** to release a token from base (and get a bonus roll). Land on an opponent on a non-safe square to capture them. Get all 4 tokens to the center to win.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (port 81 via Caddy gateway)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Next.js 16 App (port 3000)                         │  │
│  │  ├── Auth (NextAuth v4, JWT)                        │  │
│  │  ├── Friends API (Prisma → SQLite)                 │  │
│  │  ├── Lobby API (create/join/list games)            │  │
│  │  └── Game board UI (React + Tailwind + framer)      │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Game Service (port 3003, Socket.IO mini-service)   │  │
│  │  ├── In-memory game rooms (authoritative state)    │  │
│  │  ├── Ludo engine (rules + twist mode)              │  │
│  │  ├── Bot AI (heuristic)                            │  │
│  │  └── Reconnection + grace-period handling          │  │
│  └───────────────────────────────────────────────────┘  │
│  Caddy gateway routes ?XTransformPort=3003 → :3003       │
└─────────────────────────────────────────────────────────┘
```

- **`src/lib/ludo/`** — the Ludo engine (`engine.ts`), bot AI (`bot.ts`), board geometry (`board.ts`), and socket client hook (`client.ts`). Shared between the Next.js app and the game-service.
- **`mini-services/game-service/`** — independent Bun + Socket.IO service (port 3003). Imports the engine directly. Holds authoritative live game state in memory.
- **`prisma/schema.prisma`** — User, Account, Session, Friendship, FriendRequest, Game, GamePlayer, GameMove.
- **`src/app/`** — App Router: `page.tsx` (single-route router: landing/dashboard/game), `layout.tsx`, `error.tsx`, `loading.tsx`, `global-error.tsx`, API routes under `api/`.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ or [Bun](https://bun.sh/) 1.1+
- SQLite (bundled — no separate server needed)

### Installation

```bash
# Clone & install
git clone <your-repo-url> ludo-stars
cd ludo-stars
bun install

# Set up environment
cp .env.example .env.local
# Edit .env.local: set NEXTAUTH_SECRET to a random 32-byte hex string
#   openssl rand -hex 32

# Set up the database
bun run db:push

# Install game-service dependencies
cd mini-services/game-service
bun install
cd ../..
```

### Running in development

```bash
# Terminal 1 — Next.js dev server (port 3000)
bun run dev

# Terminal 2 — Game service (port 3003, auto-reloads)
bun run game-service
```

Then open `http://localhost:3000` (or your Caddy gateway port).

### Running the game-service separately

The game-service is an independent Bun project:

```bash
cd mini-services/game-service
bun install   # first time only
bun run dev   # hot-reload on :3003
```

### Production build

```bash
# Build the Next.js app
bun run build

# Start the production server
bun run start

# In production, also run the game-service:
cd mini-services/game-service
bun run start
```

Set `NODE_ENV=production` and update `NEXTAUTH_URL` in `.env` to your public domain.

## 📜 Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start Next.js dev server on port 3000 |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run format` | Format all source with Prettier |
| `bun run format:check` | Check formatting without writing |
| `bun run db:push` | Push Prisma schema to SQLite |
| `bun run game-service` | Start the Socket.IO game-service on port 3003 |

## 🎲 The Twist Rule

In **Twist mode**, after rolling, a player may move any of their on-board tokens _forward_ **or** _backward_ by the dice value:

- Forward moves follow classic Ludo rules (wrap the track, enter home column, exact-roll-to-finish).
- **Backward moves** are clamped at the token's own start square — a token can retreat all the way back to its start point but no further.
- Backward moves into the home column are allowed (retreat from home column back to the track).
- Captures apply on backward landings too (on non-safe squares).

A direction picker (Forward / Backward buttons) appears when both options are legal for a token.

## 🤖 Bot AI

The bot uses a weighted heuristic:

1. **Finish a token** (+1000) — highest priority
2. **Capture opponents** (+200 per capture)
3. **Release from base on a 6** (+80)
4. **Escape danger** — if a token is capturable next turn, backward moves get a bonus
5. **Advance** (+progress × 2)
6. **Land on safe squares** (+15)
7. **Avoid post-move danger** (−25 per threat)

Bots think for 700–1500ms before each action to feel human.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Database**: Prisma ORM + SQLite
- **Real-time**: Socket.IO (independent mini-service)
- **Auth**: NextAuth.js v4 (Credentials provider, JWT)
- **State**: TanStack Query (server), Zustand (client)
- **Animation**: Framer Motion
- **Icons**: Lucide React

## 📁 Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes (auth, friends, lobby)
│   ├── page.tsx              # Single-route router (landing/dashboard/game)
│   ├── layout.tsx            # Root layout + providers
│   ├── error.tsx             # Route error boundary
│   ├── loading.tsx           # Route loading state
│   └── global-error.tsx      # Global error boundary
├── components/
│   ├── auth/                 # Auth form, user menu
│   ├── dashboard/            # Dashboard shell, top nav, stats
│   ├── friends/              # Friends panel
│   ├── game/                 # Game room, board, dice, tokens, chat
│   ├── landing/              # Landing page
│   ├── lobby/                # Create/join dialogs, game history, quick play
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── db.ts                 # Prisma client
│   ├── lobby.ts              # Lobby helpers
│   └── ludo/                 # Game engine, bot AI, board geometry, client hook
└── types/                    # TypeScript augmentations

mini-services/
└── game-service/             # Socket.IO game-service (port 3003)
    ├── index.ts              # Server
    └── package.json          # Independent Bun project

prisma/
└── schema.prisma             # Database schema
```

## 📄 License

MIT — built for fun and learning.
