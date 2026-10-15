import {
  forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Bot, Building2, Check, ChevronRight, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/* ── Button ─────────────────────────────────────────────────────────────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'dark' | 'link'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong shadow-[0_1px_0_rgba(255,255,255,.25)_inset] hover:shadow-lift',
  secondary: 'bg-wash text-ink hover:bg-mist/70',
  ghost: 'text-ink hover:bg-wash',
  outline: 'border border-line-strong text-ink hover:bg-wash hover:border-mist bg-surface',
  danger: 'bg-danger text-white hover:opacity-90',
  dark: 'bg-ink text-bg hover:opacity-90',
  link: 'text-brand hover:underline underline-offset-4 !px-0 !h-auto',
}
const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-full',
  sm: 'h-8 px-3.5 text-[13px] gap-1.5 rounded-full',
  md: 'h-10 px-5 text-sm gap-2 rounded-pill',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-pill',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  to?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, className, children, to, disabled, ...rest },
  ref,
) {
  const cls = cn(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap select-none transition-all duration-150',
    'active:scale-[.98] disabled:opacity-50 disabled:active:scale-100',
    variants[variant], sizes[size], className,
  )
  const inner = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
      {iconRight}
    </>
  )
  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>{inner}</button>
})

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn('inline-grid size-9 place-items-center rounded-full text-ink-2 transition hover:bg-wash hover:text-ink', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ── Card ───────────────────────────────────────────────────────────────── */

export function Card({ className, children, flat, as: As = 'div', ...rest }: {
  className?: string; children?: ReactNode; flat?: boolean; as?: 'div' | 'section' | 'article'
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <As
      className={cn('rounded-card bg-surface', flat ? 'border border-line' : 'shadow-card ring-1 ring-line/60', className)}
      {...rest}
    >
      {children}
    </As>
  )
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ── Badge / Chip ───────────────────────────────────────────────────────── */

type Tone = 'brand' | 'neutral' | 'teal' | 'success' | 'warn' | 'danger' | 'agent' | 'dark' | 'outline'
const tones: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-wash text-ink-2',
  teal: 'bg-teal-soft text-teal',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  agent: 'bg-agent-soft text-agent',
  dark: 'bg-ink text-bg',
  outline: 'border border-line-strong text-ink-2',
}

export function Badge({ tone = 'brand', icon, children, className, dot }: {
  tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; dot?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11.5px] font-semibold leading-5 whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  )
}

export function Chip({ active, children, onClick, icon, className }: {
  active?: boolean; children: ReactNode; onClick?: () => void; icon?: ReactNode; className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-chip border px-3.5 text-[13px] font-semibold transition whitespace-nowrap',
        active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-wash',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/* ── Avatar — shape encodes account type ────────────────────────────────── */

export type AvatarKind = 'human' | 'company' | 'agent'
const avatarSize = { xs: 'size-6', sm: 'size-8', md: 'size-10', lg: 'size-14', xl: 'size-20', '2xl': 'size-28' }

export function Avatar({ src, name, kind = 'human', size = 'md', className, ring }: {
  src?: string; name: string; kind?: AvatarKind; size?: keyof typeof avatarSize; className?: string; ring?: boolean
}) {
  const shape = kind === 'human' ? 'rounded-full' : kind === 'company' ? 'rounded-[28%]' : 'rounded-[34%]'
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className={cn('relative inline-block shrink-0', avatarSize[size], className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" className={cn('size-full object-cover', shape, ring && 'ring-2 ring-surface')} />
      ) : (
        <span className={cn('grid size-full place-items-center bg-wash text-[0.7em] font-bold text-ink-2', shape, ring && 'ring-2 ring-surface')}>
          {initials}
        </span>
      )}
      {kind === 'agent' && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-[42%] min-h-3.5 min-w-3.5 place-items-center rounded-full bg-agent text-white ring-2 ring-surface">
          <Bot className="size-[70%]" strokeWidth={2.5} />
        </span>
      )}
      {kind === 'company' && size !== 'xs' && size !== 'sm' && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-[38%] min-h-3.5 min-w-3.5 place-items-center rounded-full bg-ink text-bg ring-2 ring-surface">
          <Building2 className="size-[62%]" strokeWidth={2.5} />
        </span>
      )}
    </span>
  )
}

