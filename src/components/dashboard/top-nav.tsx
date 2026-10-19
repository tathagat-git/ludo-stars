"use client";

import * as React from "react";
import { Dice5 } from "lucide-react";

import { UserMenu } from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

/**
 * Top navigation bar for the dashboard.
 *
 * Layout: [logo "Ludo Stars"] -------- [theme toggle] [user menu]
 *
 * Expected exports from peer tasks (Task 4-a):
 *   - `UserMenu` from `@/components/auth/user-menu` (named export)
 */
export function TopNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <a
          href="/"
          className="group flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ludo Stars home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <Dice5 className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            Ludo <span className="text-primary">Stars</span>
          </span>
        </a>

        <nav
          aria-label="User"
          className="flex items-center gap-1 sm:gap-2"
        >
          <ThemeToggle />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}

export default TopNav;
