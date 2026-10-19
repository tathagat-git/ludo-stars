'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DirectionPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dice: number
  forwardCaptures: number
  backwardCaptures: number
  onPick: (direction: 'forward' | 'backward') => void
  children: React.ReactNode // the trigger (token)
}

/// Popover shown when a token has BOTH a forward and a backward legal move
/// (twist mode). Offers two choices; calls `onPick` with the chosen
/// direction. If only one direction is legal the parent should auto-pick
/// instead of rendering this.
export function DirectionPicker({
  open,
  onOpenChange,
  dice,
  forwardCaptures,
  backwardCaptures,
  onPick,
  children,
}: DirectionPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={6}
        className="w-56 p-3"
        aria-label="Choose move direction"
      >
        <p className="text-muted-foreground mb-2 text-center text-xs font-medium">
          Move {dice} step{dice === 1 ? '' : 's'} — choose direction
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="default"
            className="min-h-[44px] justify-start"
            onClick={() => {
              onPick('forward')
              onOpenChange(false)
            }}
          >
            <ArrowUp className="size-4" />
            Forward ({dice})
            {forwardCaptures > 0 && (
              <span className="ml-auto rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                CAPTURE ×{forwardCaptures}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            className="min-h-[44px] justify-start"
            onClick={() => {
              onPick('backward')
              onOpenChange(false)
            }}
          >
            <ArrowDown className="size-4" />
            Backward ({dice})
            {backwardCaptures > 0 && (
              <span className="ml-auto rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                CAPTURE ×{backwardCaptures}
              </span>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default DirectionPicker
