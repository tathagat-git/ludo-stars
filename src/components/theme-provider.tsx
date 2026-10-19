'use client'

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

/**
 * Wraps next-themes ThemeProvider with the Ludo Stars defaults:
 * - attribute="class"  → toggles `.dark` class on <html>
 * - defaultTheme="light"
 * - enableSystem       → respects prefers-color-scheme when user hasn't chosen
 * - disableTransitionOnChange → no color flash on theme switch
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
