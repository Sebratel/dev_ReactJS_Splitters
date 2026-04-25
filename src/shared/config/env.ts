/**
 * Configuração centralizada (somente variáveis públicas VITE_*).
 * Valores padrão espelham o uso atual no app Flutter onde aplicável.
 */

function str(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const t = value.trim()
  return t.length > 0 ? t : fallback
}

/**
 * Base do BFF usada em `bffClient`.
 * Em `npm run dev`, se `VITE_BFF_BASE_URL` estiver vazio, usa URL relativa (`/api/...`) no mesmo
 * origin do Vite — o `server.proxy` em `vite.config.ts` encaminha ao gateway e evita CORS.
 * Se precisar apontar direto ao HTTPS do BFF no browser, defina `VITE_BFF_BASE_URL` (aí o
 * backend precisa liberar CORS para o origin do app).
 */
function bffBaseUrlResolved(): string {
  const fromEnv = str(import.meta.env.VITE_BFF_BASE_URL, '')
  if (fromEnv !== '') return fromEnv

  // Fallback para desenvolvimento (proxy local /api)
  if (import.meta.env.DEV) return ''

  // Em produção, se VITE_BFF_BASE_URL não foi definida, tenta VITE_LOCAL_BFF_URL
  const localEnv = str(import.meta.env.VITE_LOCAL_BFF_URL, '')
  if (localEnv !== '') return localEnv

  // Caso as variáveis não estejam definidas em PROD, retornamos vazio para forçar path relativo
  // O Vite Preview ou Nginx fará o proxy para o backend apropriado.
  return ''
}

/**
 * Path do POST de abertura no BFF. Em `vite` dev, se `VITE_MASSIVA_OPEN_PATH` estiver vazio,
 * em dev usa salvar-massiva-via-api se a variável estiver vazia.
 * Build de produção exige variável (ou o deploy define).
 */
function massivaOpenPathResolved(): string {
  const fromEnv = str(import.meta.env.VITE_MASSIVA_OPEN_PATH, '')
  if (fromEnv !== '') return fromEnv
  if (import.meta.env.DEV) return '/api/v1/massivas/salvar-massiva-via-api'
  return ''
}

/** Em dev, espelha `.env.example` quando a variável não está definida (paridade com `massivaOpenPath`). */
function massivaClosePathResolved(): string {
  const fromEnv = str(import.meta.env.VITE_MASSIVA_CLOSE_PATH, '')
  if (fromEnv !== '') return fromEnv
  if (import.meta.env.DEV) return '/api/v1/massivas/finalizar-chamado-via-api'
  return ''
}

/** POST de registro de afetados após abertura (`usuarioAfetadoEntities` + `assignmentId`). */
function massivaAfetadosPathResolved(): string {
  const fromEnv = str(import.meta.env.VITE_MASSIVA_AFETADOS_PATH, '')
  if (fromEnv !== '') return fromEnv
  if (import.meta.env.DEV) return '/api/v1/afetados'
  return ''
}

/** GET listagem de massivas — em dev assume path do BFF se a variável estiver vazia. */
function massivaListPathResolved(): string {
  const fromEnv = str(import.meta.env.VITE_MASSIVA_LIST_PATH, '')
  if (fromEnv !== '') return fromEnv
  if (import.meta.env.DEV) return '/api/v1/massivas/recuperar-pelo-banco'
  return ''
}

/**
 * URL do BFF operacional usado por consultas SQL/auxiliares.
 * Em dev: localhost:3001 por padrao.
 * Em staging/prod: cai para o mesmo host base do BFF remoto para evitar
 * build apontando para localhost no navegador dos usuarios.
 */
function localBffUrlResolved(): string {
  const fromEnv = str(import.meta.env.VITE_LOCAL_BFF_URL, '')
  if (fromEnv !== '') return fromEnv

  if (import.meta.env.DEV) return 'http://localhost:3001'
  return bffBaseUrlResolved()
}

