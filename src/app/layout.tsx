import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Toaster2 } from "@/components/ui/sonner";
import { AppProviders } from "@/components/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ludo Stars — Play Ludo with Friends & Bots",
  description:
    "Classic Ludo with a twist — move forward AND backward! Play 2/3/4-player rooms with friends or smart bots. Add friends, chat, and climb the ranks.",
  applicationName: "Ludo Stars",
  keywords: [
    "Ludo",
    "Ludo Stars",
    "board game",
    "multiplayer",
    "online game",
    "play with friends",
    "bot AI",
    "Next.js",
  ],
  authors: [{ name: "Ludo Stars Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Ludo Stars — Play Ludo with Friends & Bots",
    description:
      "Classic Ludo with a twist — move forward AND backward! Play 2/3/4-player rooms with friends or smart bots.",
    siteName: "Ludo Stars",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ludo Stars",
    description:
      "Classic Ludo with a twist — move forward AND backward! Play with friends or bots.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased bg-background text-foreground`}
      >
        <AppProviders>{children}</AppProviders>
        <Toaster />
        <Toaster2 />
      </body>
    </html>
  );
}
