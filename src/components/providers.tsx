"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

/**
 * Client-side wrapper that injects the NextAuth SessionProvider into the
 * React tree. Mounted once near the root by the layout (Task 8 owns
 * `src/app/layout.tsx` and imports this component).
 */
export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session?: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

export default Providers;
