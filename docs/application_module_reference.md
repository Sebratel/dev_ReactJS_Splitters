# Referencia de Modulos da Aplicacao

Este documento descreve o que cada parte relevante faz hoje.

Nao e uma lista de todos os arquivos do repositorio. O foco e explicar responsabilidades, pontos de entrada e dependencias reais da aplicacao.

## 1. `src/app`

### `src/app/App.tsx`

Raiz do app React.

Responsavel por montar a aplicacao dentro dos providers e do router.

### `src/app/router.tsx`

Mapa oficial de navegacao.

Se alguem quer descobrir "qual componente abre em cada URL", este e o arquivo certo.

### `src/app/providers/AppProviders.tsx`

Providers globais.

Hoje centraliza:

- TanStack Query
- `GoogleSessionBridge` quando OIDC nao esta ativo

### `src/app/layouts/RootLayout.tsx`

Layout principal:

- sidebar
- tratamento visual de loading global
- tratamento visual de erro global
- outlet das rotas protegidas

### `src/app/auth/*`

Camada de autenticacao e protecao de rotas.

Principais responsabilidades:

- barrar acesso sem sessao
- integrar OIDC
- transportar access token para chamadas quando necessario

## 2. `src/pages`

Wrappers finos de rota.

Responsabilidade:

- conectar URL a uma `feature`
- evitar concentrar regra de negocio aqui

Arquivos principais:

- `HomePage.tsx`
- `SplittersPage.tsx`
- `SplitterDetailPage.tsx`
- `ClienteDetailPage.tsx`
- `MassivaPage.tsx`
- `NetworkIntelligencePage.tsx`
- `OidcCallbackPage.tsx`

## 3. `src/features/splitters`

Modulo mais importante da aplicacao.

### O que ele faz

- lista splitters
- aplica filtros e busca
- calcula criticidade operacional
- mostra detalhe completo do splitter
- conecta dados de ocupacao, clientes, OLT, GeoGrid, massiva e tendencia

### Subpastas

#### `api/`

Responsavel por chamadas remotas relacionadas a splitters.

Exemplos:

- listagem
- detalhe por codigo
- vizinhos
- conexoes
- filtros
- dados do GeoGrid
- tendencias locais
- estatisticas locais de massiva

#### `hooks/`

Orquestram as telas:

- `useSplittersList`
- `useSplitterDetail`
- `useSplitterClientes`
- `useSplitterGeoGrid`
- `useSplitterMassivaStatsFromLocalDb`
- `useSplitterTrendsFromLocalDb`

#### `lib/`

Regra pura:

- score operacional
- filtros da lista
- indices e agregacoes
- formatacao operacional
- calculos geograficos

#### `ui/`

Componentes visuais:

- `SplitterCard`
- `SplittersList`
- `SplitterDetailScreen`
- `SplitterDetailSummary`
- secoes de OLT, clientes, mapa, endereco e GeoGrid

#### `model/`

Tipos, enums e query keys da feature.

### Arquivos mais importantes

- `src/pages/SplittersPage.tsx`
- `src/features/splitters/ui/SplitterCard.tsx`
- `src/features/splitters/ui/SplitterDetailScreen.tsx`
- `src/features/splitters/ui/SplitterDetailSummary.tsx`
- `src/features/splitters/lib/buildSplitterOperationalScore.ts`

## 4. `src/features/massiva`

Modulo de operacao guiada de massivas.

### O que ele faz

- lista tickets
- cruza splitters e rotas
- calcula clientes afetados
- valida condicoes de abertura
- monta payload de abertura
- registra historico local
- ajuda no encerramento

### Subpastas

#### `api/`

Integra com BFF e backend local para:

- listar massivas
- abrir/fechar
- registrar historico
- consultar contagens de afetados
- buscar rotas

#### `hooks/`

Coordenam:

- tickets
- readiness
- preview local
- mutacao de abertura

#### `lib/`

Regra de negocio mais sensivel do modulo:

- montagem de payload
- selecao efetiva de splitters
- validacoes
- transformacoes de preview
- descricao tecnica

#### `store/`

Estado local do rascunho e selecao de preview.

#### `ui/`

Tela e paineis do fluxo guiado.

Arquivos de referencia:

- `MassivaScreen.tsx`
- `MassivaPage.tsx`
- `MassivaStepper.tsx`
- `StepSplitters.tsx`
- `StepRota.tsx`
- `StepValidacao.tsx`
- `StepAbertura.tsx`

## 5. `src/features/clientes`

Modulo de detalhe do cliente.

### O que ele faz

