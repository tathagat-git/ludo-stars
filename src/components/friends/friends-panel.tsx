'use client'

import * as React from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, UserPlus, Check, X, Users, UserX, Inbox } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Toaster as SonnerToaster } from 'sonner'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

interface FriendUser {
  id: string
  username: string
  name: string | null
  avatar: string | null
  friendshipId: string
  online: boolean
}

interface SearchUser {
  id: string
  username: string
  name: string | null
  avatar: string | null
  isFriend: boolean
  hasPendingRequest: boolean
}

interface IncomingRequest {
  id: string
  createdAt: string
  from: {
    id: string
    username: string
    name: string | null
    avatar: string | null
  }
}

/* -------------------------------------------------------------------------- */
/*                          Module-level QueryClient                          */
/* -------------------------------------------------------------------------- */

// Singleton so multiple <FriendsPanel /> instances (and the rest of the app)
// share one query cache. If Task 4-a or a future task adds a top-level
// QueryClientProvider, this client will simply be unused.
let browserQueryClient: QueryClient | null = null
function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server render — fresh client (will be discarded, just for SSR safety).
    return new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
      },
    })
  }
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
      },
    })
  }
  return browserQueryClient
}

/* -------------------------------------------------------------------------- */
/*                              Helper functions                               */
/* -------------------------------------------------------------------------- */

function initials(name: string | null, username: string) {
  const base = (name ?? username).trim()
  if (!base) return '?'
  const parts = base.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    /* ignore — empty body */
  }
  if (!res.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return payload as T
}

/** useDebouncedValue — 300ms default. */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/* -------------------------------------------------------------------------- */
/*                                  Subviews                                   */
/* -------------------------------------------------------------------------- */

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-[18rem] text-xs">{description}</p>
    </div>
  )
}

function UserRow({
  username,
  name,
  avatar,
  children,
  badge,
}: {
  username: string
  name: string | null
  avatar: string | null
  children?: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="hover:bg-accent/50 flex items-center gap-3 rounded-lg p-2 transition-colors">
      <Avatar className="size-9">
        {avatar ? <AvatarImage src={avatar} alt={username} /> : null}
        <AvatarFallback>{initials(name, username)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">@{username}</span>
          {badge}
        </div>
        {name ? <p className="text-muted-foreground truncate text-xs">{name}</p> : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      ) : null}
    </div>
  )
}

/* ------------------------------ Friends tab ------------------------------ */