export function AvatarStack({ srcs, size = 'sm', ringClass = 'ring-surface' }: { srcs: string[]; size?: keyof typeof avatarSize; ringClass?: string }) {
  return (
    <div className="flex -space-x-2">
      {srcs.map((s, i) => (
        <img key={i} src={s} alt="" className={cn('rounded-full object-cover ring-2', avatarSize[size], ringClass)} />
      ))}
    </div>
  )
}

/* ── Form controls ──────────────────────────────────────────────────────── */

const fieldBase =
  'rounded-2xl border border-line bg-surface px-4 text-[14px] text-ink placeholder:text-ink-3 transition ' +
  'hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; suffix?: ReactNode }>(
  function Input({ className, icon, suffix, ...rest }, ref) {
    return (
      <div className="relative">
        {icon && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3 [&>svg]:size-4">{icon}</span>}
        <input ref={ref} className={cn(fieldBase, 'h-11 w-full', icon && 'pl-10', suffix && 'pr-14', className)} {...rest} />
        {suffix && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-ink-3">{suffix}</span>}
      </div>
    )
  },
)

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, 'min-h-24 w-full py-3 leading-relaxed', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, /(^|\s)(sm:|md:)?!?w-/.test(className ?? '') ? '' : 'w-full', 'h-11 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23688dac' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Field({ label, hint, error, children, className, optional }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; optional?: boolean
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">Optional</span>}
      </span>
      {children}
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export function Switch({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean
}) {
  const id = useId()
  const control = (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand' : 'bg-mist')}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-5')} />
    </button>
  )
  if (!label) return control
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-2">{description}</span>}
      </label>
      {control}
    </div>
  )
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-ink-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition', checked ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface')}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </button>
      <span>{children}</span>
    </label>
  )
}

