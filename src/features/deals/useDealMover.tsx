import { useState } from 'react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { ApiError } from '../../services/http'
import { useToast } from '../../components/ui/Toast'
import type { DealRecord, PipelineStage } from '../crm/types'
import { moveDeal, type MoveInput } from './api'
import { MoveDealDialog } from './MoveDealDialog'

/** Required fields `stage` will ask for that `deal` lacks — mirrors missingFor() in deal.service.js. */
export function missingFor(stage: PipelineStage, deal: DealRecord): string[] {
  const required = new Set([...stage.requiredFields, ...(stage.type === 'won' ? ['valueMinor'] : [])])
  const missing: string[] = []
  for (const f of required) {
    if (f === 'valueMinor' && !(deal.valueMinor > 0)) missing.push(f)
    else if (f === 'contacts' && !deal.contacts.length) missing.push(f)
    else if (f === 'expectedCloseDate' && !deal.expectedCloseDate) missing.push(f)
    else if (f === 'companyId' && !deal.companyId) missing.push(f)
    else if (f === 'ownerId' && !deal.ownerId) missing.push(f)
    else if (f.startsWith('cf.')) {
      const v = deal.customFields[f.slice(3)]
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) missing.push(f)
    }
  }
  return missing
}

interface Pending {
  deal: DealRecord
  stage: PipelineStage
  missing: string[]
}

/**
 * Moving a deal from the board, the stage stepper or the Won/Lost buttons. Lost always asks for a
 * reason; Won and stages with required fields open a mini-form when something's missing; a 422 from
 * the server (rules changed meanwhile) opens it too.
 *
 * `onOptimistic` applies the move locally and returns a rollback; `onSettled` refetches.
 */
export function useDealMover({
  onOptimistic,
  onSettled,
  onMoved,
}: {
  onOptimistic?: (deal: DealRecord, stage: PipelineStage) => () => void
  onSettled?: () => Promise<unknown> | void
  onMoved?: (deal: DealRecord, stage: PipelineStage) => void
} = {}) {
  const notify = useToast()
  const [pending, setPending] = useState<Pending | null>(null)

  async function send(deal: DealRecord, stage: PipelineStage, input: MoveInput) {
    const rollback = onOptimistic?.(deal, stage)
    try {
      const moved = await moveDeal(deal.id, input, deal.updatedAt)
      if (stage.type === 'won') notify({ title: '🎉 Deal won', description: `${deal.title} — nice work!` })
      onMoved?.(moved, stage)
      return moved
    } catch (err) {
      rollback?.()
      if (err instanceof ApiError && err.code === 'STAGE_REQUIREMENTS') {
        setPending({ deal, stage, missing: (err.details?.missing as string[]) ?? [] })
        return null
      }
      if (err instanceof ApiError && (err.code === 'STAGE_NOT_FOUND' || err.status === 404)) notify({ tone: 'error', title: 'That stage changed', description: 'We’ve refreshed the board.' })
      else if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t move the deal', description: err instanceof ApiError ? err.message : undefined })
      throw err
    } finally {
      await onSettled?.()
    }
  }

  async function move(deal: DealRecord, stage: PipelineStage) {
    if (stage.id === deal.stageId) return
    const missing = missingFor(stage, deal)
    if (stage.type === 'lost' || missing.length) {
      setPending({ deal, stage, missing })
      return
    }
    await send(deal, stage, { stageId: stage.id }).catch(() => {})
  }

  const dialog = pending ? (
    <MoveDealDialog
      deal={pending.deal}
      stage={pending.stage}
      missing={pending.missing}
      onClose={() => setPending(null)}
      onSubmit={async (input) => {
        const p = pending
        setPending(null)
        await send(p.deal, p.stage, input)
      }}
    />
  ) : null

  return { move, dialog }
}
