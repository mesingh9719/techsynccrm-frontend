import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const load = async (name) => import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(fs.readFileSync(new URL('../src/features/deals/' + name, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText).toString('base64'))
const { projectDealMove } = await load('projectDealMove.ts')

test('optimistic moves preserve exact half-even totals and never duplicate a loaded card', () => {
  const a = { id: 'a', type: 'open', probability: 10 }, b = { id: 'b', type: 'open', probability: 50 }, won = { id: 'won', type: 'won', probability: 100 }
  const deal = { id: 'd', stageId: 'a', status: 'open', valueMinor: 1051, weightedMinor: 105, probabilityOverride: null, stage: a }
  const board = { stages: [{ ...a, count: 1, totalMinor: 1051, weightedMinor: 105, deals: [deal] }, { ...b, count: 0, totalMinor: 0, weightedMinor: 0, deals: [] }, { ...won, count: 0, totalMinor: 0, weightedMinor: 0, deals: [] }] }
  const moved = projectDealMove(board, deal, b, '2026-10-25T00:00:00Z')
  assert.equal(moved.stages[0].count, 0)
  assert.equal(moved.stages[0].weightedMinor, 0)
  assert.equal(moved.stages[1].weightedMinor, 526)
  assert.equal(moved.stages[1].deals[0].status, 'open')
  assert.equal(moved.stages[1].deals[0].lastActivityAt, '2026-10-25T00:00:00Z')
  const closed = projectDealMove(moved, moved.stages[1].deals[0], won)
  assert.equal(closed.stages[1].weightedMinor, 0)
  assert.equal(closed.stages[2].weightedMinor, 0)
  assert.equal(closed.stages[2].deals[0].status, 'won')
  assert.equal(closed.stages.flatMap(s => s.deals).length, 1)
  assert.equal(board.stages[0].deals.length, 1)
  assert.equal(projectDealMove(board, deal, a), board)
  const even = projectDealMove(board, { ...deal, valueMinor: 1049 }, b)
  assert.equal(even.stages[1].weightedMinor, 524)
})
