# NexaView Web - Arquitetura Atual

## Objetivo

Descrever como a aplicacao esta organizada hoje para manutencao, onboarding e evolucao segura.

Este documento substitui referencias antigas da base Flutter. O repositorio atual e React no frontend com um BFF local em Node.js.

## Visao geral

O sistema foi dividido em duas camadas principais:

- `frontend`: experiencia operacional, regras de tela, filtros, visualizacoes e chamadas de integracao
- `server`: BFF local para consultas SQL, historico local e proxies auxiliares

## Camadas do frontend

### `src/app`

Infraestrutura da aplicacao.

- `App.tsx`: composicao principal
- `router.tsx`: declaracao das rotas
- `providers/AppProviders.tsx`: TanStack Query e bridges globais
- `layouts/`: layout raiz e sidebar
- `auth/`: protecao de rota, OIDC e token bridge

Regra: nada de negocio pesado aqui. `app` orquestra, nao implementa regra operacional.

### `src/pages`

Entrypoints de rota.

Cada arquivo de `pages/` deve apenas conectar a rota a um modulo de feature.

Rotas atuais:

- `/` -> `HomePage`
- `/splitters` -> `SplittersPage`
- `/splitters/:code` -> `SplitterDetailPage`
- `/clientes/:id` -> `ClienteDetailPage`
- `/massiva` -> `MassivaPage`
- `/intelligence` -> `NetworkIntelligencePage`
- `/callback` -> `OidcCallbackPage`

### `src/features`

Nucleo do negocio. Cada feature tenta manter esta estrutura:

- `api/`: chamadas HTTP e adaptadores de endpoint
- `hooks/`: orquestracao de queries e estado de tela
- `lib/`: funcoes puras e regras reutilizaveis
- `model/`: tipos e chaves da feature
- `store/`: Zustand local quando necessario
- `ui/`: componentes especificos da feature

### `src/shared`

Infraestrutura compartilhada por todo o app.

- `api/`: clientes HTTP, erros e chamadas transversais
- `config/`: leitura de ambiente, i18n e configuracoes globais
- `lib/`: utils, formatadores, storage, guards
- `store/`: UI global
- `ui/`: componentes reutilizaveis e estados padrao

### `src/domain`

Tipos/schemas transversais que nao pertencem a uma feature unica.

No estado atual, o modulo principal aqui e `user`.

## Modulos funcionais

### 1. Dashboard

Arquivos centrais:

- `src/pages/HomePage.tsx`
- `src/features/dashboard/hooks/useNetworkStats.ts`
- `src/features/dashboard/ui/DashboardConnectionMonitor.tsx`

Responsabilidade:

- mostrar KPIs operacionais da rede
- exibir resumo de ocorrencias
- monitorar conectividade e tempo de atualizacao dos dados

### 2. Splitters

Arquivos centrais:

- `src/pages/SplittersPage.tsx`
- `src/features/splitters/hooks/useSplittersList.ts`
- `src/features/splitters/ui/SplittersList.tsx`
- `src/features/splitters/ui/SplitterDetailScreen.tsx`
- `src/features/splitters/ui/SplitterDetailSummary.tsx`
- `src/features/splitters/lib/buildSplitterOperationalScore.ts`

Responsabilidade:

- listar splitters com filtros e busca
- ordenar por risco, ocupacao ou codigo
- calcular score operacional
- exibir detalhe do splitter com contexto tecnico e operacional
- integrar clientes, OLT, GeoGrid, conexoes, vizinhos, massivas e tendencias

### 3. Massiva

Arquivos centrais:

- `src/pages/MassivaPage.tsx`
- `src/features/massiva/ui/MassivaScreen.tsx`
- `src/features/massiva/ui/MassivaPage.tsx`
- `src/features/massiva/hooks/useMassivaTickets.ts`
- `src/features/massiva/hooks/useMassivaOpenMutation.ts`
- `src/features/massiva/lib/buildMassivaOpenRequestBody.ts`

Responsabilidade:

- listar tickets de massiva
- preparar abertura com validacoes
- montar payload para o BFF
- registrar historico local
- apoiar o operador com preview e correlacao

### 4. Clientes

Arquivos centrais:

- `src/pages/ClienteDetailPage.tsx`
- `src/features/clientes/ui/ClienteDetailScreen.tsx`
- `src/features/clientes/hooks/useClienteDetail.ts`
- `src/features/clientes/hooks/useClienteSolicitations.ts`

Responsabilidade:

- mostrar detalhes de um assinante
- ligar cliente ao splitter e ao ponto de acesso
- listar solicitacoes

### 5. Intelligence

Arquivos centrais:

- `src/pages/NetworkIntelligencePage.tsx`
- `src/features/intelligence/hooks/useNetworkIntelligenceData.ts`
- `src/features/intelligence/ui/IntelligenceSaturationMap.tsx`

Responsabilidade:

- cruzar tendencias com massivas
- agregar saturacao por periodo
- mostrar recorrencia operacional
- exibir mapa de saturacao por splitter

### 6. Session/Auth

Arquivos centrais:

