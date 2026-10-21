import { useState } from 'react'
import { Megaphone, Check } from 'lucide-react'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ErrorState } from '../../components/app/States'
import { FormAlert } from '../../components/ui/Form'
import { useCampaigns } from './useCampaigns'
import type { Campaign } from './types'

export function CampaignPicker({
  open,
  currentCampaignCode,
  currentCampaignName,
  onClose,
  onSelect,
}: {
  open: boolean
  currentCampaignCode?: string
  currentCampaignName?: string
  onClose: () => void
  onSelect: (campaign: Campaign | null) => Promise<unknown>
}) {
  const query = useCampaigns()
  const { data: campaigns = [], isPending } = query
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeCampaigns = campaigns.filter((c) => c.status !== 'archived')

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      if (selectedId === 'none') {
        await onSelect(null)
      } else {
        const found = campaigns.find((c) => c.id === selectedId)
        if (found) await onSelect(found)
      }
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update campaign attribution')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Associate with Campaign"
      description="Link this lead to a tracked marketing campaign for accurate channel attribution and ROI reporting."
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={busy} disabled={!selectedId}>
            Apply attribution
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <FormAlert>{error}</FormAlert>}
        {isPending ? (
          <p className="py-6 text-center text-sm text-muted">Loading campaigns…</p>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setSelectedId('none')}
              className={`flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-surface-subtle ${
                selectedId === 'none' ? 'bg-brand-50/50 ' : ''
              }`}
            >
              <div>
                <p className="text-sm font-medium text-ink">No campaign (Remove attribution)</p>
                <p className="text-xs text-muted">Clear campaign link while keeping original source</p>
              </div>
              {selectedId === 'none' && <Check className="size-4 text-brand-700" />}
            </button>

            {activeCampaigns.map((camp) => {
              const isCurrent =
                (currentCampaignCode && camp.code === currentCampaignCode) ||
                (currentCampaignName && camp.name === currentCampaignName)
              const isSelected = selectedId === camp.id || (!selectedId && isCurrent)

              return (
                <button
                  key={camp.id}
                  type="button"
                  onClick={() => setSelectedId(camp.id)}
                  className={`flex w-full items-start justify-between p-3 text-left transition-colors hover:bg-surface-subtle ${
                    isSelected ? 'bg-brand-50/50 ' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <Megaphone className="size-4 text-muted shrink-0" />
                      <p className="truncate text-sm font-medium text-ink">{camp.name}</p>
                      {camp.status === 'active' && <Badge tone="success">Active</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted">
                      utm_campaign: {camp.code}
                      {camp.utm.utm_source && ` · source: ${camp.utm.utm_source}`}
                    </p>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0 text-brand-700 mt-1" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Dialog>
  )
}