function FriendsList() {
  const { data, isLoading, isError, error, refetch } = useQuery<{
    friends: FriendUser[]
  }>({
    queryKey: ['friends'],
    queryFn: () => http<{ friends: FriendUser[] }>('/api/friends'),
  })
  const qc = useQueryClient()

  const removeMutation = useMutation({
    mutationFn: (friendUserId: string) =>
      http(`/api/friends/${friendUserId}/remove`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Friend removed')
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['friend-search'] })
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to remove friend'),
  })

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-2">
            <div className="bg-muted size-9 animate-pulse rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (isError) {
    return (
      <EmptyState
        icon={<UserX className="size-8" />}
        title="Couldn't load your friends"
        description={error?.message ?? 'Please try again in a moment.'}
      />
    )
  }

  const friends = data?.friends ?? []
  if (friends.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-8" />}
        title="No friends yet"
        description="Switch to the Find tab to search for players and send your first friend request."
      />
    )
  }

  return (
    <div className="p-1">
      {friends.map((f) => (
        <UserRow
          key={f.id}
          username={f.username}
          name={f.name}
          avatar={f.avatar}
          badge={
            <Badge
              variant="outline"
              className={cn(
                'gap-1 border-transparent text-[10px] font-normal',
                f.online
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'inline-block size-1.5 rounded-full',
                  f.online ? 'bg-emerald-500' : 'bg-muted-foreground/60',
                )}
                aria-hidden
              />
              {f.online ? 'Online' : 'Offline'}
            </Badge>
          }
        >
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
            disabled={removeMutation.isPending}
            onClick={() => removeMutation.mutate(f.id)}
            aria-label={`Remove ${f.username} from friends`}
          >
            Remove
          </Button>
        </UserRow>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground mt-1 w-full text-xs"
        onClick={() => refetch()}
      >
        Refresh list
      </Button>
    </div>
  )
}

/* ------------------------------- Find tab -------------------------------- */

function FindList() {
  const [query, setQuery] = React.useState('')
  const debounced = useDebouncedValue(query, 300)
  const enabled = debounced.trim().length > 0

  const { data, isLoading, isError, error, isFetching } = useQuery<{
    users: SearchUser[]
  }>({
    queryKey: ['friend-search', debounced],
    queryFn: () =>
      http<{ users: SearchUser[] }>(
        `/api/friends/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled,
  })

  const qc = useQueryClient()

  const sendMutation = useMutation({
    mutationFn: (toUserId: string) =>
      http<{ request?: unknown; autoAccepted?: boolean; reactivated?: boolean }>(
        '/api/friends/requests',
        {
          method: 'POST',
          body: JSON.stringify({ toUserId }),
        },
      ),
    onSuccess: (res) => {
      if (res.autoAccepted) {
        toast.success("You're now friends!")
        qc.invalidateQueries({ queryKey: ['friends'] })
      } else if (res.reactivated) {
        toast.success('Friend request re-sent')
      } else {
        toast.success('Friend request sent')
      }
      qc.invalidateQueries({ queryKey: ['friend-search', debounced] })
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to send request'),
  })

  return (
    <div className="space-y-2 p-1">
      <form
        className="flex gap-2 px-1 pt-1"
        onSubmit={(e) => {
          e.preventDefault()
          // Force a re-fetch with the current query without waiting for debounce.
          qc.invalidateQueries({ queryKey: ['friend-search', query] })
        }}
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username…"
            className="pl-8"
            aria-label="Search users by username"
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={!query.trim()}>
          Search
        </Button>
      </form>

      {!enabled ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="Find players"
          description="Type a username above to search for players to add as friends."
        />
      ) : isLoading || isFetching ? (
        <div className="space-y-2 p-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <div className="bg-muted size-9 animate-pulse rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="bg-muted h-3 w-24 animate-pulse rounded" />
                <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<UserX className="size-8" />}
          title="Search failed"
          description={error?.message ?? 'Please try again.'}
        />
      ) : (data?.users?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No matching players"
          description={
            debounced
              ? `No users found for "${debounced}". Try a different username.`
              : 'No users found.'
          }
        />
      ) : (
        <div className="p-1">
          {(data?.users ?? []).map((u) => (
            <UserRow
              key={u.id}
              username={u.username}
              name={u.name}
              avatar={u.avatar}
              badge={
                u.isFriend ? (
                  <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                    <Check className="size-3" /> Friend
                  </Badge>
                ) : u.hasPendingRequest ? (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-amber-500/10 text-[10px] font-normal text-amber-600 dark:text-amber-400"
                  >
                    Pending
                  </Badge>
                ) : null
              }
            >
              <Button
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={u.isFriend || u.hasPendingRequest || sendMutation.isPending}
                onClick={() => sendMutation.mutate(u.id)}
                aria-label={`Send friend request to ${u.username}`}
              >
                <UserPlus className="size-3.5" />
                Add
              </Button>
            </UserRow>
          ))}
        </div>
      )}
    </div>
  )
}

/* ----------------------------- Requests tab ------------------------------ */

function RequestsList() {
  const { data, isLoading, isError, error } = useQuery<{ requests: IncomingRequest[] }>({
    queryKey: ['friend-requests'],
    queryFn: () => http<{ requests: IncomingRequest[] }>('/api/friends/requests'),
  })
  const qc = useQueryClient()

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) =>
      http(`/api/friends/requests/${requestId}/accept`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Friend request accepted')
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['friend-search'] })
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to accept request'),
  })

  const declineMutation = useMutation({
    mutationFn: (requestId: string) =>
      http(`/api/friends/requests/${requestId}/decline`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Request declined')
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
      qc.invalidateQueries({ queryKey: ['friend-search'] })
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to decline request'),
  })

  if (isLoading) {
    return (
      <div className="space-y-2 p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-2">
            <div className="bg-muted size-9 animate-pulse rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (isError) {
    return (
      <EmptyState
        icon={<Inbox className="size-8" />}
        title="Couldn't load requests"
        description={error?.message ?? 'Please try again in a moment.'}
      />
    )
  }

  const requests = data?.requests ?? []
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-8" />}
        title="No pending requests"
        description="Incoming friend requests will appear here. Share your username so others can add you!"
      />
    )
  }

  return (
    <div className="p-1">
      {requests.map((r) => (
        <UserRow
          key={r.id}
          username={r.from.username}
          name={r.from.name}
          avatar={r.from.avatar}
        >
          <Button
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={acceptMutation.isPending || declineMutation.isPending}
            onClick={() => acceptMutation.mutate(r.id)}
            aria-label={`Accept friend request from ${r.from.username}`}
          >
            <Check className="size-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
            disabled={acceptMutation.isPending || declineMutation.isPending}
            onClick={() => declineMutation.mutate(r.id)}
            aria-label={`Decline friend request from ${r.from.username}`}
          >
            <X className="size-3.5" />
          </Button>
        </UserRow>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Main component                                 */
/* -------------------------------------------------------------------------- */

/**
 * FriendsPanel — self-contained friends manager.
 *
 * Renders a Card with three tabs (Friends / Find / Requests). Owns its own
 * TanStack Query cache via a module-level singleton client, and mounts its
 * own Sonner Toaster so toasts always work regardless of the app's root
 * providers.
 *
 * Fetches its own data — takes no props. Exported as a named export.
 */
export function FriendsPanel() {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <Card className="w-full max-w-md gap-0 sm:max-w-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Friends</CardTitle>
          <CardDescription className="text-xs">
            Manage your friends, find new players, and respond to requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="friends" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="find">Find</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="mt-3">
              <FriendsScrollArea>
                <FriendsList />
              </FriendsScrollArea>
            </TabsContent>

            <TabsContent value="find" className="mt-3">
              <FriendsScrollArea>
                <FindList />
              </FriendsScrollArea>
            </TabsContent>

            <TabsContent value="requests" className="mt-3">
              <FriendsScrollArea>
                <RequestsList />
              </FriendsScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Self-hosted Sonner toaster — works regardless of app-level setup. */}
      <SonnerToaster richColors position="top-right" closeButton />

      {/* Scoped custom scrollbar for the friends list. Inline so we don't
          mutate the shared globals.css from another agent's task scope. */}
      <style>{`
        .friends-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .friends-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .friends-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .friends-scroll::-webkit-scrollbar-thumb {
          background-color: var(--border);
          border-radius: 9999px;
        }
        .friends-scroll::-webkit-scrollbar-thumb:hover {
          background-color: var(--muted-foreground);
        }
      `}</style>
    </QueryClientProvider>
  )
}

/**
 * ScrollArea wrapper enforcing a max height + custom scrollbar styling on
 * small viewports. On mobile, content stacks vertically; we still cap the
 * height so the panel doesn't push the whole page.
 */
function FriendsScrollArea({ children }: { children: React.ReactNode }) {
  return <div className="friends-scroll max-h-96 overflow-y-auto pr-1">{children}</div>
}
