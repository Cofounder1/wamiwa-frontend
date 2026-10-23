import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUp, FileText, Printer, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MarketingFooter, MarketingNav } from '@/pages/marketing/Landing'
import { PRIVACY, TERMS, type Block, type LegalDoc } from './content'

export function Terms() { return <LegalPage doc={TERMS} other={{ to: '/privacy', label: 'Privacy Policy', icon: <ShieldCheck className="size-4" /> }} /> }
export function Privacy() { return <LegalPage doc={PRIVACY} other={{ to: '/terms', label: 'Terms of Service', icon: <FileText className="size-4" /> }} /> }

function LegalPage({ doc, other }: { doc: LegalDoc; other: { to: string; label: string; icon: ReactNode } }) {
  const { hash } = useLocation()
  const [active, setActive] = useState(doc.sections[0].id)

  useEffect(() => { document.title = `${doc.title} · Wamiwa` }, [doc.title])
  useEffect(() => {
    // Links such as /terms#payments land on that clause.
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [hash, doc])
  useEffect(() => {
    // Highlight the section being read in the contents list.
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (seen) setActive(seen.target.id)
    }, { rootMargin: '-90px 0px -65% 0px' })
    doc.sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [doc])

  return (
    <div className="min-h-dvh bg-bg">
      <div className="print:hidden"><MarketingNav /></div>

      <section className="border-b border-line bg-surface-2 print:border-0 print:bg-transparent">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-16">
          <div className="eyebrow">Legal</div>
          <h1 className="mt-3 text-[40px] leading-[1.05] font-extrabold tracking-[-0.04em] text-ink sm:text-[52px]">{doc.title}</h1>
          <p className="mt-4 text-[14.5px] text-ink-2">
            <b className="font-semibold text-ink">Effective date:</b> {doc.effective} <span className="mx-1.5 text-ink-3">·</span>
            <b className="font-semibold text-ink">Last updated:</b> {doc.updated}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 print:hidden">
            <Link to={other.to} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition hover:bg-wash">{other.icon}{other.label}</Link>
            <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition hover:bg-wash"><Printer className="size-4" />Print or save as PDF</button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block print:hidden">
          <nav aria-label="Contents" className="scroll-thin sticky top-[96px] max-h-[calc(100dvh-120px)] overflow-y-auto pr-2">
            <div className="mb-2 px-3 text-[11px] font-bold tracking-[0.08em] text-ink-3 uppercase">Contents</div>
            {doc.sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined}
                className={cn('flex gap-2 rounded-lg px-3 py-1.5 text-[13.5px] leading-snug font-semibold transition', active === s.id ? 'bg-brand-soft text-ink' : 'text-ink-2 hover:bg-wash hover:text-ink')}>
                <span className="w-5 shrink-0 text-ink-3 num">{i + 1}.</span>{s.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="max-w-[760px] min-w-0">
          {/* Small screens: the contents as a list at the top. */}
          <details className="mb-10 rounded-2xl border border-line bg-surface p-4 lg:hidden print:hidden">
            <summary className="cursor-pointer text-[14px] font-bold text-ink">Contents</summary>
            <ol className="mt-3 space-y-1.5 text-[14px]">
              {doc.sections.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="text-ink-2 hover:text-ink"><span className="mr-1.5 text-ink-3 num">{i + 1}.</span>{s.title}</a></li>)}
            </ol>
          </details>

          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-[96px] border-b border-line py-9 first:pt-0 last:border-0">
              <h2 className="group text-[24px] leading-tight font-extrabold tracking-[-0.02em] text-ink">
                <a href={`#${s.id}`} className="hover:underline-offset-4">{i + 1}. {s.title}</a>
              </h2>
              <div className="mt-5 space-y-4 text-[15.5px] leading-[1.7] text-ink-2">{s.blocks.map((b, n) => <BlockView key={n} b={b} />)}</div>
            </section>
          ))}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-5 text-[14px] text-ink-2 print:hidden">
            <span>Questions about this document? Email <a href="mailto:legal@wamiwa.site" className="font-semibold text-brand hover:underline">legal@wamiwa.site</a>.</span>
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline"><ArrowUp className="size-4" />Back to top</a>
          </div>
        </article>
      </div>

      <div className="print:hidden"><MarketingFooter /></div>
    </div>
  )
}

function BlockView({ b }: { b: Block }) {
  if ('p' in b) return <p>{inline(b.p)}</p>
  if ('ul' in b) return <ul className="list-disc space-y-2 pl-6 marker:text-ink-3">{b.ul.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>
  if ('ol' in b) return <ol className="list-decimal space-y-2 pl-6 marker:text-ink-3">{b.ol.map((t, i) => <li key={i}>{inline(t)}</li>)}</ol>
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className={cn('w-full text-left text-[14px] leading-relaxed', b.table.head.length > 2 && 'min-w-[560px]')}>
        <thead className="bg-surface-2"><tr>{b.table.head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-bold text-ink">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">
          {b.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cn('px-4 py-2.5 align-top', j === 0 && 'font-semibold text-ink')}>{inline(c)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

/** **bold** and [label](href): site paths become in-app links; mailto, tel and https open as usual. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:\/|mailto:|tel:|https:\/\/)[^\s)]*)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = m.index
    if (m[1]) out.push(<strong key={k} className="font-bold text-ink">{m[1]}</strong>)
    else if (m[3].startsWith('/')) out.push(<Link key={k} to={m[3]} className="font-semibold text-brand underline-offset-2 hover:underline">{m[2]}</Link>)
    else out.push(<a key={k} href={m[3]} {...(m[3].startsWith('https') ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="font-semibold text-brand underline-offset-2 hover:underline">{m[2]}</a>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
