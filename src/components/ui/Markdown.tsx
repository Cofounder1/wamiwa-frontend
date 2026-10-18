import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Agent answers can be plain sentences or structured (AI-06): headings, lists, tables, bold, italics, code and
 * links. A deliberately small Markdown subset; raw HTML is never rendered (React escapes all text) and only
 * http(s) links become links.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  const key = () => `b${blocks.length}`

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    if (line.trim().startsWith('```')) {  // code block
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++])
      i++
      blocks.push(<pre key={key()} className="overflow-x-auto rounded-xl bg-wash p-3 font-mono text-[12.5px] leading-relaxed">{body.join('\n')}</pre>)
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      const size = ['text-[17px]', 'text-[15.5px]', 'text-[14.5px]'][heading[1].length - 1]
      blocks.push(<div key={key()} className={cn('font-extrabold text-ink', size)}>{inline(heading[2])}</div>)
      i++
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {  // table: | a | b |, with an optional |---| row
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={key()} className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b border-line">{head.map((c, n) => <th key={n} className="px-2 py-1.5 font-bold text-ink">{inline(c)}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{body.map((r, n) => <tr key={n}>{r.map((c, m) => <td key={m} className="px-2 py-1.5">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    const bullet = /^\s*[-*•]\s+/, numbered = /^\s*\d+[.)]\s+/
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line)
      const marker = ordered ? numbered : bullet
      const items: string[] = []
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ''))
      const List = ordered ? 'ol' : 'ul'
      blocks.push(<List key={key()} className={cn('space-y-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>{items.map((t, n) => <li key={n}>{inline(t)}</li>)}</List>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*\||\s*[-*•]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={key()}>{para.map((p, n) => <span key={n}>{n > 0 && <br />}{inline(p)}</span>)}</p>)
  }
  return <div className={cn('space-y-2.5 break-words', className)}>{blocks}</div>
}

/** **bold**, *italic*, `code` and [label](https://link) inside a line. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*\s][^*]*)\*)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `i${m.index}`
    if (m[2]) out.push(<strong key={k} className="font-bold text-ink">{m[2]}</strong>)
    else if (m[3]) out.push(<code key={k} className="rounded bg-wash px-1 font-mono text-[0.9em]">{m[3]}</code>)
    else if (m[4]) out.push(<a key={k} href={m[5]} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand underline-offset-2 hover:underline">{m[4]}</a>)
    else if (m[6]) out.push(<em key={k}>{m[6]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
