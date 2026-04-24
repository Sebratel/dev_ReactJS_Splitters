import { createHttpClient } from '@/shared/api/httpClient'
import { env, isLocalDevHostname } from '@/shared/config/env'
import { useSessionStore } from '@/features/session/store/sessionStore'
import type { HubSessionPayload } from '@/features/session/model/hubSession.types'

const hubAuthClient = createHttpClient({
  baseUrl: isLocalDevHostname() ? env.localBffUrl : env.hubOrigin,
  getToken: () => useSessionStore.getState().sessionToken,
})

export async function fetchHubSessionProfile(): Promise<HubSessionPayload> {
  const path = isLocalDevHostname()
    ? '/api/hub/session'
    : env.hubSessionEndpoint
      ? env.hubSessionEndpoint.replace(env.hubOrigin, '')
      : '/auth/session'

  return hubAuthClient.request<HubSessionPayload>({
    path,
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })
}
