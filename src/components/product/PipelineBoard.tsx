import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Clock, GripVertical, Trophy } from 'lucide-react'
import { formatINRCompact } from '../../lib/format'
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
    if (id) move(id, stageId)
    setDragId(null)
    setOverStage(null)
  }

  function onCardKey(e: KeyboardEvent, deal: BoardDeal) {
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
    <div className={cn('flex flex-col', className)}>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p id="pipeline-help" className="sr-only">
        {canMove ? 'Use the left and right arrow keys to move a focused deal between stages.' : ''}
        {onOpen ? ' Press Enter to open it.' : ''}
      </p>
      <div
        className={cn(
          'no-scrollbar -mx-1 flex flex-1 gap-3 overflow-x-auto px-1 pb-1',
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
                'flex min-w-[172px] flex-1 flex-col rounded-xl p-2 transition-colors',
                overStage === stage.id ? 'bg-brand-50 ring-1 ring-brand-200 ring-inset' : 'bg-zinc-100/70',
              )}
            >
              <div className="flex items-center justify-between px-1.5 pt-0.5 pb-2">
                <div className="flex items-center gap-1.5">
                  {isWon ? (
                    <Trophy className="size-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn('size-1.5 rounded-full', isLost ? 'bg-red-400' : 'bg-zinc-400')}
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-xs font-medium text-zinc-800">{stage.name}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">{count}</span>
                </div>
                <span className="text-right">
                  <span className="block font-mono text-[11px] text-zinc-500 tabular-nums">{total}</span>
                  {stage.subtitle && (
                    <span className="block font-mono text-[10px] text-zinc-400 tabular-nums">{stage.subtitle}</span>
                  )}
                </span>
              </div>

              <div className={cn('flex flex-1 flex-col gap-2', compact ? 'min-h-[180px]' : 'min-h-[260px]')}>
                {items.map((deal) => {
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
                      aria-label={`${deal.company}, ${deal.title}, ${formatINRCompact(deal.value)}, owner ${deal.owner}`}
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
                        'group rounded-lg bg-white p-2.5 text-left shadow-card ring-1 ring-zinc-200/80 transition-[box-shadow,opacity,transform] hover:shadow-float hover:ring-zinc-300 focus-visible:outline-2 focus-visible:outline-brand-500',
                        canMove ? 'cursor-grab active:cursor-grabbing' : onOpen ? 'cursor-pointer' : '',
                        dragId === deal.id && 'opacity-40',
                        isWon && 'ring-emerald-200',
                        isLost && 'opacity-75',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[13px] font-medium text-zinc-900">{deal.company}</p>
                        <GripVertical
                          className="size-3.5 shrink-0 text-zinc-300 group-hover:text-zinc-400"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{deal.title}</p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">
                          {formatINRCompact(deal.value)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {stale && !isWon && !isLost && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200/70">
                              <Clock className="size-2.5" aria-hidden="true" />
                              {deal.days}d idle
                            </span>
                          )}
                          <Avatar name={deal.owner} size="xs" />
                        </div>
                      </div>
                      {canMove && onOpen && (
                        <select
                          aria-label={`Move ${deal.title} to stage`}
                          value={deal.stageId}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => onMove(deal.id, e.target.value)}
                          className="mt-3 h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-600"
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
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
                    {canMove ? 'Drop a deal here' : 'No deals'}
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
