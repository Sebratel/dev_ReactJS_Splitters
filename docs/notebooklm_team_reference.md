# Guia de Estudo da Equipe

Este arquivo existe para acelerar onboarding, handoff e manutencao.

Se alguem novo entrar no projeto, este e o caminho mais seguro para entender a aplicacao sem precisar abrir arquivos aleatorios.

## Ordem recomendada de estudo

1. `README.md`
2. `docs/gestao-permissoes-usuarios.md` (se o foco for **TI / gestão de acessos**)
3. `architecture.md`
4. `src/app/router.tsx`
5. `src/shared/config/env.ts`
6. `src/pages/`
7. `src/features/splitters/`
8. `src/features/massiva/`
9. `server/index.js`

## O que a aplicacao faz em linguagem de produto

O sistema ajuda a operacao a responder perguntas como:

- quais splitters merecem prioridade agora
- como esta a ocupacao e a distribuicao das portas
- qual o contexto de massivas abertas ou historicas
- quais clientes estao ligados a um splitter
- qual a tendencia de saturacao da rede
- como abrir ou acompanhar uma massiva com menos erro operacional

## Como pensar a estrutura do projeto

### `src/app`

Infraestrutura do app:

- roteamento
- layout global
- protecao de rotas
- bridges de autenticacao
- providers

### `src/pages`

Portas de entrada da navegacao.

Se a equipe quiser descobrir "qual feature alimenta esta rota", comecar por aqui e o caminho mais curto.

### `src/features`

Regra de negocio organizada por dominio.

Padrao esperado:

- `api/` chama endpoints
- `hooks/` coordena dados e estado
- `lib/` guarda regra pura
- `model/` declara tipos e chaves
- `store/` guarda estado local/global quando necessario
- `ui/` monta a tela

### `src/shared`

Infraestrutura reutilizavel:

- cliente HTTP
- utils
- estados de carregamento/erro/vazio
- config
- assets e i18n

### `server`

BFF local para desenvolvimento e operacao local.

Ele faz o trabalho pesado de:

- consultar PostgreSQL
- consultar historico em MySQL
- expor endpoints auxiliares para o frontend
- servir como proxy para integracoes que nao devem ser tratadas diretamente na UI

## Arquivos que todo mantenedor deve conhecer

