# Observabilidade — Elastic APM

Instrumentação do NexaView (Splitters) para o Elastic APM Server 8.15.0 do stack `elk`
(Portainer), visível em `https://kibana.sebratel.net.br` → **Observability → APM**.

**Tudo fica desligado por omissão.** Nenhum dos três agentes arranca sem a respetiva variável
de ambiente, e o comportamento do app sem essas variáveis é exatamente o de antes.

## Os três serviços

| Serviço no APM | Onde corre | Pacote | Liga com |
|---|---|---|---|
| `splitters-bff` | `server/index.js` (backend Node/Express) | `elastic-apm-node` | `ELASTIC_APM_SERVER_URL` |
| `splitters-frontend-server` | `frontend-server.mjs` (serve o SPA e faz proxy) | `elastic-apm-node` | `ELASTIC_APM_SERVER_URL` |
| `splitters-web` | browser do utilizador (RUM) | `@elastic/apm-rum` | `VITE_APM_SERVER_URL` |

Cada um tem `serviceName` próprio para aparecerem separados no Kibana.

## Como cada agente arranca

### BFF (`server/`)

O agente tem de estar de pé antes de qualquer `import`. Como o `index.js` é ESM, isso é feito
por preload: [server/apm.cjs](../server/apm.cjs), carregado com `-r` no script `start`/`dev` do
[server/package.json](../server/package.json) e no `CMD` do [server/Dockerfile](../server/Dockerfile).

O preload também lê `.env`/`.env.local` (mesma ordem do `index.js`), porque em dev o dotenv do
`index.js` só corre bem depois.

### Servidor do SPA (`frontend-server.mjs`)

[frontend-server.apm.mjs](../frontend-server.apm.mjs) é o **primeiro import** do
`frontend-server.mjs` — o ESM avalia os módulos pela ordem em que são declarados, por isso o
agente arranca antes de `node:http`.

Detalhe importante: o agente instrumenta os módulos ao vê-los passar por `require`, e um
`import` de builtin em ESM não passa por lá. Por isso o bootstrap faz `require('node:http')`
(e `https`) logo a seguir a arrancar — sem isso o servidor não geraria transação nenhuma.
Como é um servidor `http` puro, usa `usePathAsTransactionName` para as transações não
aparecerem todas agrupadas como "unknown route".

Na imagem Docker o pacote é instalado à parte no stage `runner` do
[Dockerfile.frontend](../Dockerfile.frontend). Se essa instalação falhar, o servidor arranca à
mesma sem APM (o bootstrap tolera a ausência do pacote).

### Browser (RUM)

[src/shared/lib/apmRum.ts](../src/shared/lib/apmRum.ts), chamado no
[src/main.tsx](../src/main.tsx) antes do render. O `import()` é dinâmico e fica atrás do guard
`isApmRumConfigured()`: sem `VITE_APM_SERVER_URL`, o chunk do agente (~66 kB / 22 kB gzip) é
gerado mas **nunca descarregado** pelo browser — o carregamento da página não muda.

`distributedTracingOrigins` fica no padrão (só o mesmo origin), o que dá tracing ligado entre
browser → servidor do SPA → BFF sem CORS extra em lado nenhum.

Mas "same origin" inclui as rotas que o `frontend-server.mjs` encaminha para fora: `/api/v1/*`
(gateway ERP/Elleven) e `/__autoisp/*`. Esses upstreams são integrações de terceiros que já
funcionam, e não ganham nada com cabeçalhos novos — por isso o proxy remove `traceparent` /
`tracestate` nesses dois caminhos (`stripTracing`) e mantém-nos só a caminho do BFF.

## Variáveis

Backend (BFF e servidor do SPA — mesmas chaves, `SERVICE_NAME` diferente por container):

```env
ELASTIC_APM_SERVER_URL=http://apm-server:8200
ELASTIC_APM_SERVICE_NAME=splitters-bff
ELASTIC_APM_ENVIRONMENT=production
```

Frontend (build do Vite; entram como build args no `Dockerfile.frontend`):

```env
VITE_APM_SERVER_URL=https://apm.sebratel.net.br
VITE_APM_SERVICE_NAME=splitters-web
VITE_APM_SERVICE_VERSION=
VITE_APM_ENVIRONMENT=production
```

