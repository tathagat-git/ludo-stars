"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bot,
  Dice5,
  Sparkles,
  Users,
} from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { Footer } from "@/components/ui/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Public landing page — shown when the visitor is not logged in.
 *
 * Layout (desktop): two columns.
 *   Left  → hero (app name, tagline, feature bullets, CTA)
 *   Right → AuthForm (login / register tabs)
 *
 * Layout (mobile): single column, auth form appears under the hero.
 *
 * Background: warm Ludo-themed gradient (red / yellow / green) — NO
 * indigo / blue per design rules.
 */
export function Landing() {
  const router = useRouter();
  const authFormRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToAuth = React.useCallback(() => {
    authFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      {/* Decorative warm gradient backdrop (not indigo/blue). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-ludo-hero"
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* ---------- LEFT: Hero ---------- */}
          <section className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Now with the twist rule
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Ludo{" "}
              <span className="bg-gradient-to-r from-red-500 via-amber-500 to-green-500 bg-clip-text text-transparent">
                Stars
              </span>
            </h1>

            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Classic Ludo with a twist — move forward{" "}
              <span className="font-semibold text-foreground">AND</span>{" "}
              backward! Play with friends or smart bots in 2 / 3 / 4-player
              rooms.
            </p>

            {/* Feature bullets */}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FeatureItem
                icon={<Dice5 className="h-4 w-4" />}
                title="Login & play"
                desc="One account, all your rooms."
              />
              <FeatureItem
                icon={<Users className="h-4 w-4" />}
                title="Add friends"
                desc="Invite friends to private rooms."
              />
              <FeatureItem
                icon={<Bot className="h-4 w-4" />}
                title="Smart bots"
                desc="Fill empty seats with AI players."
              />
              <FeatureItem
                icon={<ArrowLeftRight className="h-4 w-4" />}
                title="2 / 3 / 4 players"
                desc="Flexible seat configurations."
              />
            </ul>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={scrollToAuth}
                className="w-full sm:w-auto"
              >
                Get Started
              </Button>
              <p className="text-xs text-muted-foreground">
                Free to play · No download required
              </p>
            </div>

            {/* Ludo board preview (CSS art) */}
            <BoardPreview className="mt-4 hidden sm:block" />
          </section>

          {/* ---------- RIGHT: Auth form ---------- */}
          <section ref={authFormRef} className="scroll-mt-24">
            <Card className="mx-auto w-full max-w-md shadow-lg">
              <CardContent className="p-6 sm:p-8">
                <AuthForm onAuthed={() => router.refresh()} />
              </CardContent>
            </Card>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              By signing in you agree to play nice and have fun.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}

/* ---------------------------- sub-components ---------------------------- */

function FeatureItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-3 backdrop-blur">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}

/**
 * Mini Ludo board preview (pure CSS — no canvas). 4 colored corner
 * quadrants + a white cross of track cells, with the center triangle.
 */
function BoardPreview({ className }: { className?: string }) {
  const cells = Array.from({ length: 15 * 15 }, (_, i) => i);

  return (
    <div
      className={
        "aspect-square w-full max-w-sm rounded-xl border border-border bg-white p-2 shadow-sm dark:bg-card " +
        (className ?? "")
      }
      role="img"
      aria-label="Preview of the Ludo Stars board"
    >
      <div className="grid h-full w-full grid-cols-15 grid-rows-15 gap-[1px]">
        {cells.map((i) => {
          const row = Math.floor(i / 15);
          const col = i % 15;
          // Four corner base regions
          const inRedBase = row >= 9 && row <= 13 && col >= 1 && col <= 5;
          const inGreenBase = row >= 1 && row <= 5 && col >= 1 && col <= 5;
          const inYellowBase = row >= 1 && row <= 5 && col >= 9 && col <= 13;
          const inBlueBase = row >= 9 && row <= 13 && col >= 9 && col <= 13;
          // Home columns (4 colored arrows)
          const isRedHome = col === 7 && row >= 9 && row <= 13;
          const isGreenHome = row === 7 && col >= 1 && col <= 5;
          const isYellowHome = col === 7 && row >= 1 && row <= 5;
          const isBlueHome = row === 7 && col >= 9 && col <= 13;
          // Track cells (the cross arms, rows/cols 6..8 minus center)
          const isTrack =
            (row === 6 || row === 7 || row === 8 || col === 6 || col === 7 || col === 8) &&
            !(inRedBase || inGreenBase || inYellowBase || inBlueBase);
          const isCenter = row === 7 && col === 7;

          let cls = "bg-muted/40";
          if (inRedBase) cls = "bg-red-400";
          else if (inGreenBase) cls = "bg-green-400";
          else if (inYellowBase) cls = "bg-yellow-300";
          else if (inBlueBase) cls = "bg-blue-400";
          else if (isRedHome) cls = "bg-red-300";
          else if (isGreenHome) cls = "bg-green-300";
          else if (isYellowHome) cls = "bg-yellow-200";
          else if (isBlueHome) cls = "bg-blue-300";
          else if (isCenter) cls = "bg-foreground";
          else if (isTrack) cls = "bg-white dark:bg-muted/30";

          return <span key={i} className={`rounded-[1px] ${cls}`} />;
        })}
      </div>
    </div>
  );
}

export default Landing;
