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

`distributedTracingOrigins` fica no padrão (só o mesmo origin). Propagar `traceparent` para o
gateway, GeoGrid ou AutoISP obrigaria a preflight e a CORS extra nesses serviços.

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

No Portainer, todas elas vivem no painel **Environment** da stack — o
[docker-compose.portainer.yml](../docker-compose.portainer.yml) já as repassa.

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

## Pendente — decisão de rede (infra, não código)

O APM Server escuta em `8200` mas essa porta não está exposta fora do host; só o Kibana tem
proxy reverso HTTPS. Consequências práticas:

- **Backend**: `http://apm-server:8200` só resolve se os containers do NexaView estiverem na
  rede `es_network` do stack `elk`. Hoje a stack usa a sua própria rede `nexaview-network`, por
  isso é preciso ou juntar a rede externa ao compose, ou usar um endereço do host alcançável a
  partir dos containers.
- **RUM**: precisa de URL pública (ex.: `apm.sebratel.net.br` com proxy reverso, à semelhança do
  Kibana). Enquanto não existir, deixe `VITE_APM_SERVER_URL` vazia — a instrumentação fica no
  código, pronta, sem tentar enviar nada.

Quando a rede estiver resolvida, basta preencher as variáveis e refazer o deploy (o frontend
precisa de rebuild, porque as `VITE_*` entram no bundle em tempo de build).

## Validação depois de ligar

1. Gerar tráfego no app.
2. Kibana → Observability → APM → os serviços aparecem sozinhos, sem configuração extra.
3. Se não aparecerem, ver os logs do container: o agente escreve o arranque
   (`Elastic APM Node.js Agent`, com `activationMethod: preload` no BFF) e os erros de ligação
   (`APM Server transport error`) em stdout. No browser, a consola mostra falhas do RUM.
