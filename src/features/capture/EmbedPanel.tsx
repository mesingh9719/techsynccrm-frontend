import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState, Skeleton } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { captureKeys, captureLive, makeCaptureApi } from './api'
import type { WebForm } from './types'

/** Embed snippets and the hosted link — the builder's "Embed & share" tab and the forms list's share dialog. */
export function EmbedPanel({ form, scope }: { form: WebForm; scope: string }) {
  const service = makeCaptureApi(scope)
  const query = useQuery({
    queryKey: [...captureKeys(scope), 'embed', form.id],
    queryFn: () => service.embedCode(form.id),
    enabled: captureLive,
  })
  const hosted = new URL(`/f/${form.key}`, window.location.origin).href
  const examples = query.data ?? {
    script: `<script src="${window.location.origin}/embed.js" data-form="${form.key}"></script>`,
    iframe: `<iframe src="${hosted}?embed=1" title="Enquiry form" width="100%" height="720" style="border:0"></iframe>`,
    hostedUrl: hosted,
  }
  return (
    <div className="space-y-5">
      {captureLive && !form.isActive && (
        <PreviewNotice>
          This form is a draft. The link and code work only after you publish it from the form editor.
        </PreviewNotice>
      )}
      {!captureLive && (
        <PreviewNotice>
          These snippets show the publishing format. They will accept enquiries only after the live capture API is
          enabled.
        </PreviewNotice>
      )}
      {query.isPending && captureLive ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          {[
            {
              label: 'Recommended · website script',
              value: examples.script,
              help: 'Paste before the closing body tag. The form resizes automatically.',
            },
            {
              label: 'Iframe embed',
              value: examples.iframe,
              help: 'Use this when your website builder supports embedded HTML.',
            },
            {
              label: 'Hosted form link',
              value: examples.hostedUrl,
              help: 'Share a standalone form with your customers.',
            },
          ].map((snippet) => (
            <div key={snippet.label}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-ink">{snippet.label}</h3>
                <CopyButton text={snippet.value} />
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-surface-subtle p-4 text-xs leading-6 text-ink">
                <code>{snippet.value}</code>
              </pre>
              <p className="mt-2 text-xs text-muted">{snippet.help}</p>
            </div>
          ))}
        </>
      )}
      {captureLive && (
        <Button variant="secondary" href={hosted} target="_blank" rel="noreferrer">
          Open hosted form
          <ExternalLink className="size-4" />
        </Button>
      )}
    </div>
  )
}
