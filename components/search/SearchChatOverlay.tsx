'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SearchAIPanel } from './SearchAIPanel'
import { cn } from '@/lib/utils'

export interface SearchChatOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  city: string
  country?: string
  followUp?: string | null
  onFollowUpSent?: () => void
  onSaveQuestion?: (question: string) => void
}

export function SearchChatOverlay({
  open,
  onOpenChange,
  query,
  city,
  country = '',
  followUp,
  onFollowUpSent,
  onSaveQuestion,
}: SearchChatOverlayProps) {
  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          'flex flex-col p-0 gap-0 border-0 bg-slate-50',
          'pt-[max(1rem,env(safe-area-inset-top))]',
          'max-md:inset-0 max-md:w-full max-md:max-w-none max-md:h-full max-md:rounded-none',
          'md:w-[420px] md:max-w-[420px] md:min-w-[360px]'
        )}
        overlayClassName="z-[400]"
        contentClassName="z-[401]"
        portalClassName="z-[400]"
      >
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <SearchAIPanel
            query={query}
            city={city}
            country={country}
            followUp={followUp}
            onFollowUpSent={onFollowUpSent}
            onClose={handleClose}
            onSaveQuestion={onSaveQuestion}
            fullHeight
            className="flex-1 min-h-0 flex flex-col"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
