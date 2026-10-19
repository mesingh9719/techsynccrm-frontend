import type { ReactNode } from 'react'

/**
 * Renders the limited Markdown used in notes — **bold**, *italics*, `- ` / `1. ` lists, [links](https://…)
 * and @[Name](userId) mentions — as React nodes. No HTML is ever injected: the server strips tags
 * and escapes angle brackets; React escapes everything else.
 */

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|@\[[^\]]+\]\([0-9a-f-]{36}\))/gi

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(TOKEN)) {
    const t = m[0]
    if (m.index! > last) out.push(unescape(text.slice(last, m.index)))
    const k = `${key}-${i++}`
    if (t.startsWith('**')) out.push(<strong key={k}>{unescape(t.slice(2, -2))}</strong>)
    else if (t.startsWith('@[')) out.push(<span key={k} className="rounded bg-brand-50 px-1 font-medium text-brand-800">@{unescape(t.slice(2, t.indexOf(']')))}</span>)
    else if (t.startsWith('[')) {
      const label = t.slice(1, t.indexOf(']'))
      const href = t.slice(t.indexOf('(') + 1, -1)
      out.push(
        <a key={k} href={href} target="_blank" rel="noreferrer noopener" className="text-brand-700 underline underline-offset-2">
          {unescape(label)}
        </a>,
      )
    } else out.push(<em key={k}>{unescape(t.slice(1, -1))}</em>)
    last = m.index! + t.length
  }
  if (last < text.length) out.push(unescape(text.slice(last)))
  return out
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`l${blocks.length}`} className={list.ordered ? 'my-1 list-decimal pl-5' : 'my-1 list-disc pl-5'}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item, `l${blocks.length}-${i}`)}</li>
        ))}
      </Tag>,
    )
    list = null
  }
  text.split('\n').forEach((line, i) => {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flush()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
      return
    }
    flush()
    if (line.trim()) blocks.push(<p key={`p${i}`}>{inline(line, `p${i}`)}</p>)
    else if (blocks.length) blocks.push(<div key={`b${i}`} className="h-2" />)
  })
  flush()
  return <div className={className}>{blocks}</div>
}
