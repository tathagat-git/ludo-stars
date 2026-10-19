import * as React from 'react'
import { Heart, Instagram, Twitter } from 'lucide-react'

/**
 * Sticky footer used on every page. Mounts at the bottom of the
 * `min-h-screen flex flex-col` body wrapper and uses `mt-auto` so it is
 * pushed down naturally when content is shorter than one viewport.
 */
export function Footer() {
  return (
    <footer className="border-border bg-card/60 mt-auto border-t backdrop-blur">
      <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm sm:flex-row sm:px-6">
        <p className="flex items-center gap-1.5 text-center">
          Made with
          <Heart className="fill-primary text-primary h-3.5 w-3.5" aria-hidden />
          by the Ludo Stars team
        </p>

        <nav aria-label="Footer" className="flex items-center gap-4 text-xs sm:text-sm">
          <a
            href="https://instagram.com/ludostars"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <Instagram className="h-4 w-4" aria-hidden />
            Instagram
          </a>
          <a
            href="https://twitter.com/ludostars"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <Twitter className="h-4 w-4" aria-hidden />
            Twitter
          </a>
          <span className="text-muted-foreground/70">
            &copy; {new Date().getFullYear()} Ludo Stars
          </span>
        </nav>
      </div>
    </footer>
  )
}
