import './pipeline-board.css'
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Clock, GripVertical, Trophy, X, ArrowRight } from 'lucide-react'
import { formatCompactMoney, formatINRCompact } from '../../lib/format'
import { cn } from '../../lib/cn'
import { Avatar } from '../ui/Badge'
import type { BoardDeal, BoardStage } from './types'

interface PipelineBoardProps {
  stages: BoardStage[]
  deals: BoardDeal[]
  /** Called when a deal is dropped on (or keyboard-moved to) another stage. The parent updates `deals`. */
  onMove: (dealId: string, stageId: string) => void
  /** Deals idle this many days or more get a warning badge (unless the deal carries `rotting`). */
  staleDays?: number
  compact?: boolean
  /** Contained workspace columns; marketing previews retain their original sizing. */
  contained?: boolean
  className?: string
  /** Click or Enter on a card (the app opens the deal). */
  onOpen?: (dealId: string) => void
  /** Extra content at the bottom of a column (e.g. "Load more"). */
  renderColumnFooter?: (stage: BoardStage) => ReactNode
  /** False disables dragging and keyboard moves (read-only pipeline, no permission). */
  canMove?: boolean
}

/**
 * Kanban board: drag cards between stages, or focus a card and use ← / → to move it.
 * Controlled — the parent owns `deals` and applies moves (optimistically, in the app).
 */
