import { Button } from '../ui/Button'
import { UserPicker } from './UserPicker'
import { useAuth } from '../../lib/useAuth'

export function OwnerFilter({value,onChange,allowUnassigned=true}:{value?:string;onChange:(value:string|undefined)=>void;allowUnassigned?:boolean}) {
  const {user} = useAuth()
  return <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Owner filter">
    <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)} aria-pressed={!value}>All visible</Button>
    <Button type="button" size="sm" variant="ghost" onClick={() => onChange('me')} aria-pressed={value==='me'}>Me</Button>
    {allowUnassigned && <Button type="button" size="sm" variant="ghost" onClick={() => onChange('none')} aria-pressed={value==='none'}>Unassigned</Button>}
    <UserPicker value={value==='me'?user?.id || null:value && value!=='none'?value:null} onChange={id => onChange(id || undefined)} placeholder="Find a teammate…" />
  </div>
}
