import type { Board, DealRecord, PipelineStage } from '../crm/types'

/** Match the server's per-deal half-even rounding, including half-cent values. */
function weighted(value: number, probability: number) {
  const product = BigInt(value) * BigInt(probability)
  const whole = product / 100n, remainder = product % 100n
  return Number(whole + (remainder > 50n || (remainder === 50n && whole % 2n !== 0n) ? 1n : 0n))
}

export function projectDealMove(board: Board, deal: DealRecord, stage: PipelineStage, now = new Date().toISOString()): Board {
  if (deal.stageId === stage.id) return board
  const probability = stage.type === 'won' ? 100 : stage.type === 'lost' ? 0 : deal.probabilityOverride ?? stage.probability
  const moved = { ...deal, stageId: stage.id, stage, status: stage.type, probability, weightedMinor: weighted(deal.valueMinor, probability), daysInStage: 0, isRotting: false, stageEnteredAt: now, lastActivityAt: now, closedAt: stage.type === 'open' ? null : now }
  return { ...board, stages: board.stages.map(column => {
    if (column.id === deal.stageId) return { ...column, count: Math.max(0, column.count - 1), totalMinor: column.totalMinor - deal.valueMinor, weightedMinor: column.weightedMinor - (column.type === 'open' ? deal.weightedMinor : 0), deals: column.deals.filter(row => row.id !== deal.id) }
    if (column.id === stage.id) return { ...column, count: column.count + 1, totalMinor: column.totalMinor + deal.valueMinor, weightedMinor: column.weightedMinor + (column.type === 'open' ? moved.weightedMinor : 0), deals: [moved, ...column.deals.filter(row => row.id !== deal.id)] }
    return column
  }) }
}
