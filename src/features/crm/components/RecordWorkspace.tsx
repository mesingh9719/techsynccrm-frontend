import { useId, useRef, useState, type ReactNode } from 'react'
import { Activity, Files, ListChecks, NotebookPen, SquareKanban } from 'lucide-react'
import { useCan } from '../../../lib/useOrg'
import { cn } from '../../../lib/cn'
import { Timeline } from '../../activities/Timeline'
import { RecordTasks } from '../../tasks/RecordTasks'
import { Attachments } from '../../files/Attachments'
import type { RecordType } from '../types'

/** A stable workspace: switching tabs keeps unfinished notes and task forms mounted. */
export function RecordWorkspace({ entityType, entityId, name, canPin, deals, allowTasks = true, overview }: {
  entityType: RecordType; entityId: string; name: string; canPin: boolean
  deals?: ReactNode; allowTasks?: boolean; overview?: ReactNode
}) {
  const id = useId()
  const [active, setActive] = useState('activity')
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const canTasks = useCan('tasks.read')
  const canDeals = useCan('deals.read')
  const tabs = [
    { key: 'activity', label: 'Activity', icon: Activity, body: <>{overview}<Timeline entityType={entityType} entityId={entityId} recordName={name} canPin={canPin} /></> },
    { key: 'notes', label: 'Notes', icon: NotebookPen, body: <Timeline notesOnly entityType={entityType} entityId={entityId} recordName={name} canPin={canPin} /> },
    ...(canTasks && allowTasks ? [{ key: 'tasks', label: 'Tasks', icon: ListChecks, body: <RecordTasks entityType={entityType} entityId={entityId} recordName={name} /> }] : []),
    ...(deals && canDeals ? [{ key: 'deals', label: 'Deals', icon: SquareKanban, body: deals }] : []),
    { key: 'files', label: 'Files', icon: Files, body: <Attachments entityType={entityType} entityId={entityId} /> },
  ]
  return <section className="min-w-0 space-y-4" aria-label={`${name} workspace`}>
    <div role="tablist" aria-label="Record sections" className="flex gap-1 overflow-x-auto rounded-card border border-line bg-surface p-2 shadow-card">
      {tabs.map((tab, index) => <button key={tab.key} ref={(element) => { refs.current[index] = element }} type="button" role="tab" id={`${id}-${tab.key}-tab`} aria-controls={`${id}-${tab.key}-panel`} aria-selected={active === tab.key} tabIndex={active === tab.key ? 0 : -1}
        onClick={() => setActive(tab.key)} onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
          setActive(tabs[next].key); refs.current[next]?.focus()
        }} className={cn('inline-flex min-h-10 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-medium transition-colors', active === tab.key ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-surface-subtle hover:text-ink')}>
        <tab.icon className="size-4" aria-hidden="true" />{tab.label}
      </button>)}
    </div>
    {tabs.map((tab) => <div key={tab.key} id={`${id}-${tab.key}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab.key}-tab`} hidden={active !== tab.key} tabIndex={0} className="min-w-0 space-y-4 rounded-control">{tab.body}</div>)}
  </section>
}
