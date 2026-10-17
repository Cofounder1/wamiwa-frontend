import { useEffect, useMemo, useState } from 'react'
import { Globe2, Search, X } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { Select } from '@/components/ui/primitives'

/** Every country and territory the backend accepts (GET /regions), loaded once per visit. */
export interface Region { id: string; name: string }

let cache: Promise<Region[]> | null = null

export function useRegions(): Region[] {
  const [list, setList] = useState<Region[]>([])
  useEffect(() => {
    let live = true
    cache ??= api.get<Region[]>('/regions').catch((e) => { cache = null; throw e })
    cache.then((r) => { if (live) setList(r) }).catch(() => {})
    return () => { live = false }
  }, [])
  return list
}

/** "united_kingdom" -> "United Kingdom", from the list when it has loaded. */
export function regionName(id: string, list: Region[]) {
  return list.find((r) => r.id === id)?.name ?? id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Choose several regions from every country, by typing. */
export function RegionPicker({ value, onChange, max, disabled }: { value: string[]; onChange: (next: string[]) => void; max: number; disabled?: boolean }) {
  const regions = useRegions()
  const [query, setQuery] = useState('')
  const full = value.length >= max
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return regions.filter((r) => !value.includes(r.id) && (r.name.toLowerCase().includes(q) || r.id.includes(q.replace(/\s+/g, '_')))).slice(0, 8)
  }, [query, regions, value])

  const add = (id: string) => { onChange([...value, id]); setQuery('') }
  return (
    <div className={cn(disabled && 'pointer-events-none opacity-60')}>
      <div className="flex flex-wrap gap-2">
        {value.map((id) => (
          <span key={id} className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-ink pr-1.5 pl-3.5 text-[13.5px] font-semibold text-bg">
            {regionName(id, regions)}
            <button aria-label={`Remove ${regionName(id, regions)}`} onClick={() => onChange(value.filter((x) => x !== id))} className="grid size-6 place-items-center rounded-full hover:bg-white/15"><X className="size-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches[0] && !full) add(matches[0].id) }}
          disabled={full}
          placeholder={full ? `You’ve chosen ${max}. Remove one to add another.` : 'Search any country, e.g. Brazil, Japan, Canada'}
          className="h-11 w-full rounded-pill border border-line bg-surface pr-4 pl-10 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-line-strong disabled:bg-wash"
        />
        {matches.length > 0 && !full && (
          <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
            {matches.map((r) => (
              <li key={r.id}>
                <button onClick={() => add(r.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[14px] text-ink hover:bg-wash">
                  <Globe2 className="size-4 text-ink-3" />{r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && matches.length === 0 && !full && regions.length > 0 && <p className="mt-2 text-[12.5px] text-ink-3">No country matches “{query.trim()}”.</p>}
      </div>
    </div>
  )
}

/** Choose one region from every country. */
export function RegionSelect({ value, onChange, placeholder = 'Choose a country', className }: { value: string; onChange: (id: string) => void; placeholder?: string; className?: string }) {
  const regions = useRegions()
  return (
    <Select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </Select>
  )
}
