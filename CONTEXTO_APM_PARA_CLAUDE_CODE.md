# Contexto: Integração Elastic APM — para o agente Claude Code

> Este documento resume o que já foi feito na infraestrutura (Elastic Stack) e descreve o que falta: instrumentar as aplicações JavaScript (backend Node.js e frontend browser) para enviar dados ao APM Server. Cole este arquivo como contexto para o Claude Code adaptar o código das aplicações.

## 1. O que já existe na infraestrutura

Stack Elastic rodando via **Portainer** (produção, `portainer-prod.sebratel.net.br`, stack `elk`), com Elasticsearch e Kibana na versão **8.15.0**, licença **Basic**.

Serviços no stack `elk` (Docker Compose, rede `es_network`):

- `elasticsearch-node` — Elasticsearch 8.15.0, porta `9200`
- `kibana` — Kibana 8.15.0, porta `5601`, acessível externamente via `https://kibana.sebratel.net.br` (atrás de proxy reverso)
- `apm-server` — **APM Server 8.15.0, recém-adicionado**, porta `8200`, com RUM (frontend) habilitado
- `logstash` — porta `1514/udp`
- `metricbeat` — coleta métricas do host/containers

O `apm-server` foi configurado só por flags de linha de comando (sem arquivo de config externo, pois o Portainer Community Edition não permite montar arquivos do host pela interface web):

```yaml
apm-server:
  image: docker.elastic.co/apm/apm-server:8.15.0
  container_name: apm-server
  command: >
    apm-server -e
      -E apm-server.host=0.0.0.0:8200
      -E apm-server.rum.enabled=true
      -E output.elasticsearch.hosts=["elasticsearch:9200"]
      -E setup.kibana.host=kibana:5601
      -E apm-server.kibana.enabled=true
      -E apm-server.kibana.host=kibana:5601
  ports:
    - "8200:8200"
  networks:
    - es_network
```

Deploy confirmado com sucesso (logs: `apm-server started.`, `Listening on: [::]:8200`, `RUM endpoints enabled!`, conectado ao Kibana). Os demais serviços (`elasticsearch-node`, `kibana`) não foram reiniciados no processo.

Segurança do Elasticsearch está **desabilitada** (`xpack.security.enabled=false`) neste ambiente — não é necessário `secret_token` nem API key para o APM Server se conectar. RUM está com `allow_origins: *` (liberado para qualquer origem) — restringir antes de produção "de verdade".

## 2. Importante: como alcançar o APM Server pela rede

Testamos acesso direto pelo IP público (`http://186.219.134.247:8200/`) e **não abre** — mas isso é esperado: a porta `9200` (Elasticsearch) também não abre direto pelo IP público. O firewall do servidor não expõe essas portas de Docker diretamente; só o domínio do Kibana (via proxy reverso HTTPS) está liberado externamente.

Isso significa que o `server_url` que as aplicações vão usar depende de onde elas rodam:

- **Aplicação no mesmo host/rede Docker do stack `elk`**: usar `http://apm-server:8200` (nome do serviço, se a app estiver na rede `es_network`) ou `http://localhost:8200` (se estiver no mesmo host, fora do Docker).
- **Aplicação em outro servidor/host** (ou o navegador do usuário final, no caso do agente RUM do frontend): **ainda não está liberado** — vai precisar de uma regra de firewall abrindo a porta `8200` para o IP de origem, ou (mais recomendado) um subdomínio com proxy reverso (ex.: `apm.sebratel.net.br`) apontando para `apm-server:8200`, igual já existe para o Kibana. **Essa decisão de rede ainda está pendente** — o Claude Code não deve tentar resolver isso, é uma decisão de infraestrutura para o Misael. Por ora, usar variável de ambiente para o `server_url` (não hardcoded), assim é só trocar o valor quando a decisão de rede for tomada.

## 3. O que falta: instrumentar as aplicações JavaScript

As aplicações são em **JavaScript**, com uma parte **backend (Node.js)** e uma parte **frontend (browser)**. É isso que precisa ser adaptado no código agora.

### 3.1 Backend Node.js

1. Instalar o agente:

```bash
npm install elastic-apm-node --save
```

2. Iniciar o agente **antes de qualquer outro `require`/`import`**, no arquivo de entrada da aplicação:

```js
// no topo do arquivo de entrada (ex.: server.js / index.js), antes de tudo
require('elastic-apm-node').start({
  serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'nome-do-servico',
  serverUrl: process.env.ELASTIC_APM_SERVER_URL || 'http://apm-server:8200',
  environment: process.env.NODE_ENV || 'production'
})

// demais imports a partir daqui
const express = require('express')
```

Se o projeto usa ES Modules/TypeScript, iniciar via preload:

```bash
node -r elastic-apm-node/start.js app.js
```

com as opções vindas de variáveis de ambiente (`ELASTIC_APM_SERVICE_NAME`, `ELASTIC_APM_SERVER_URL`, `ELASTIC_APM_ENVIRONMENT`).

**Cada serviço/aplicação backend deve ter um `serviceName` diferente e descritivo**, para aparecer separado no Kibana → Observability → APM.

### 3.2 Frontend (browser / RUM)

1. Instalar o agente:

```bash
npm install @elastic/apm-rum --save
```

2. Inicializar o mais cedo possível no bootstrap da aplicação (ex.: `main.js`/`index.js`, antes de renderizar):

```js
import { init as initApm } from '@elastic/apm-rum'

const apm = initApm({
  serviceName: 'nome-do-frontend',
  serverUrl: import.meta.env.VITE_APM_SERVER_URL || 'http://apm-server:8200', // precisa ser acessível pelo NAVEGADOR do usuário final
  serviceVersion: '1.0.0',
  environment: 'production'
})
```

⚠️ Diferente do backend, o `serverUrl` do RUM precisa ser um endereço acessível pelo **navegador do usuário final**, não um endereço interno do Docker. Enquanto a decisão de rede do item 2 não for resolvida, a instrumentação do frontend RUM pode ficar de prontidão no código (comportamento atrás de env var / feature flag), mas não vai conseguir enviar dados de fato até existir uma URL pública para o `apm-server`.

### 3.3 Variáveis de ambiente sugeridas (backend e frontend)

```env
ELASTIC_APM_SERVICE_NAME=nome-do-servico
ELASTIC_APM_SERVER_URL=http://apm-server:8200
ELASTIC_APM_ENVIRONMENT=production
```

### 3.4 Validação

Depois de instrumentar e gerar tráfego, os serviços devem aparecer automaticamente em:

`Kibana (https://kibana.sebratel.net.br) → Observability → APM`

— sem necessidade de configuração adicional no Kibana.

## 4. Resumo do que pedir ao Claude Code

- Adicionar `elastic-apm-node` a cada serviço backend Node.js, inicializando o agente antes de qualquer outro import, com `serviceName` único por serviço e `serverUrl`/`environment` vindo de variáveis de ambiente.
- Adicionar `@elastic/apm-rum` ao(s) frontend(s), inicializando o mais cedo possível no bootstrap da aplicação, também com `serverUrl` vindo de variável de ambiente (não hardcoded), já que o endereço público do APM Server ainda depende de uma decisão de rede pendente.
- Não expor `secret_token`/API keys (não são necessários neste ambiente, pois a segurança do Elasticsearch está desabilitada).
- Não se preocupar em resolver firewall/proxy reverso — isso é uma decisão de infraestrutura separada.
