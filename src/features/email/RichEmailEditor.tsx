import { useRef, useState } from 'react'
import { Bold, Italic, Link, List } from 'lucide-react'

/** Limited email formatting. Paste/drop are plain text; the API applies the authoritative HTML allowlist. */
export function RichEmailEditor({ initialHtml = '', onChange, disabled, label = 'Message' }: { initialHtml?: string; onChange: (html: string) => void; disabled?: boolean; label?: string }) {
  const editor = useRef<HTMLDivElement>(null), savedRange = useRef<Range | null>(null)
  const [linkOpen, setLinkOpen] = useState(false), [url, setUrl] = useState('')
  function remember() {
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange()
  }
  function command(name: string, value?: string) {
    if (disabled) return
    editor.current?.focus()
    if (savedRange.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(savedRange.current) }
    document.execCommand(name, false, value)
    if (editor.current) onChange(editor.current.innerHTML)
    remember()
  }
  return <div className="overflow-hidden rounded-lg border border-line bg-surface">
    <div role="toolbar" aria-label={`${label} formatting`} className="flex gap-1 border-b border-line bg-surface-subtle p-1">
      {([{ name: 'bold', label: 'Bold', icon: Bold }, { name: 'italic', label: 'Italic', icon: Italic }, { name: 'insertUnorderedList', label: 'Bullet list', icon: List }] as const).map((item) => <button key={item.name} type="button" disabled={disabled} aria-label={item.label} className="compact-control rounded p-2 hover:bg-surface" onMouseDown={(e) => e.preventDefault()} onClick={() => command(item.name)}><item.icon className="size-4" /></button>)}
      <button type="button" disabled={disabled} aria-label="Insert link" className="compact-control rounded p-2 hover:bg-surface" onMouseDown={(e) => e.preventDefault()} onClick={() => setLinkOpen(!linkOpen)}><Link className="size-4" /></button>
    </div>
    {linkOpen && <div className="flex gap-2 border-b border-line p-2"><input aria-label="Link URL" type="url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm" placeholder="https://example.com" /><button type="button" className="compact-control rounded px-2 text-sm font-medium text-brand-700" disabled={!/^https?:\/\//i.test(url)} onClick={() => { if (/^https?:\/\//i.test(url)) { command('createLink', url); setLinkOpen(false); setUrl('') } }}>Add link</button></div>}
    <div ref={editor} role="textbox" aria-label={label} aria-multiline="true" aria-disabled={disabled || undefined} contentEditable={!disabled} suppressContentEditableWarning tabIndex={disabled ? -1 : 0}
      className="email-body min-h-36 p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
      dangerouslySetInnerHTML={{ __html: initialHtml }}
      onMouseUp={remember} onKeyUp={remember} onBlur={remember} onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onPaste={(e) => { e.preventDefault(); command('insertText', e.clipboardData.getData('text/plain')) }}
      onDrop={(e) => { e.preventDefault(); command('insertText', e.dataTransfer.getData('text/plain')) }} />
  </div>
}
