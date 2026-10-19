import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Landing } from "@/components/landing/landing";
import { Dashboard, type DashboardUser } from "@/components/dashboard/dashboard";
import { GameHost } from "@/components/dashboard/game-host";

/**
 * Top-level routing entry point.
 *
 * The Ludo Stars app exposes ONLY the `/` route. This server component
 * inspects the session and the optional `?room=<code>` query param and
 * decides which surface to render:
 *
 *   1. No session + no `?room=`            → <Landing /> (hero + auth form)
 *   2. Session + `?room=<code>`            → <GameHost /> (wraps <GameRoom />)
 *   3. Session + no `?room=`               → <Dashboard />
 *
 * Notes:
 *   - In Next.js 16 `searchParams` is a Promise; we `await` it.
 *   - When joining a room, we look up the persisted Game row (created by the
 *     lobby API) to read its `mode` + `maxPlayers` and pass them down to the
 *     GameRoom so the websocket `room:join` creates the room with the right
 *     configuration (the websocket service otherwise defaults to 4 players).
 *   - `onExit` for the game room is a client concern (functions can't be
 *     passed from a server component to a client component), so we render
 *     `<GameHost />` which owns the client router and forwards `onExit`.
 */

interface HomePageProps {
  searchParams: Promise<{ room?: string | string[] }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;

  // Normalize room: accept a single string or the first of an array.
  const rawRoom = params?.room;
  const room =
    typeof rawRoom === "string"
      ? rawRoom.trim()
      : Array.isArray(rawRoom) && rawRoom.length > 0
        ? String(rawRoom[0]).trim()
        : "";

  const session = await getServerSession(authOptions);

  // Not logged in → landing page + auth form.
  if (!session?.user) {
    return <Landing />;
  }

  const user = session.user as DashboardUser & { id?: string };
  const userId = user.id ?? "";
  const username = user.username ?? user.name ?? "Player";

  // Logged in + room code → game room.
  if (room) {
    // Look up the persisted Game row to read mode + maxPlayers so the
    // websocket room is created with the correct configuration. If the row
    // is missing (e.g., room created directly via socket without the lobby
    // API), fall back to the defaults (twist, 4 players).
    let mode: "classic" | "twist" = "twist";
    let maxPlayers = 4;
    try {
      const game = await db.game.findUnique({
        where: { code: room.toUpperCase() },
        select: { mode: true, maxPlayers: true },
      });
      if (game) {
        mode = game.mode === "classic" ? "classic" : "twist";
        maxPlayers = game.maxPlayers;
      }
    } catch {
      // DB read failure is non-fatal — use defaults.
    }
    return (
      <GameHost
        code={room}
        userId={userId}
        username={username}
        mode={mode}
        maxPlayers={maxPlayers}
      />
    );
  }

  // Logged in, no room → dashboard.
  return <Dashboard user={{ ...user, id: userId, username }} />;
}

// Page-level metadata override (the root layout already sets defaults).
export const metadata: Metadata = {
  title: "Ludo Stars — Play Ludo with Friends & Bots",
};
