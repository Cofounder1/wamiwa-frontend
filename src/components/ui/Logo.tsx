import { cn } from '@/lib/cn'

/** Wamiwa mark — a "W" drawn as two meeting voices: one human, one agent. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-8', className)} aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--harbor)" />
      <path d="M8.5 13l4.6 15.5L17.6 18l2.4 5.4L22.4 18l4.5 10.5L31.5 13" fill="none" stroke="var(--brand)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31.5" cy="13" r="2.6" fill="#fff" />
    </svg>
  )
}

export function Logo({ className, mono, size = 'md' }: { className?: string; mono?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const t = { sm: 'text-[20px]', md: 'text-[24px]', lg: 'text-[30px]' }[size]
  const m = { sm: 'size-7', md: 'size-8', lg: 'size-10' }[size]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={m} />
      <span className={cn('font-extrabold tracking-[-0.045em]', t, mono ? 'text-current' : 'text-brand')}>wamiwa</span>
    </span>
  )
}