### Entrada e configuracao

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/router.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/shared/config/env.ts`

### Gestao de permissoes e usuarios (operacao TI)

- `docs/gestao-permissoes-usuarios.md` — **guia principal**: presets (Analista de rede, Operador massivas, Leitura, Admin), pedidos de acesso, aprovacao, `/usuarios`
- `docs/firestore-access-control.md` — formato do documento `splitters_users` e regras Firestore sugeridas

### Sessao e autenticacao

- `src/app/auth/ProtectedRoute.tsx`
- `src/features/session/store/sessionStore.ts`
- `src/features/session/ui/GoogleSessionBridge.tsx`
- `src/app/auth/OidcAccessTokenBridge.tsx`

### Splitters

- `src/pages/SplittersPage.tsx`
- `src/features/splitters/hooks/useSplittersList.ts`
- `src/features/splitters/ui/SplitterCard.tsx`
- `src/features/splitters/ui/SplitterDetailScreen.tsx`
- `src/features/splitters/ui/SplitterDetailSummary.tsx`
- `src/features/splitters/lib/buildSplitterOperationalScore.ts`

### Massiva

- `src/features/massiva/ui/MassivaScreen.tsx`
- `src/features/massiva/ui/MassivaPage.tsx`
- `src/features/massiva/hooks/useMassivaTickets.ts`
- `src/features/massiva/hooks/useMassivaOpenMutation.ts`
- `src/features/massiva/lib/buildMassivaOpenRequestBody.ts`
- `src/features/massiva/lib/validateMassivaOpenDraft.ts`

### Clientes

- `src/features/clientes/ui/ClienteDetailScreen.tsx`
- `src/features/clientes/hooks/useClienteDetail.ts`
- `src/features/clientes/hooks/useClienteSolicitations.ts`

### Inteligencia e dashboard

- `src/pages/HomePage.tsx`
- `src/pages/NetworkIntelligencePage.tsx`
- `src/features/dashboard/hooks/useNetworkStats.ts`
- `src/features/intelligence/hooks/useNetworkIntelligenceData.ts`

### Backend local

- `server/index.js`
- `server/massivaHistoryStore.js`
- `server/scripts/ensureMassivaHistory.js`

## Como debugar uma feature sem se perder

### Quando a falha esta na tela

Comece por:

1. componente em `ui/`
2. hook usado pela tela
3. chamada em `api/`
4. variavel de ambiente em `src/shared/config/env.ts`
5. endpoint no `server/index.js` ou no BFF remoto

### Quando a falha parece ser de dado

Comece por:

1. payload retornado pelo endpoint
2. transformacoes em `lib/`
3. tipos/modelos
4. query key e cache

### Quando a falha parece ser de autenticacao

Comece por:

1. `ProtectedRoute`
2. `sessionStore`
3. `GoogleSessionBridge` ou OIDC
4. Bearer enviado pelo cliente HTTP

## Regras praticas para novas alteracoes

- nao coloque regra de negocio em `pages`
- nao consulte endpoint diretamente dentro de componente visual se a mesma chamada puder morar em `api/` + `hook`
- nao misture estado de formulario, transformacao e renderizacao no mesmo arquivo sem necessidade
- preserve compatibilidade com os contratos atuais antes de propor refatoracao estrutural
- quando mudar integracao, atualize a documentacao na mesma entrega

## Como estudar por contexto

### Quero entender listagem e detalhe de splitters

Leia nesta ordem:

1. `src/pages/SplittersPage.tsx`
2. `src/features/splitters/hooks/`
3. `src/features/splitters/ui/`
4. `src/features/splitters/lib/buildSplitterOperationalScore.ts`
5. endpoints `/api/splitters*` no `server/index.js`

### Quero entender abertura de massiva

Leia nesta ordem:

1. `src/features/massiva/ui/MassivaScreen.tsx`
2. `src/features/massiva/ui/MassivaPage.tsx`
3. `src/features/massiva/hooks/useMassivaOpenMutation.ts`
4. `src/features/massiva/lib/buildMassivaOpenRequestBody.ts`
5. `src/features/massiva/lib/validateMassivaOpenDraft.ts`
6. endpoints `/api/massiva*` e `/api/massiva/history*`

### Quero entender cliente

Leia nesta ordem:

1. `src/features/clientes/ui/ClienteDetailScreen.tsx`
2. `src/features/clientes/hooks/useClienteDetail.ts`
3. `src/features/clientes/api/`
4. endpoint `/api/clientes/:id`

### Quero entender inteligencia da rede

Leia nesta ordem:

1. `src/pages/NetworkIntelligencePage.tsx`
2. `src/features/intelligence/hooks/useNetworkIntelligenceData.ts`
3. `src/shared/api/fetchNetworkStats.ts`
4. endpoints de stats, snapshots e trends no backend local

## O que revisar antes de subir alteracoes

- se a rota continua funcionando
- se a integracao usa o endpoint correto
- se o contrato do payload continua o mesmo
- se `lint` e `build` passam
- se a documentacao foi afetada pela mudanca

## Quando atualizar este guia

Atualize este arquivo quando houver mudanca em qualquer um destes pontos:

- nova rota principal
- mudanca em presets / permissoes / fluxo de pedidos de acesso (manter em paralelo `docs/gestao-permissoes-usuarios.md`)
- troca de estrategia de auth
- novo modulo em `features`
- mudanca de responsabilidade do BFF local
- alteracao grande em massiva, splitters ou intelligence