export const env = {
  hubOrigin: str(
    import.meta.env.VITE_HUB_ORIGIN,
    'https://sebratel-hub.web.app',
  ),
  bffBaseUrl: bffBaseUrlResolved(),
  /** Endpoint opcional de perfil do Hub (paridade com HUB_SESSION_ENDPOINT no Flutter). */
  hubSessionEndpoint: str(import.meta.env.VITE_HUB_SESSION_ENDPOINT, ''),
  /** Client ID web para solicitar o Google ID token no browser. */
  googleClientId: str(import.meta.env.VITE_GOOGLE_CLIENT_ID, ''),
  /** Redirect URI fixa do OAuth Google, usada para evitar mismatch entre localhost/127.0.0.1/portas. */
  googleRedirectUri: str(import.meta.env.VITE_GOOGLE_REDIRECT_URI, ''),
  /**
   * Reverse geocode (paridade `REVERSE_GEOCODE_ENDPOINT` no Flutter).
   * Recomendado no web para evitar CORS ao Nominatim; se vazio, tenta Nominatim direto.
   */
  reverseGeocodeEndpoint: str(
    import.meta.env.VITE_REVERSE_GEOCODE_ENDPOINT,
    '',
  ),
  devSessionToken: str(import.meta.env.VITE_DEV_SESSION_TOKEN, ''),
  /**
   * GeoGrid API (paridade `GEOGRID_BASE_URL` / `GEOGRID_API_KEY` no Flutter — `main.dart`).
   * Chamadas diretas com header `api-key`; não passam pelo BFF.
   */
  geogridBaseUrl: str(
    import.meta.env.VITE_GEOGRID_BASE_URL,
    'https://eros.geogridmaps.com.br/sebratel/api/v3',
  ),
  geogridApiKey: str(import.meta.env.VITE_GEOGRID_API_KEY, ''),
  /**
   * GET no BFF — listagem de massivas (paridade `MASSIVA_API_GATEWAY_LIST_ENDPOINT` no Flutter,
   * mas sempre como path relativo ao `bffBaseUrl`). Ex.: `/api/v1/massivas/recuperar-pelo-banco`
   */
  massivaListPath: massivaListPathResolved(),
  /** POST de abertura de massiva no BFF (paridade `MASSIVA_API_GATEWAY_ENDPOINT` no Flutter, como path). */
  massivaOpenPath: massivaOpenPathResolved(),
  /** DELETE para encerramento de massiva no BFF (paridade `finalizar-chamado-via-api`). */
  massivaClosePath: massivaClosePathResolved(),
  /** POST de afetados no BFF (segunda etapa após abertura). */
  massivaAfetadosPath: massivaAfetadosPathResolved(),
  /**
   * Corpo do DELETE `finalizar-chamado-via-api`: o BFF espera os mesmos campos da integração Elleven
   * (strings), não só assignmentId + description.
   */
  massivaCloseIncidentStatusId: str(
    import.meta.env.VITE_MASSIVA_CLOSE_INCIDENT_STATUS_ID,
    '4',
  ),
  massivaCloseProgress: str(import.meta.env.VITE_MASSIVA_CLOSE_PROGRESS, '0'),
  massivaClosePriority: str(import.meta.env.VITE_MASSIVA_CLOSE_PRIORITY, '35'),
  massivaCloseNotificationTarget: str(
    import.meta.env.VITE_MASSIVA_CLOSE_NOTIFICATION_TARGET,
    '0',
  ),
  massivaClosePrivateReport: str(
    import.meta.env.VITE_MASSIVA_CLOSE_PRIVATE_REPORT,
    'true',
  ),
  /** Base da API de afetados para limpeza pós-encerramento (`.../protocol/{id}`). */
  massivaAffectedUsersPath: str(import.meta.env.VITE_MASSIVA_AFFECTED_USERS_PATH, ''),
  /** Endpoint de autenticação do AutoISP (paridade `AUTOISP_AUTH_ENDPOINT` no Flutter). */
  autoIspAuthEndpoint: str(import.meta.env.VITE_AUTOISP_AUTH_ENDPOINT, ''),
  /** Endpoint de listagem de eventos do AutoISP (paridade `AUTOISP_EVENTS_ENDPOINT` no Flutter). */
  autoIspEventsEndpoint: str(import.meta.env.VITE_AUTOISP_EVENTS_ENDPOINT, ''),
  /** Credenciais de serviço do AutoISP (paridade `AUTOISP_USERNAME` / `AUTOISP_PASSWORD`). */
  autoIspUsername: str(import.meta.env.VITE_AUTOISP_USERNAME, ''),
  autoIspPassword: str(import.meta.env.VITE_AUTOISP_PASSWORD, ''),
  /** BFF operacional para queries SQL/auxiliares (local no dev, remoto em staging/prod). */
  localBffUrl: localBffUrlResolved(),
  /**
   * OpenID Connect (react-oidc-context / oidc-client-ts). Quando authority e client_id
   * estão preenchidos, o app exige login OIDC e envia `access_token` no Bearer do BFF.
   */
  oidcAuthority: str(import.meta.env.VITE_OIDC_AUTHORITY, ''),
  oidcClientId: str(import.meta.env.VITE_OIDC_CLIENT_ID, ''),
  /** Path absoluto no mesmo origin do app (ex. /callback). */
  oidcRedirectPath: str(import.meta.env.VITE_OIDC_REDIRECT_PATH, '/callback'),
  oidcScope: str(import.meta.env.VITE_OIDC_SCOPE, 'openid profile email'),
  /** Opcional; se vazio, usa `window.location.origin` em runtime. */
  oidcPostLogoutRedirectUri: str(import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI, ''),
} as const


export type Env = typeof env

export function isOidcConfigured(): boolean {
  return env.oidcAuthority.trim() !== '' && env.oidcClientId.trim() !== ''
}

/** AutoISP só é consultado no browser quando as quatro variáveis estão definidas. */
export function isAutoIspConfigured(): boolean {
  return (
    env.autoIspAuthEndpoint.trim() !== '' &&
    env.autoIspEventsEndpoint.trim() !== '' &&
    env.autoIspUsername.trim() !== '' &&
    env.autoIspPassword.trim() !== ''
  )
}

export function isGoogleIdentityConfigured(): boolean {
  const clientId = env.googleClientId.trim()
  if (clientId === '') return false
  if (clientId === 'seu_client_id_web_do_google.apps.googleusercontent.com') {
    return false
  }
  return clientId.includes('.apps.googleusercontent.com')
}

/**
 * URLs absolutas (`https://...`) ou prefixo `/__autoisp/...` (proxy do Vite em dev — evita CORS).
 */
export function isAutoIspBrowserReady(): boolean {
  if (!isAutoIspConfigured()) return false
  const auth = env.autoIspAuthEndpoint.trim()
  const ev = env.autoIspEventsEndpoint.trim()
  const authOk = auth.includes('://') || auth.startsWith('/__autoisp')
  const evOk = ev.includes('://') || ev.startsWith('/__autoisp')
  return authOk && evOk
}

/**
 * Espelha a heurística de ambiente local do Flutter (main.dart).
 */
export function isLocalDevHostname(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h.endsWith('.trycloudflare.com') ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.')
  )
}