export function PipelineBoard({
  stages,
  deals,
  onMove,
  staleDays = 7,
  compact = false,
  contained = false,
  className,
  onOpen,
  renderColumnFooter,
  canMove = true,
}: PipelineBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [focusId, setFocusId] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    if (focusId) cardRefs.current.get(focusId)?.focus()
  }, [focusId, deals])

  function move(id: string, stageId: string) {
    const deal = deals.find((d) => d.id === id)
    if (!deal || deal.stageId === stageId) return
    onMove(id, stageId)
    const stage = stages.find((s) => s.id === stageId)
    setAnnouncement(
      stage?.kind === 'won' ? `${deal.company} marked as won.` : `${deal.company} moved to ${stage?.name}.`,
    )
  }

  function onDrop(e: DragEvent, stageId: string) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragId
    if (canMove && id) move(id, stageId)
    setDragId(null)
    setOverStage(null)
  }

  function onCardKey(e: KeyboardEvent, deal: BoardDeal) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' && onOpen) {
      e.preventDefault()
      onOpen(deal.id)
      return
    }
    if (!canMove || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
    e.preventDefault()
    const idx = stages.findIndex((s) => s.id === deal.stageId)
    const next = stages[idx + (e.key === 'ArrowRight' ? 1 : -1)]
    if (next) {
      move(deal.id, next.id)
      setFocusId(deal.id)
    }
  }

  return (
    <div className={cn('flex flex-col', contained && 'sales-board', className)}>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p id="pipeline-help" className="sr-only">
        {canMove ? 'Use the left and right arrow keys to move a focused deal between stages.' : ''}
        {onOpen ? ' Press Enter to open it.' : ''}
      </p>
      <div
        className={cn(
          '-mx-1 flex min-w-0 flex-1 gap-4 overflow-x-auto overscroll-x-contain px-1 pb-4',
          contained && 'sales-board-columns',
          compact && '[mask-image:linear-gradient(to_right,black_88%,transparent)]',
        )}
        role="list"
        aria-label="Sales pipeline"
      >
        {stages.map((stage) => {
          const items = deals.filter((d) => d.stageId === stage.id)
          const total = stage.totalLabel ?? formatINRCompact(items.reduce((sum, d) => sum + d.value, 0))
          const count = stage.count ?? items.length
          const isWon = stage.kind === 'won'
          const isLost = stage.kind === 'lost'
          return (
            <div
              key={stage.id}
              data-stage-kind={stage.kind ?? 'open'}
              role="listitem"
              aria-label={`${stage.name}: ${count} deals, ${total}`}
              onDragOver={(e) => {
                if (!canMove) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setOverStage(stage.id)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null)
              }}
              onDrop={(e) => onDrop(e, stage.id)}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-card p-3 transition-colors',
                contained && 'sales-board-column',
                overStage === stage.id ? 'bg-brand-50 ring-1 ring-brand-200 ring-inset' : 'border border-line bg-surface-subtle',
              )}
            >
              {contained ? (
              <div className={cn('flex items-center justify-between px-2 pt-1 pb-3', contained && 'sales-stage-header')}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isWon ? <Trophy className="size-4 shrink-0 text-success" aria-hidden="true" /> : isLost ? <X className="size-4 shrink-0 text-danger" aria-hidden="true" /> : <span className="size-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                    <span className="truncate text-sm font-semibold text-ink" title={stage.name}>{stage.name}</span>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted ring-1 ring-line">{count.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2"><span className="text-base font-semibold tabular-nums tracking-tight text-ink">{total}</span></div>
                  {stage.subtitle && <p className="mt-1 truncate text-xs tabular-nums text-muted">{stage.subtitle}</p>}
                </div>
              </div>
              ) : (
              <div className="flex items-center justify-between px-2 pt-1 pb-3">
                <div className="flex items-center gap-2">
                  {isWon ? (
                    <Trophy className="size-4 text-success" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn('size-2 rounded-full', isLost ? 'bg-red-400' : 'bg-muted')}
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-xs font-semibold text-ink">{stage.name}</span>
                  <span className="text-xs text-muted tabular-nums">{count}</span>
                </div>
                <span className="text-right">
                  <span className="block font-mono text-xs text-muted tabular-nums">{total}</span>
                  {stage.subtitle && (
                    <span className="block font-mono text-xs text-muted/70 tabular-nums">{stage.subtitle}</span>
                  )}
                </span>
              </div>

              )}
              <div className={cn('flex flex-1 flex-col gap-2', compact ? 'min-h-[180px]' : 'min-h-[260px]', contained && 'sales-stage-body')}>
                {items.map((deal) => {
                  const primary = contained ? deal.title : deal.company
                  const secondary = contained ? deal.company : deal.title
                  const stale = deal.rotting ?? deal.days >= staleDays
                  return (
                    <div
                      key={deal.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(deal.id, el)
                        else cardRefs.current.delete(deal.id)
                      }}
                      draggable={canMove}
                      tabIndex={0}
                      onClick={onOpen ? () => onOpen(deal.id) : undefined}
                      aria-describedby="pipeline-help"
                      aria-label={`${deal.company}, ${deal.title}, ${formatCompactMoney(deal.value, deal.currency)}, owner ${deal.owner}`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', deal.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragId(deal.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverStage(null)
                      }}
                      onKeyDown={(e) => onCardKey(e, deal)}
                      onBlur={() => setFocusId(null)}
                      className={cn(
                        'group rounded-xl border border-line bg-surface p-3 text-left shadow-card transition-[box-shadow,opacity,transform] hover:border-brand-300 hover:shadow-float focus-visible:outline-2 focus-visible:outline-brand-500',
                        canMove ? 'cursor-grab active:cursor-grabbing' : onOpen ? 'cursor-pointer' : '',
                        dragId === deal.id && 'opacity-40',
                        isWon && 'border-emerald-200 bg-emerald-50/20',
                        isLost && 'opacity-75',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p title={primary} className="truncate text-sm font-semibold text-ink">{primary}</p>
                        <GripVertical
                          className="size-4 shrink-0 text-muted/50 group-hover:text-muted"
                          aria-hidden="true"
                        />
                      </div>
                      {secondary !== primary && <p title={secondary} className="mt-1 truncate text-xs text-muted">{secondary}</p>}
                      <div className="mt-3 flex items-center justify-between">
                        <span className={cn('font-semibold text-ink tabular-nums', contained ? 'text-lg tracking-tight' : 'text-sm')}>
                          {formatCompactMoney(deal.value, deal.currency)}
                        </span>
                        <div className="flex items-center gap-2">
                          {stale && !isWon && !isLost && (
                            <span className="inline-flex items-center gap-1 rounded-control bg-amber-50 px-1 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200/70">
                              <Clock className="size-3" aria-hidden="true" />
                              {deal.days}d idle
                            </span>
                          )}
                          <span title={deal.owner}><Avatar name={deal.owner} size="xs" /></span>
                        </div>
                      </div>
                      {canMove && onOpen && (
                        <select
                          aria-label={`Move ${deal.title} to stage`}
                          value={deal.stageId}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => onMove(deal.id, e.target.value)}
                          className="mt-3 h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-muted transition-colors hover:border-brand-300 hover:text-ink focus:border-brand-500 focus:outline-none"
                        >
                          <option value={deal.stageId}>Move to stage…</option>
                          {stages
                            .filter((s) => s.id !== deal.stageId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  )
                })}
                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                    <span>{contained && <ArrowRight className="mx-auto mb-2 size-5 text-muted/60" aria-hidden="true" />}<span className="block font-medium text-ink">{contained ? (canMove ? 'Ready for the next deal' : 'No deals in this stage') : (canMove ? 'Drop a deal here' : 'No deals')}</span>{contained && <span className="mt-1 block">{canMove ? 'Drag a card here to move it.' : 'Deals will appear here as they progress.'}</span>}</span>
                  </div>
                )}
                {renderColumnFooter?.(stage)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
