import { FlaskConical } from 'lucide-react'

export function PreviewNotice({
  children = 'Explore this feature with sample data. Changes stay in this browser; live capture is not enabled.',
}: {
  children?: React.ReactNode
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <FlaskConical className="mt-1 size-4 shrink-0" />
      <div>
        <span className="font-semibold">Preview mode. </span>
        {children}
      </div>
    </div>
  )
}
