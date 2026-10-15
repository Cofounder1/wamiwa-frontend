import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface MenuItem { label: ReactNode; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }

export function Menu({ items, trigger, align = 'right', className }: { items: MenuItem[]; trigger?: ReactNode; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        aria-label="More actions"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="grid size-8 place-items-center rounded-full text-ink-3 transition hover:bg-wash hover:text-ink"
      >
        {trigger ?? <MoreHorizontal className="size-[18px]" />}
      </button>
      {open && (
        <div role="menu" className={cn('absolute z-50 mt-1 min-w-48 animate-pop rounded-2xl bg-surface p-1.5 shadow-pop ring-1 ring-line', align === 'right' ? 'right-0' : 'left-0')}>
          {items.filter((i) => !i.hidden).map((i, idx) => (
            <button
              key={idx}
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setOpen(false); i.onClick() }}
              className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold transition hover:bg-wash [&>svg]:size-4', i.danger ? 'text-danger' : 'text-ink')}
            >
              {i.icon}
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
