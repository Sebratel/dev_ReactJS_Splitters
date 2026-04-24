import { SPLITTERS_CONNECTIONS_STALE_TIME_MS } from '@/features/splitters/model/constants'

/** Mesmo TTL que a lista global de conexões (paridade Hive / serviço no Flutter). */
export const CLIENTE_DETAIL_CONNECTIONS_STALE_TIME_MS =
  SPLITTERS_CONNECTIONS_STALE_TIME_MS

/** Lista de solicitações por cliente: sem cache longo no Flutter (Future por tela); 1 min no web. */
export const CLIENTE_SOLICITATIONS_STALE_TIME_MS = 60_000