O [docker-compose.portainer.yml](../docker-compose.portainer.yml) já traz estes valores como
padrão, por isso **não é preciso definir nada no painel Environment** da stack para ligar o APM.
Defina lá apenas para sobrepor (ou `ELASTIC_APM_SERVER_URL=` / `VITE_APM_SERVER_URL=` vazio para
desligar um dos agentes).

Qualquer `ELASTIC_APM_*` suportada pelo agente tem precedência sobre os padrões do código
(ex.: `ELASTIC_APM_TRANSACTION_SAMPLE_RATE`, `ELASTIC_APM_LOG_LEVEL`).

## Dados sensíveis

Nos dois serviços Node o agente vai com `captureBody: 'off'` e `captureHeaders: false` — o app
faz proxy de pedidos autenticados (Bearer do Google/Firebase, Basic do gateway) e corpos com
dados de clientes. Ative caso a caso por variável de ambiente, com noção do que passa a ser
guardado no Elasticsearch.

Não há `secret_token` nem API key: a segurança do Elasticsearch está desativada neste ambiente.

Ruído já filtrado: `/api/health` (healthcheck do compose, de 10 em 10 s) nos dois serviços, e
`/assets/*` + `/favicon.ico` no servidor do SPA.

## Rede

**Os três agentes usam o endereço público `https://apm.sebratel.net.br`** (proxy reverso HTTPS,
à semelhança do Kibana), e o compose não declara nenhuma rede externa.

É uma escolha deliberada: produção e testes correm em **hosts diferentes**, e o nome interno
`apm-server` só resolve no host do stack `elk`. Pior, uma rede `external: true` que não exista
no host faz o **deploy falhar** (`network ... declared as external, but could not be found`) —
o mesmo compose deixaria de servir os dois ambientes. O custo é a telemetria sair e voltar pelo
proxy reverso em vez de ficar na rede interna; para este volume não se nota.

Num host que esteja na rede do `elk`, dá para poupar esse salto: junte a rede ao compose e
defina `ELASTIC_APM_SERVER_URL=http://apm-server:8200` no painel Environment dessa stack.

Verificado a partir de fora da rede: `GET /` devolve `200` com a versão 8.15.0 e
`publish_ready: true`; o preflight de `POST /intake/v2/rum/events` devolve
`Access-Control-Allow-Origin` a refletir a origem pedida; e um payload RUM mínimo foi aceite
com `202`, o que prova o caminho completo (proxy → apm-server → Elasticsearch).

Se um dia juntar a stack à rede do `elk`, note que isso também dá a esses containers acesso ao
Elasticsearch em `9200`, que neste ambiente está sem autenticação (`xpack.security.enabled=false`).

Nota de deploy: **rebuild, não restart** — o frontend porque as `VITE_*` entram no bundle em
tempo de build, e o backend porque o `CMD` e as dependências da imagem mudaram.

## Servidor de testes

Mesmo APM Server, ambiente diferente. No painel Environment da stack de testes, só isto:

```env
ELASTIC_APM_ENVIRONMENT=staging
VITE_APM_ENVIRONMENT=staging
```

O Kibana passa a ter um seletor de ambiente e os mesmos serviços aparecem uma vez só, com
produção e testes comparáveis lado a lado (latência, taxa de erro) e alertas por ambiente.

**Não mude os `SERVICE_NAME` por ambiente** (`splitters-bff-staging` e afins): ficam serviços
duplicados no Kibana e perde-se exatamente essa comparação.

Um APM Server separado para testes só compensa com isolamento a sério em vista — não sujar os
índices de produção, retenção diferente, ou poupar o Elasticsearch de produção ao ruído. Nesse
caso é na mesma só configuração: `ELASTIC_APM_SERVER_URL` e `VITE_APM_SERVER_URL` a apontar
para o outro endereço.

## Validação depois de ligar

1. Gerar tráfego no app.
2. Kibana → Observability → APM → os serviços aparecem sozinhos, sem configuração extra.
   Nota: existe também um serviço `splitters-apm-smoke` (environment `smoke`), do teste de
   ingestão feito em 10/08/2026 — é descartável, ignore ou apague.
3. Se não aparecerem, ver os logs do container: o agente escreve o arranque
   (`Elastic APM Node.js Agent`, com `activationMethod: preload` no BFF) e os erros de ligação
   (`APM Server transport error`) em stdout. No browser, a consola mostra falhas do RUM.
