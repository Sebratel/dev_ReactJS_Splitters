/**
 * Bootstrap do agente Elastic APM (Node.js) do BFF.
 *
 * É carregado por preload (`node -r ./apm.cjs index.js`), portanto corre antes de qualquer
 * import do `index.js` — condição do agente para conseguir instrumentar express, pg, mysql2,
 * http, etc. Como `index.js` é ESM, o preload é a forma suportada de garantir essa ordem.
 *
 * Fica DESLIGADO enquanto `ELASTIC_APM_SERVER_URL` não estiver definida: sem essa chave o
 * agente assumiria `http://127.0.0.1:8200` e ficaria a registar falhas de ligação em ciclo.
 * Sem a variável, o backend arranca exatamente como antes.
 *
 * Nota: no agente Elastic, as variáveis `ELASTIC_APM_*` têm precedência sobre as opções
 * passadas aqui — o que está em código são apenas os padrões deste serviço.
 */
const path = require('node:path');

// O `index.js` só carrega o dotenv depois; no preload ainda não há `.env` aplicado.
// Repete os mesmos ficheiros/ordem do `index.js` para que em dev o `.env.local` da raiz
// também configure o APM. Em produção (Portainer) as chaves vêm do ambiente da stack.
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '.env') });
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });
} catch {
  // dotenv ausente (instalação parcial): segue com o que já estiver em `process.env`.
}

const serverUrl = String(process.env.ELASTIC_APM_SERVER_URL || '').trim();

function readPackageVersion() {
  try {
    return require('./package.json').version || undefined;
  } catch {
    return undefined;
  }
}

let apm = null;

if (serverUrl === '') {
  if (String(process.env.LOG_LEVEL || '').trim().toLowerCase() === 'debug') {
    console.log('[apm] ELASTIC_APM_SERVER_URL não definida — agente APM desativado.');
  }
} else {
  try {
    apm = require('elastic-apm-node').start({
      serviceName: String(process.env.ELASTIC_APM_SERVICE_NAME || '').trim() || 'splitters-bff',
      serverUrl,
      environment:
        String(process.env.ELASTIC_APM_ENVIRONMENT || '').trim() ||
        String(process.env.NODE_ENV || '').trim() ||
        'development',
      serviceVersion: readPackageVersion(),
      // Corpos de pedido podem conter dados de clientes/credenciais — fora por omissão.
      captureBody: 'off',
      // Cabeçalhos trazem `authorization`/`cookie`; o agente sanitiza a maioria, mas
      // manter fora evita depender dessa lista. Ative com ELASTIC_APM_CAPTURE_HEADERS=true.
      captureHeaders: false,
      // O healthcheck do compose bate de 10 em 10 segundos; não é tráfego útil no APM.
      transactionIgnoreUrls: ['/api/health'],
      // Erros do agente não devem derrubar o processo.
      captureExceptions: true,
    });
  } catch (error) {
    console.error(`[apm] falha ao iniciar o agente APM: ${String((error && error.message) || error)}`);
  }
}

module.exports = apm;
