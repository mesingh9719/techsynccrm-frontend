import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { finishFacebookSdkLogin, prepareFacebookSdkLogin, type FacebookSdkConfiguration } from './api'
import {
  loadFacebookSdk,
  facebookLoginStatus,
  type FacebookLoginResponse,
  type FacebookLoginStatus,
  type FacebookSdk,
} from './sdk'

export function FacebookSdkLogin({
  orgId,
  config,
  connected,
  onConnected,
}: {
  orgId: string
  config: FacebookSdkConfiguration
  connected: boolean
  onConnected: () => Promise<void>
}) {
  const [sdk, setSdk] = useState<FacebookSdk | null>(null)
  const [status, setStatus] = useState<FacebookLoginStatus | 'checking'>('checking')
  const [loadError, setLoadError] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const generation = useRef(0),
    popupTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const current = ++generation.current
    void loadFacebookSdk({
      appId: config.appId,
      version: config.version,
      configId: config.configId,
      scope: config.scope,
    })
      .then(async (instance) => {
        if (generation.current !== current) return
        setSdk(instance)
        const result = await facebookLoginStatus(instance)
        if (generation.current === current) setStatus(result)
      })
      .catch((err: unknown) => {
        if (generation.current === current)
          setLoadError(err instanceof Error ? err.message : 'Facebook SDK is unavailable.')
      })
    // The popup timer is created after this effect; cleanup intentionally reads the latest value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      generation.current++
      window.clearTimeout(popupTimer.current)
    }
  }, [config.appId, config.version, config.configId, config.scope])
  const challenge = useQuery({
    queryKey: ['org', orgId, 'facebook', 'sdk-challenge'],
    queryFn: prepareFacebookSdkLogin,
    enabled: Boolean(sdk),
    retry: false,
    gcTime: 0,
    staleTime: 5 * 60000,
    refetchInterval: 9 * 60000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  function connect() {
    if (!sdk || busy) return
    if (!challenge.data || Date.now() - challenge.dataUpdatedAt > 9 * 60000) {
      setError('Preparing a fresh login challenge. Click Connect again when ready.')
      void challenge.refetch()
      return
    }
    const current = generation.current,
      nonce = challenge.data.nonce
    let handled = false
    setBusy(true)
    setError('')
    popupTimer.current = window.setTimeout(() => {
      if (generation.current !== current || handled) return
      generation.current++
      setBusy(false)
      setError('The Facebook dialog did not finish. Try again or use redirect login.')
      void challenge.refetch()
    }, 120000)
    const complete = async (response: FacebookLoginResponse) => {
      if (generation.current !== current || handled) return
      handled = true
      window.clearTimeout(popupTimer.current)
      const auth = response.authResponse
      if (!auth?.accessToken || !auth.userID || !auth.signedRequest) {
        setBusy(false)
        setError(
          auth
            ? 'Your Meta login configuration must issue User access tokens. Check it or use redirect login.'
            : 'Facebook login was cancelled or not authorized.',
        )
        if (response.status) setStatus(response.status)
        return
      }
      try {
        await finishFacebookSdkLogin({
          nonce,
          accessToken: auth.accessToken,
          userId: auth.userID,
          signedRequest: auth.signedRequest,
        })
        if (generation.current !== current) return
        setStatus('connected')
        await onConnected()
      } catch (err) {
        if (generation.current === current)
          setError(err instanceof Error ? err.message : 'Facebook connection could not be verified.')
      } finally {
        if (generation.current === current) {
          setBusy(false)
          void challenge.refetch()
        }
      }
    }
    // FB.login must run synchronously within this click to preserve the browser's popup gesture.
    try {
      sdk.login(
        (response) => {
          void complete(response)
        },
        config.configId
          ? { config_id: config.configId }
          : { scope: config.scope, auth_type: 'rerequest', return_scopes: true },
      )
    } catch {
      window.clearTimeout(popupTimer.current)
      setBusy(false)
      setError('Facebook could not open its dialog. Use redirect login or allow popups.')
    }
  }
  const statusText =
    status === 'connected'
      ? 'Facebook session available. Connect explicitly to grant this workspace access.'
      : status === 'not_authorized'
        ? 'Your Facebook session has not authorized this app.'
        : status === 'unknown'
          ? 'Facebook login status is unknown. Use Connect to sign in.'
          : 'Checking Facebook login status…'
  return (
    <div className="space-y-2">
      <Button disabled={!sdk || !challenge.data || challenge.isFetching || busy} loading={busy} onClick={connect}>
        {connected ? 'Reconnect with Facebook' : 'Connect with Facebook'}
      </Button>
      <p role="status" className="max-w-md text-xs text-zinc-600">
        {loadError || statusText}
      </p>
      {(error || challenge.isError) && (
        <p role="alert" className="max-w-md text-sm text-red-700">
          {error || challenge.error?.message}
          {challenge.isError && (
            <button className="ml-2 underline" onClick={() => void challenge.refetch()}>
              Prepare login again
            </button>
          )}
        </p>
      )}
    </div>
  )
}
