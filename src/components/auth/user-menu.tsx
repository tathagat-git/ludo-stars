'use client'

import { useSession, signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Compact user menu shown when the user is authenticated. Renders the
 * avatar + username as a trigger and exposes a Sign Out action.
 *
 * While the session is loading (status === "loading"), nothing is
 * rendered to avoid an unauthenticated flash on first paint.
 */
export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') return null
  if (!session?.user) return null

  const username = session.user.username ?? 'user'
  const displayName = session.user.name ?? username
  const avatar = session.user.image ?? undefined
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2"
          aria-label="Open user menu"
        >
          <Avatar className="size-6">
            {avatar ? <AvatarImage src={avatar} alt={displayName} /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="max-w-[10rem] truncate text-sm font-medium">{username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{displayName}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">
            {session.user.email ?? ''}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            signOut({ callbackUrl: '/' })
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserMenu
