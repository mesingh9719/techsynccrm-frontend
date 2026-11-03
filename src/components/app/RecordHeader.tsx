import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * The shared header card for a single record (lead, deal, contact, company, campaign): avatar or
 * icon, title with its status, a subtitle line, a row of facts and tags, actions on the right, and
 * an optional footer strip (stage tracker, prompts). Use it instead of a hand-built record header.
 */
export function RecordHeader({ media, title, titleHint, status, subtitle, facts, actions, children, className }: {
  /** 48px avatar, initials or icon tile. */
  media?: ReactNode
  title: ReactNode
  /** Full title as a tooltip when it is truncated. */
  titleHint?: string
  /** Status badge shown beside the title. */
  status?: ReactNode
  subtitle?: ReactNode
  /** Badges, tags and key facts under the subtitle. */
  facts?: ReactNode
  actions?: ReactNode
  /** Full-width strip under the header body, e.g. a stage tracker. */
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('record-header', className)}>
      <div className="record-header-main">
        <div className="record-header-identity">
          {media && <div className="record-header-media">{media}</div>}
          <div className="min-w-0">
            <div className="record-header-title-row">
              <h1 className="record-header-title" title={titleHint}>{title}</h1>
              {status}
            </div>
            {subtitle && <p className="record-header-subtitle">{subtitle}</p>}
            {facts && <div className="record-header-facts">{facts}</div>}
          </div>
        </div>
        {actions && <div className="record-header-actions">{actions}</div>}
      </div>
      {children && <div className="record-header-footer">{children}</div>}
    </header>
  )
}

/** Brand icon tile for records without a photo or initials (deals). */
export function RecordIcon({ children }: { children: ReactNode }) {
  return <span className="record-header-icon" aria-hidden="true">{children}</span>
}