- carrega um cliente pelo `authenticationId`
- mostra dados cadastrais
- mostra endereco e contrato
- mostra ponto de acesso e solicitacoes
- oferece navegao de volta ao splitter

### Arquivos mais importantes

- `ui/ClienteDetailScreen.tsx`
- `hooks/useClienteDetail.ts`
- `hooks/useClienteSolicitations.ts`
- `api/fetchClienteDetailFromLocalDb.ts`
- `api/fetchClienteSolicitations.ts`

## 6. `src/features/intelligence`

Modulo analitico.

### O que ele faz

- agrega trends por periodo
- cruza ocupacao e historico de massiva
- produz dataset para charts
- produz mapa de saturacao

### Arquivos mais importantes

- `hooks/useNetworkIntelligenceData.ts`
- `ui/IntelligenceSaturationMap.tsx`

## 7. `src/features/dashboard`

Modulo do dashboard inicial.

### O que ele faz

- KPIs gerais
- leitura de `networkStats`
- monitoramento da conectividade dos dados

### Arquivos mais importantes

- `hooks/useNetworkStats.ts`
- `ui/DashboardConnectionMonitor.tsx`

## 8. `src/features/session`

Modulo de sessao.

### O que ele faz

- bootstrap de usuario
- token do Google
- parse de parametros de URL
- store de sessao

### Arquivos mais importantes

- `store/sessionStore.ts`
- `ui/GoogleSessionBridge.tsx`
- `ui/SessionGate.tsx`
- `lib/googleIdentity.ts`
- `lib/googleToken.ts`
- `api/fetchHubSessionProfile.ts`

## 9. `src/features/autoisp`

Modulo auxiliar de eventos e correlacao.

### O que ele faz

- autentica no AutoISP
- consulta eventos
- correlaciona eventos com topologia/contexto

### Arquivos mais importantes

- `api/authAutoIsp.ts`
- `api/fetchAutoIspEvents.ts`
- `hooks/useAutoIspEvents.ts`
- `hooks/useAutoIspCorrelation.ts`

## 10. `src/shared`

Camada compartilhada.

### `shared/api`

Clientes HTTP e chamadas comuns.

- `bffClient.ts`
- `httpClient.ts`
- `fetchNetworkStats.ts`

### `shared/config`

Configuracao central.

- `env.ts`
- `i18n.ts`

### `shared/lib`

Funcoes genericas:

- formatacao de erro
- storage
- utilitarios de classe e tipo

### `shared/ui`

Componentes base e estados padrao:

- `LoadingState`
- `ErrorState`
- `EmptyState`
- `StatCard`

## 11. `server`

BFF local em Node.js/Express.

### `server/index.js`

Arquivo central do backend local.

Hoje ele:

- sobe o Express
- conecta no PostgreSQL
- conecta no store local de historico em MySQL
- expõe endpoints auxiliares para o frontend
- faz proxy do GeoGrid e do Hub
- gera snapshots e tendencias

### `server/massivaHistoryStore.js`

Encapsula o historico local de massivas.

### `server/scripts/ensureMassivaHistory.js`

Script de suporte para garantir a estrutura do historico local.

## 12. Como as partes se conectam

### Exemplo: lista de splitters

1. `src/pages/SplittersPage.tsx`
2. `useSplittersList`
3. `fetchSplittersFromLocalDb` ou fluxo equivalente
4. endpoint `/api/splitters`
5. PostgreSQL no BFF local

### Exemplo: detalhe do splitter

1. `SplitterDetailPage.tsx`
2. `useSplitterDetail`
3. hooks auxiliares de clientes, OLT, GeoGrid, massiva e trends
4. varios endpoints `/api/splitters*`, `/api/geogrid*`, `/api/massiva/history*`

### Exemplo: abertura de massiva

1. `MassivaScreen` / `MassivaPage`
2. stores e hooks do draft
3. `buildMassivaOpenRequestBody`
4. chamada ao endpoint configurado em `VITE_MASSIVA_OPEN_PATH`
5. registro local posterior no backend local

## 13. Convencoes de manutencao

- se a mudanca afeta rota, revise `router.tsx`
- se afeta contrato, revise `api/` e docs
- se afeta regra pura, preferir `lib/`
- se afeta composicao de tela, preferir `ui/`
- se afeta estado compartilhado, avaliar `store/`

## 14. O que a equipe nao deve assumir

- que todo dado vem de uma unica fonte
- que GeoGrid sempre vem do mesmo fluxo do Flutter antigo
- que massiva depende apenas do BFF remoto
- que `server/index.js` e trivial; ele e parte critica da aplicacao local
