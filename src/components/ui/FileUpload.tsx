import { useId, useRef, useState, type ReactNode } from 'react'
import { ArrowUpFromLine, FileSpreadsheet } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  disabled?: boolean
  description?: string
  footer?: ReactNode
  onError?: (message: string) => void
  maxSize?: number
  className?: string
}

/** Single-file picker with keyboard access, nested drag handling, and validation. */
export function FileUpload({ onFileSelect, accept, disabled, description = 'Choose a file to get started.', footer, onError, maxSize, className }: FileUploadProps) {
  const input = useRef<HTMLInputElement>(null), depth = useRef(0), hintId = useId()
  const [dragging, setDragging] = useState(false), [error, setError] = useState('')
  function select(files: FileList | null) {
    if (disabled || !files?.length) return
    const file = files[0]
    const allowed = accept?.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
    const invalidType = allowed?.length && !allowed.some((type) => type.startsWith('.') ? file.name.toLowerCase().endsWith(type) : type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type)
    const message = files.length > 1 ? 'Please choose one file at a time.' : invalidType ? `Choose a supported file (${accept}).` : maxSize && file.size > maxSize ? `Your file exceeds the ${Math.round(maxSize / 1024 ** 2)} MB limit. Please choose a smaller file.` : file.size === 0 ? 'This file is empty. Please choose a file with data.' : ''
    setError(message)
    if (message) { onError?.(message); return }
    onFileSelect(file)
  }
  return <div className={className}>
    <div
      onDragEnter={(event) => { event.preventDefault(); if (!disabled && event.dataTransfer.types.includes('Files')) { depth.current++; setDragging(true) } }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy' }}
      onDragLeave={(event) => { event.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false) }}
      onDrop={(event) => { event.preventDefault(); depth.current = 0; setDragging(false); select(event.dataTransfer.files) }}
      className={cn('relative rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-7', disabled ? 'border-line bg-surface-subtle opacity-60' : dragging ? 'border-brand-500 bg-brand-100/60' : 'border-zinc-300 bg-surface-subtle hover:border-brand-400 hover:bg-brand-50/40', error && 'border-red-300')}
    >
      <input ref={input} type="file" accept={accept} disabled={disabled} className="sr-only" tabIndex={-1} aria-label="Choose a file" aria-describedby={hintId} onChange={(event) => { select(event.target.files); event.target.value = '' }} />
      <div className="relative mx-auto mb-5 flex size-16 items-center justify-center rounded-dialog border border-line bg-surface text-brand-700 shadow-card" aria-hidden="true">
        <FileSpreadsheet className="size-7" strokeWidth={1.5} />
        <span className="absolute -right-2 -bottom-1 flex size-7 items-center justify-center rounded-full border-4 border-surface bg-brand-600 text-white"><ArrowUpFromLine className="size-4" /></span>
      </div>
      <p className="text-base font-semibold tracking-tight text-ink">{dragging ? 'Drop your file here' : 'Drag and drop your file here'}</p>
      <p id={hintId} className="mt-2 text-sm text-muted">{description}</p>
      <div className="my-4 flex items-center justify-center gap-3 text-xs text-muted"><span className="h-px w-9 bg-line" />or<span className="h-px w-9 bg-line" /></div>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"><ArrowUpFromLine className="size-4" aria-hidden="true" />Browse files</button>
      {footer && <div className="mt-5 text-xs text-muted">{footer}</div>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}
