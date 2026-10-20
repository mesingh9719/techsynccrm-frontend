import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ErrorState, Skeleton } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { captureLive, getPublicForm, recordFormView, submitPublicForm } from './api'
import { FormRenderer } from './FormRenderer'
import { useSeo } from '../../lib/useSeo'

export default function PublicFormPage() {
  const { key = '' } = useParams(),
    viewed = useRef(false)
  useSeo({ title: 'Enquiry form', noindex: true })
  const query = useQuery({
    queryKey: ['public-form', key],
    queryFn: () => getPublicForm(key),
    enabled: captureLive && /^[a-zA-Z0-9_-]{22}$/.test(key),
    retry: false,
    staleTime: 60_000,
    meta: { skipGlobalErrorHandler: true },
  })
  useEffect(() => {
    if (query.data && !viewed.current) {
      viewed.current = true
      void recordFormView(key).catch(() => {})
    }
  }, [query.data, key])
  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        {!captureLive ? (
          <PreviewNotice>
            Public forms are not accepting live enquiries yet. Contact this business directly, or ask its admin to
            enable the capture service.
          </PreviewNotice>
        ) : !/^[a-zA-Z0-9_-]{22}$/.test(key) ? (
          <ErrorState error={new Error('Invalid form address')} />
        ) : query.isPending ? (
          <Skeleton className="h-[560px] rounded-2xl" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data.isActive ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            This form is currently closed. Please contact the business directly.
          </p>
        ) : (
          <FormRenderer form={query.data} onSubmit={(values) => submitPublicForm(key, values)} />
        )}
      </div>
    </main>
  )
}
