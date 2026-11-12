/**
 * Trava em memória por chave — serializa operações concorrentes que fariam um
 * SELECT (existe?) seguido de INSERT/UPDATE sem transação, como o
 * findExistingHistoryId + INSERT de registerOpenBatch em massivaHistoryStore.js.
 *
 * Sem isso, duas chamadas concorrentes para o MESMO protocolo/assignment (ex.: a
 * gravação antecipada de um AP e uma gravação final que chega quase junto, ou duas
 * tentativas da mesma massiva) podem achar a linha inexistente nas duas, e cada
 * uma fazer seu próprio INSERT — duplicando a linha no histórico.
 *
 * Cobre apenas concorrência DENTRO deste processo Node (um único BFF local por
 * ambiente, sem múltiplas réplicas atrás de um load balancer). Não substitui um
 * índice único no banco — é a defesa de primeira linha, mais barata e sem
 * depender de auditar duplicatas existentes antes de aplicar.
 */

const chains = new Map();

/**
 * Executa `fn` só depois que a execução anterior sob a mesma `key` terminar
 * (com sucesso ou erro). Chaves diferentes rodam em paralelo, sem bloqueio.
 */
function withRowLock(key, fn) {
  const previous = chains.get(key) ?? Promise.resolve();
  const settledPrevious = previous.then(
    () => undefined,
    () => undefined,
  );
  const result = settledPrevious.then(fn);
  // Mantém a corrente viva para a próxima chamada, mas nunca deixa uma rejeição
  // aqui virar "unhandled rejection" — o erro real já propaga para quem chamou
  // via `result`, que não é engolido.
  chains.set(
    key,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}

export { withRowLock };
