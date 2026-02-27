'use client'

import { LayoutGrid, List, Rows, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/components/LanguageContext'

export type ViewType = 'thumbnail' | 'list' | 'horizontal' | 'thumbnail-2col'

interface ViewSwitcherProps {
  view: ViewType
  onViewChange: (view: ViewType) => void
}

export function ViewSwitcher({ view, onViewChange }: ViewSwitcherProps) {
  const { t } = useLanguage()

  const views: { type: ViewType; icon: React.ReactNode; label: string; labelAr: string }[] = [
    {
      type: 'thumbnail',
      icon: <LayoutGrid className="w-4 h-4" />,
      label: 'Thumbnail',
      labelAr: 'مصغرات'
    },
    {
      type: 'thumbnail-2col',
      icon: <Grid3x3 className="w-4 h-4" />,
      label: '2 Columns',
      labelAr: 'عمودان'
    },
    {
      type: 'list',
      icon: <List className="w-4 h-4" />,
      label: 'List',
      labelAr: 'قائمة'
    },
    {
      type: 'horizontal',
      icon: <Rows className="w-4 h-4" />,
      label: 'Scroll',
      labelAr: 'تمرير'
    }
  ]

  return (
    <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1">
      {views.map((viewOption) => (
        <Button
          key={viewOption.type}
          variant="ghost"
          size="sm"
          onClick={() => onViewChange(viewOption.type)}
          className={cn(
            "h-8 px-3 rounded-full transition-all",
            view === viewOption.type
              ? "bg-white shadow-sm text-black"
              : "text-slate-600 hover:text-black"
          )}
          title={t(viewOption.label, viewOption.labelAr)}
        >
          {viewOption.icon}
          <span className="ml-1.5 text-xs font-medium hidden sm:inline">
            {t(viewOption.label, viewOption.labelAr)}
          </span>
        </Button>
      ))}
    </div>
  )
}
