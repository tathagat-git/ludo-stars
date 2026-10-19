import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
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
 *   - `onExit` for the game room is a client concern (functions can't be
 *     passed from a server component to a client component), so we render
 *     `<GameHost />` which owns the client router and forwards `onExit`.
 *   - Navigating to a room is done by setting `?room=<code>` (soft nav
 *     via `router.push('/?room=CODE')` or hard via
 *     `window.location.search = '?room=CODE'`); exiting is
 *     `router.push('/')` or `window.location.search = ''`.
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
    return <GameHost code={room} userId={userId} username={username} />;
  }

  // Logged in, no room → dashboard.
  return <Dashboard user={{ ...user, id: userId, username }} />;
}

// Page-level metadata override (the root layout already sets defaults).
export const metadata: Metadata = {
  title: "Ludo Stars — Play Ludo with Friends & Bots",
};
