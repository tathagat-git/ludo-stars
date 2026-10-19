'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/ludo/client'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (content: string) => void
  disabled?: boolean
  className?: string
}

/// In-room chat panel: ScrollArea (max 256px) of messages + an input + send
/// button. Messages are rendered with sender name + timestamp. System
/// messages (joins/leaves) are styled differently.
export function ChatPanel({ messages, onSend, disabled, className }: ChatPanelProps) {
  const [text, setText] = useState('')
  // Ref to the inner scrolling viewport so we can auto-scroll to bottom on
  // new messages. The shadcn ScrollArea renders a `[data-radix-scroll-area-viewport]`
  // child we can query.
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const viewport = el.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section
      aria-label="Room chat"
      className={cn(
        'border-border bg-card flex min-h-0 flex-1 flex-col rounded-lg border',
        className,
      )}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Chat</h3>
        <span className="text-muted-foreground text-xs">{messages.length}</span>
      </header>

      <div ref={containerRef} className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full" style={{ maxHeight: '100%' }}>
          <div className="flex flex-col gap-1.5 p-2">
            {messages.length === 0 ? (
              <p className="text-muted-foreground px-2 py-8 text-center text-xs">
                No messages yet. Say hi 👋
              </p>
            ) : (
              messages.map((m) =>
                m.type === 'system' ? (
                  <p
                    key={m.id}
                    className="text-muted-foreground px-2 py-1 text-center text-[11px] italic"
                  >
                    {m.content}
                  </p>
                ) : (
                  <div
                    key={m.id}
                    className="bg-muted/40 flex flex-col gap-0.5 rounded-md px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{m.username}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm break-words">{m.content}</p>
                  </div>
                ),
              )
            )}
          </div>
        </ScrollArea>
      </div>

      <footer className="flex items-center gap-1 border-t p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled}
          aria-label="Chat message"
          className="min-h-[44px] flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          aria-label="Send message"
          size="icon"
          className="size-11 shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </footer>
    </section>
  )
}

export default ChatPanel
