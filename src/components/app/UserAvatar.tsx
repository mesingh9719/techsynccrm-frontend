import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../ui/Badge'

const sizes = { xs: 'size-5', sm: 'size-8', md: 'size-10', lg: 'size-16' } as const

/** Profile photo when there is one (and it loads), otherwise the initials avatar. */
export function UserAvatar({ name, url, size = 'sm', className }: { name: string; url?: string | null; size?: keyof typeof sizes; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!url || failed === url) return <Avatar name={name} size={size} className={className} />
  return <img src={url} alt="" onError={() => setFailed(url)} className={cn('shrink-0 rounded-full object-cover ring-1 ring-line', sizes[size], className)} />
}
