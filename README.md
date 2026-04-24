# NexaView Web

Aplicacao web operacional para monitoramento de rede, analise de splitters, operacao de massivas e consulta de clientes.

Este repositorio contem duas partes:

- frontend React/Vite em `src/`
- BFF local Node.js em `server/`

O objetivo do projeto e dar contexto operacional rapido para a equipe: ocupacao, risco, geografia, clientes afetados, historico de massivas e dados auxiliares de rede.

## O que a aplicacao entrega

- dashboard inicial com KPIs e monitoramento de conectividade
- listagem de splitters com filtros, ordenacao e priorizacao operacional
- detalhe do splitter com ocupacao, distribuicao de portas, GeoGrid, OLT, clientes e contexto de massivas
- operacao guiada de massivas com preview, validacoes e integracoes auxiliares
- detalhe de cliente com dados cadastrais, contratuais, acesso e solicitacoes
- painel de inteligencia da rede com tendencias, recorrencia e mapa de saturacao

## Stack

- React 19
- TypeScript
- Vite
- TanStack Query
- Zustand
- React Router
- Tailwind CSS
- Vitest + Testing Library
- Node.js + Express no BFF local
- PostgreSQL e MySQL no backend local

## Estrutura principal

```text
src/
  app/                bootstrap da aplicacao, router, auth e layouts
  pages/              entrypoints de rota
  features/           modulos de negocio por dominio
  shared/             infraestrutura compartilhada
  domain/             tipos/schemas de dominio transversal
  test/               setup de testes

server/
  index.js            BFF local e endpoints SQL/proxy
  massivaHistoryStore.js
  scripts/

docs/
  notebooklm_team_reference.md
  application_module_reference.md
  abertura_massivas_roadmap.md
```

## Fluxo de alto nivel

1. O usuario autentica pela estrategia configurada no ambiente.
2. O frontend consulta o BFF local ou o BFF remoto conforme o tipo de dado.
3. O BFF local agrega consultas em PostgreSQL, historico local em MySQL e proxies auxiliares.
4. As features montam modelos de tela a partir de `hooks`, `api`, `lib` e `ui`.
5. A UI exibe cards operacionais, detalhes e acoes de suporte.

## Modulos principais

### `splitters`

Modulo central da aplicacao.

- lista com filtros por busca, status, OLT, AP, rua, cidade, condominio e massiva
- calculo de score operacional por splitter
- detalhe do splitter com ocupacao, distribuicao de portas, GeoGrid, OLT, clientes e historico associado
- consultas auxiliares como vizinhos, conexoes, tendencias e massiva local

### `massiva`

Modulo de operacao assistida para massivas.

- listagem e leitura de tickets
- fluxo guiado de abertura
- preview local de clientes/rotas
- validacoes antes de abrir
- registro local de historico aberto/encerrado
- apoio de AutoISP quando configurado

### `clientes`

Consulta detalhada de um cliente a partir do `authenticationId`.

- dados cadastrais
- endereco
- contrato
- ponto de acesso
- solicitacoes
- link de volta para o splitter relacionado

### `intelligence`

Painel analitico da rede.

- tendencias por periodo
- distribuicao de risco/saturacao
- historico agregado de massivas
- recorrencia por dia e turno
- mapa de saturacao por splitter

### `dashboard`

Visao inicial da operacao.

- KPIs gerais
- status de conectividade dos dados
- ultimas ocorrencias de massiva

### `session` e `auth`

Responsavel por sessao e protecao de rota.

- Google Identity fallback no browser
- OIDC quando configurado
- bridge de token para chamadas protegidas
- store de sessao e bootstrap do usuario

## Como rodar localmente

### Pre-requisitos

- Node.js 18+
- npm
- acesso aos ambientes necessarios para BFF, PostgreSQL, MySQL, GeoGrid e afins quando aplicavel

### Instalar dependencias

```bash
npm install
npm --prefix server install
```

### Rodar frontend + backend local

```bash
npm run dev
```

Isso sobe:

- frontend Vite
- backend local em `server/index.js`

### Rodar apenas o frontend

```bash
npm run dev:frontend
```

### Rodar apenas o backend local

```bash
npm run dev:backend
```

## Scripts disponiveis

```bash
npm run dev
npm run dev:frontend
npm run dev:backend
npm run build
npm run lint
npm run test
npm run test:coverage
```

Observacao: no ambiente atual de manutencao, a suite Vitest pode depender de permissao local de execucao do processo. Se houver falha de ambiente, valide pelo menos `lint` e `build` antes de subir alteracoes.

## Variaveis de ambiente

### Frontend

Arquivo base: `.env.example`

Use `.env.local` para sobrescrever valores locais sem versionar segredos.

Grupos mais importantes:

- autenticacao: `VITE_GOOGLE_CLIENT_ID`, `VITE_OIDC_*`
- BFF: `VITE_BFF_BASE_URL`, `VITE_HUB_SESSION_ENDPOINT`
- GeoGrid: `VITE_GEOGRID_BASE_URL`, `VITE_GEOGRID_API_KEY`
- massiva: `VITE_MASSIVA_*`
- AutoISP: `VITE_AUTOISP_*`
- utilitarios locais: `VITE_LOCAL_BFF_URL`, `VITE_DEV_SESSION_TOKEN`

### Backend local

O `server/index.js` le:

- `server/.env`
- `../.env.local`

Grupos mais importantes:

- PostgreSQL principal: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`
- historico local de massivas em MySQL: `MASSIVA_MYSQL_*`
- GeoGrid: `GEOGRID_BASE_URL`, `GEOGRID_API_KEY`
- Hub: `HUB_BASE_URL`

Nao versione segredos reais.

## Documentacao da equipe

Para estudo e manutencao, comece por estes arquivos:

1. `architecture.md`
2. `docs/application_module_reference.md`
3. `docs/notebooklm_team_reference.md`
4. `docs/abertura_massivas_roadmap.md`

## Boas praticas de manutencao neste repositorio

- preserve a separacao por `feature`
- use `pages` apenas como entrypoint de rota
- concentre chamadas remotas em `api/`
- concentre orquestracao em `hooks/`
- concentre regra pura em `lib/`
- mantenha `ui/` focado em composicao visual
- evite espalhar logica de negocio em componentes visuais
- para integracoes, rastreie o fluxo completo: tela -> hook -> api -> env -> endpoint

## Estado atual da documentacao

Os documentos principais foram atualizados para refletir a base React/BFF atual.
Se a equipe alterar arquitetura, rotas, estrategia de auth ou contratos do BFF, estes arquivos precisam ser revisados junto com o codigo.
