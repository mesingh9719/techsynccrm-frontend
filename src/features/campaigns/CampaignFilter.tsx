import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { CampaignPicker } from './CampaignPicker'
import { getCampaign } from './api'

/** Searches the server rather than offering only the first page of campaigns. */
export function CampaignFilter({value,onChange}:{value?:string;onChange:(value:string|undefined)=>void}) {
  const [open,setOpen] = useState(false), orgId = useOrgId(), canView = useCan('campaigns.view')
  const selected = useQuery({queryKey:['org',orgId,'campaign-filter',value],queryFn:() => getCampaign(orgId,value!),enabled:Boolean(value) && canView})
  return <div className="flex items-center gap-1">
    <Button type="button" variant="secondary" size="sm" aria-label="Filter by campaign" onClick={() => setOpen(true)}>{selected.data?.name || (value?'Selected campaign':'All campaigns')}</Button>
    {value && <Button type="button" variant="ghost" size="sm" aria-label="Clear campaign filter" onClick={() => onChange(undefined)}>Clear</Button>}
    {open && <CampaignPicker open onClose={() => setOpen(false)} currentCampaignId={value} currentCampaignName={selected.data?.name} onSelect={async campaign => onChange(campaign?.id)} />}
  </div>
}