/* ── Segmented & Tabs ───────────────────────────────────────────────────── */

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[]; className?: string; size?: 'sm' | 'md'
}) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-pill border border-line bg-surface p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[20px] font-semibold transition-all',
            size === 'sm' ? 'h-7 px-3 text-[12.5px]' : 'h-9 px-4 text-[13.5px]',
            value === o.value ? 'bg-wash font-bold text-ink' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: {
  value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[]; className?: string
}) {
  return (
    <div role="tablist" className={cn('no-scrollbar flex gap-6 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'relative -mb-px flex items-center gap-2 border-b-2 pt-1 pb-3 text-[14px] font-semibold whitespace-nowrap transition',
            value === t.value ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-[11px] leading-5 num', value === t.value ? 'bg-brand text-on-brand' : 'bg-wash text-ink-2')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Modal ──────────────────────────────────────────────────────────────── */

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title?: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade bg-harbor/45 backdrop-blur-[3px]" onClick={onClose} />
      <div className={cn('relative flex max-h-[92dvh] w-full animate-pop flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-pop sm:rounded-[28px]', w)}>
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13.5px] text-ink-2">{subtitle}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1"><X className="size-5" /></IconButton>
          </div>
        )}
        <div className="scroll-thin overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ── Layout helpers ─────────────────────────────────────────────────────── */

export function PageHeader({ title, subtitle, actions, eyebrow, back }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; back?: { to: string; label: string }
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink">
            <ChevronRight className="size-4 rotate-180" /> {back.label}
          </Link>
        )}
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        {title && <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[32px]">{title}</h1>}
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Section({ title, subtitle, action, children, className }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={cn('mb-10', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-extrabold text-ink">{title}</h2>}
            {subtitle && <p className="text-[13.5px] text-ink-2">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, icon, trend, className }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; trend?: number; className?: string
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between text-[13px] font-semibold text-ink-2">
        <span>{label}</span>
        {icon && <span className="text-ink-3 [&>svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-2 text-[28px] leading-none font-extrabold tracking-[-0.03em] text-ink num">{value}</div>
      {(sub || trend !== undefined) && (
        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-2">
          {trend !== undefined && (
            <span className={cn('font-bold num', trend >= 0 ? 'text-success' : 'text-danger')}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub}
        </div>
      )}
    </Card>
  )
}

export function Progress({ value, max = 100, tone = 'brand', className }: { value: number; max?: number; tone?: 'brand' | 'teal' | 'warn' | 'danger' | 'success'; className?: string }) {
  const bg = { brand: 'bg-brand', teal: 'bg-teal', warn: 'bg-warn', danger: 'bg-danger', success: 'bg-success' }[tone]
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-wash', className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-wash text-brand [&>svg]:size-6">{icon}</div>}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-[13.5px] text-ink-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Callout({ tone = 'brand', icon, title, children, action, className }: {
  tone?: 'brand' | 'warn' | 'danger' | 'success' | 'neutral' | 'agent'; icon?: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string
}) {
  const t = {
    brand: 'bg-brand-soft/70 border-brand/20 [&_.ic]:text-brand',
    warn: 'bg-warn-soft border-warn/25 [&_.ic]:text-warn',
    danger: 'bg-danger-soft border-danger/25 [&_.ic]:text-danger',
    success: 'bg-success-soft border-success/25 [&_.ic]:text-success',
    neutral: 'bg-surface-2 border-line [&_.ic]:text-ink-2',
    agent: 'bg-agent-soft border-agent/25 [&_.ic]:text-agent',
  }[tone]
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4', t, className)}>
      {icon && <span className="ic mt-0.5 shrink-0 [&>svg]:size-[18px]">{icon}</span>}
      <div className="min-w-0 flex-1 text-[13.5px] text-ink-2">
        {title && <div className="mb-0.5 font-bold text-ink">{title}</div>}
        {children}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-badge bg-wash px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-2">{children}</kbd>
}

export function Divider({ className, label }: { className?: string; label?: ReactNode }) {
  if (!label) return <hr className={cn('border-line', className)} />
  return (
    <div className={cn('flex items-center gap-3 text-xs font-semibold text-ink-3', className)}>
      <span className="h-px flex-1 bg-line" />{label}<span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function KV({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line text-[13.5px]', className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-ink-2">{k}</dt>
          <dd className="text-right font-semibold text-ink num">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ── Stepper (for multi-step flows: escrow, likeness, minors) ──────────── */

export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn('flex w-full items-start', className)}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cn('absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2', i <= current ? 'bg-brand' : 'bg-line')} />}
            <span
              className={cn(
                'relative z-10 grid size-7 place-items-center rounded-full text-xs font-bold ring-4 ring-surface transition',
                done ? 'bg-brand text-on-brand' : active ? 'bg-ink text-bg' : 'bg-wash text-ink-3',
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('mt-2 px-1 text-[11.5px] leading-tight font-semibold', active ? 'text-ink' : 'text-ink-3')}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */

type ToastItem = { id: number; title: string; body?: string; tone?: 'success' | 'brand' | 'warn' | 'danger' }
let pushToast: (t: Omit<ToastItem, 'id'>) => void = () => {}
export const toast = (title: string, body?: string, tone: ToastItem['tone'] = 'success') => pushToast({ title, body, tone })

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x, { ...t, id }])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200)
    }
  }, [])
  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-4 z-[200] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex animate-pop gap-3 rounded-2xl bg-ink p-4 text-bg shadow-pop">
          <span className={cn('mt-1 size-2 shrink-0 rounded-full', {
            success: 'bg-teal', brand: 'bg-brand', warn: 'bg-warn', danger: 'bg-danger',
          }[t.tone ?? 'success'])} />
          <div className="min-w-0">
            <div className="text-sm font-bold">{t.title}</div>
            {t.body && <div className="mt-0.5 text-[13px] opacity-75">{t.body}</div>}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  )
}
