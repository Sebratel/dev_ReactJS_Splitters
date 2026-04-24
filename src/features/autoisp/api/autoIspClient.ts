import { createHttpClient } from '@/shared/api/httpClient'
import { env } from '@/shared/config/env'
import { useAutoIspStore } from '@/features/autoisp/store/autoIspStore'

/**
 * Cliente HTTP para o serviço AutoISP.
 * Como o AutoISP usa um endpoint que pode ser absoluto (fora do BFF),
 * o baseUrl é extraído do endpoint de eventos configurado.
 */
export const autoIspClient = createHttpClient({
  baseUrl: env.autoIspEventsEndpoint.includes('://')
    ? new URL(env.autoIspEventsEndpoint).origin
    : '', 
  getToken: () => useAutoIspStore.getState().token,
})
