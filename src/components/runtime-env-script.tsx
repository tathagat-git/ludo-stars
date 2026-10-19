import * as React from 'react'

/**
 * RuntimeEnvScript — injects a server-side `<script>` tag into the document
 * that writes public env vars to `window.__ENV__` before the client JS bundle
 * loads. This lets the client read env vars that are only available at RUNTIME
 * (e.g. on Render, where you set env vars in the dashboard AFTER the build).
 *
 * Without this, `NEXT_PUBLIC_*` vars are baked into the JS bundle at build
 * time and changing them in Render's dashboard has no effect until a rebuild
 * that actually re-runs `next build` with the new value.
 *
 * The script is tiny (~100 bytes) and runs synchronously in <head> before
 * any client JS, so `window.__ENV__` is always available when client code runs.
 */
export function RuntimeEnvScript() {
  const env = {
    NEXT_PUBLIC_GAME_SERVICE_URL:
      process.env.NEXT_PUBLIC_GAME_SERVICE_URL ?? '',
  }
  // Stringify safely — the value is a URL so it's safe to inline, but we JSON-
  // encode it to prevent XSS if someone sets a weird value.
  const json = JSON.stringify(env).replace(/</g, '\\u003c')
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__ENV__ = ${json};`,
      }}
    />
  )
}