- `src/app/auth/ProtectedRoute.tsx`
- `src/app/auth/ProtectedAppLayout.tsx`
- `src/app/auth/OidcAccessTokenBridge.tsx`
- `src/features/session/ui/GoogleSessionBridge.tsx`
- `src/features/session/store/sessionStore.ts`

Responsabilidade:

- proteger area logada
- decidir entre OIDC e Google Identity
- obter e renovar token
- montar sessao do usuario

## Estrategia de autenticacao

Existem dois caminhos principais:

### OIDC

Ativado quando `VITE_OIDC_AUTHORITY` e `VITE_OIDC_CLIENT_ID` estao preenchidos.

Nesse modo:

- a aplicacao exige login OIDC
- o callback e `/callback`
- o access token pode ser usado como Bearer nas chamadas protegidas

### Google Identity

Usado como fallback quando OIDC nao esta configurado e `VITE_GOOGLE_CLIENT_ID` existe.

Nesse modo:

- `GoogleSessionBridge` inicia o fluxo no browser
- a store de sessao recebe o token e metadados
- o app tenta refresh silencioso quando necessario

## Estrategia de dados

### No frontend

Padrao esperado:

1. componente de pagina chama um `hook`
2. `hook` usa TanStack Query ou store
3. `api` resolve endpoint e contrato
4. `lib` aplica regra pura ou transformacao
5. `ui` renderiza o resultado

### No backend local

`server/index.js` acumula responsabilidades que hoje estao centralizadas no BFF local:

- consultas em PostgreSQL para splitters, clientes, OLTs e indicadores
- historico local de massivas em MySQL
- proxy para GeoGrid
- proxy para Hub
- endpoints auxiliares de snapshot e tendencia

## Integracoes externas

### BFF principal / gateway

Usado para:

- listagens e mutacoes de massiva
- sessao do Hub
- parte das consultas de rede, dependendo do ambiente

### PostgreSQL

Fonte principal para:

- splitters
- portas
- clientes
- OLTs
- estatisticas operacionais
- snapshots e tendencias locais

### MySQL (`DB_Massives`)

Fonte local para:

- historico de abertura/encerramento de massivas
- estatisticas por splitter
- codigos com massiva aberta

### GeoGrid

Usado para:

- portas de equipamento
- clientes e atendimentos
- comparacao de dados operacionais por porta

### AutoISP

Usado quando configurado para:

- autenticacao
- leitura de eventos
- apoio ao fluxo de massiva

## Rotas e familias de endpoint do BFF local

Principais grupos em `server/index.js`:

- `/api/health`, `/api/stats`
- `/api/hub/session`
- `/api/olts`
- `/api/splitters`
- `/api/splitters/filter-options`
- `/api/splitters/access-points`
- `/api/splitters/trends`
- `/api/splitters/:code/neighbors`
- `/api/splitters-by-code`
- `/api/splitters/:code/connections`
- `/api/clientes/:id`
- `/api/geogrid/...`
- `/api/massiva/routes`
- `/api/massiva/connections`
- `/api/massiva/history/...`
- `/api/splitters/snapshots/capture`
- `/api/dashboard/kpi-daily-snapshot`

## Responsabilidade dos arquivos mais importantes

### Frontend

- `src/app/router.tsx`: roteamento principal
- `src/shared/config/env.ts`: resolucao central de variaveis de ambiente
- `src/shared/api/bffClient.ts`: cliente para chamadas do BFF
- `src/pages/SplittersPage.tsx`: tela mais importante do fluxo operacional
- `src/features/splitters/ui/SplitterDetailSummary.tsx`: resumo executivo do detalhe do splitter
- `src/features/massiva/ui/MassivaPage.tsx`: fluxo visual central de massivas

### Backend

- `server/index.js`: concentrador do BFF local
- `server/massivaHistoryStore.js`: persistencia local de historico de massivas
- `server/scripts/ensureMassivaHistory.js`: bootstrap/garantia da estrutura de historico

## Decisoes arquiteturais importantes

1. `pages` sao finas; a regra mora nas `features`.
2. Integracoes nao devem ficar espalhadas em componentes visuais.
3. Score operacional e agregacoes devem ficar em `lib`.
4. BFF local pode complementar ou substituir fontes remotas dependendo do ambiente.
5. O detalhe do splitter e o ponto de convergencia da maior parte das integracoes.

## Riscos e pontos de atencao

- `server/index.js` esta grande e centraliza muitas responsabilidades; qualquer evolucao maior deve considerar modularizacao por dominio.
- a cobertura automatizada existe no frontend, mas precisa de ambiente local funcional para rodar Vitest.
- a documentacao precisa ser atualizada sempre que houver mudanca de contrato, auth ou estrutura de feature.

## Por onde comecar para manutencao

1. Leia `README.md`.
2. Leia `docs/application_module_reference.md`.
3. Se a tarefa for operacional, comece por `splitters`.
4. Se a tarefa for abertura/encerramento, siga por `massiva`.
5. Se a tarefa for integracao/dados, confira `src/shared/config/env.ts` e `server/index.js`.
