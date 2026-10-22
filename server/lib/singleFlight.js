/**
 * Single-flight: enquanto uma execução para a chave está em andamento, quem chega depois espera
 * a MESMA promessa em vez de disparar outra. Sem TTL e sem guardar resultado: terminou a
 * execução, a próxima chamada executa de novo.
 *
 * Existe para consultas que materializam centenas de MB no heap do Node (ex.: a base inteira de
 * conexões, ~87k linhas x 59 colunas): medido com o limite de produção (1200 MB), 10 requisições
 * simultâneas dessa consulta derrubam o processo por `heap out of memory`; com single-flight só
 * uma materialização existe por vez, sem reter o corpo (~150 MB) depois de responder.
 *
 * Erros não são guardados: quem esperava recebe o mesmo erro e a próxima chamada tenta de novo.
 */
export function createSingleFlight() {
  const inflight = new Map(); // key -> Promise<value>

  async function run(key, loader) {
    const running = inflight.get(key);
    if (running) {
      return { value: await running, shared: true };
    }

    const promise = (async () => loader())();
    inflight.set(key, promise);
    try {
      return { value: await promise, shared: false };
    } finally {
      inflight.delete(key);
    }
  }

  return { run, inflightCount: () => inflight.size };
}
