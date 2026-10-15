import { useEffect, useMemo, useRef, useState } from 'react'
import { Table2, LineChart as LineIcon } from 'lucide-react'
import { compact, int } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface Series { name: string; color: string; data: { date: string; value: number }[] }

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** Line/area chart with crosshair tooltip, legend and a table view. */
export function TimeChart({ series, height = 220, format = compact, area = true, title }: {
  series: Series[]; height?: number; format?: (n: number) => string; area?: boolean; title?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const ref = useRef<SVGSVGElement>(null)
  const box = useRef<HTMLDivElement>(null)
  // Match the viewBox to the rendered width so axis text stays at true size.
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [table])
  const H = height
  const pad = { l: 44, r: 12, t: 12, b: 26 }
  const n = series[0]?.data.length ?? 0
  const max = useMemo(() => {
    const m = Math.max(...series.flatMap((s) => s.data.map((d) => d.value)))
    const mag = 10 ** Math.floor(Math.log10(m))
    return Math.ceil(m / mag) * mag
  }, [series])
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {series.length > 1 ? (
          <div className="flex flex-wrap gap-4">
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
                <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />{s.name}
              </span>
            ))}
          </div>
        ) : <span className="text-[12.5px] font-semibold text-ink-2">{title ?? series[0]?.name}</span>}
        <button onClick={() => setTable(!table)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-ink-3 hover:bg-wash hover:text-ink">
          {table ? <><LineIcon className="size-3.5" />Chart</> : <><Table2 className="size-3.5" />Table</>}
        </button>
      </div>
      {table ? (
        <div className="scroll-thin max-h-[260px] overflow-auto rounded-xl border border-line">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-surface-2 text-left text-ink-2">
              <tr><th className="px-3 py-2 font-semibold">Date</th>{series.map((s) => <th key={s.name} className="px-3 py-2 text-right font-semibold">{s.name}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {series[0].data.map((d, i) => (
                <tr key={d.date}><td className="px-3 py-1.5 text-ink-2">{fmtDay(d.date)}</td>{series.map((s) => <td key={s.name} className="px-3 py-1.5 text-right font-semibold text-ink num">{int(s.data[i].value)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={box} className="relative">
          <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={series.map((s) => s.name).join(' and ')}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={i} id={`g-${s.name.replace(/\W/g, '')}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={s.color} stopOpacity={0.18} />
                  <stop offset="1" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '3 4'} />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" className="num">{compact(t)}</text>
              </g>
            ))}
            {[0, Math.floor(n / 2), n - 1].map((i) => series[0]?.data[i] && (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--ink-3)">{fmtDay(series[0].data[i].date)}</text>
            ))}
            {series.map((s) => {
              const d = s.data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
              return (
                <g key={s.name}>
                  {area && <path d={`${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#g-${s.name.replace(/\W/g, '')})`} />}
                  <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              )
            })}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--ink-3)" strokeDasharray="2 3" />
                {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.data[hover].value)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
              </g>
            )}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-xl bg-ink px-3 py-2 text-[12px] text-bg shadow-pop"
              style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? 'calc(-100% - 12px)' : '12px'})` }}
            >
              <div className="mb-1 font-semibold opacity-70">{fmtDay(series[0].data[hover].date)}</div>
              {series.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <span className="font-bold num">{format(s.data[hover].value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Horizontal bar list — magnitude by category, direct-labeled. */
export function BarList({ rows, format = int, color = 'var(--human)' }: { rows: { label: string; value: number; sub?: string }[]; format?: (n: number) => string; color?: string }) {
  const max = Math.max(...rows.map((r) => r.value))
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-semibold text-ink">{r.label}{r.sub && <span className="ml-1.5 font-normal text-ink-3">{r.sub}</span>}</span>
            <span className="font-bold text-ink num">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-wash">
            <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Two-part split bar: human vs agent (FD-06). Always labeled, never color-only. */
export function SplitBar({ human, agent, className }: { human: number; agent: number; className?: string }) {
  const total = human + agent || 1
  return (
    <div className={className}>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        <div className="rounded-l-full bg-human" style={{ width: `${(human / total) * 100}%` }} />
        <div className="rounded-r-full bg-agent" style={{ width: `${(agent / total) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] font-semibold text-ink-2 num">
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-human" />Human {compact(human)}</span>
        <span className="flex items-center gap-1">Agent {compact(agent)}<span className="size-1.5 rounded-full bg-agent" /></span>
      </div>
    </div>
  )
}

export function Sparkline({ data, className, color = 'var(--brand)' }: { data: number[]; className?: string; color?: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 26 - 2}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn('h-8 w-24', className)} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Value vs target meter (AD-05: every success metric shows its target). */
export function TargetMeter({ value, target, inverse, format = int }: { value: number; target: number; inverse?: boolean; format?: (n: number) => string }) {
  const ok = inverse ? value <= target : value >= target
  const ratio = inverse ? Math.min(1, target / Math.max(value, 0.0001)) : Math.min(1, value / target)
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-wash">
        <div className={cn('h-full rounded-full', ok ? 'bg-success' : 'bg-warn')} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-3">
        <span className={cn('font-semibold', ok ? 'text-success' : 'text-warn')}>{ok ? '✓ On target' : '△ Below target'}</span>
        <span className="num">Target {inverse ? '<' : ''}{format(target)}</span>
      </div>
    </div>
  )
}
