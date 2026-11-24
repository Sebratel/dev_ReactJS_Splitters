/**
 * Lista de clientes impactados por uma GMUD, no formato que o front mostra no popup:
 * só os campos necessários (sem PPPoE), ordenada por nome, com teto de segurança no tamanho da resposta.
 */

export const LISTA_LIMITE_MAXIMO = 10_000;

const text = (v) => String(v ?? '').trim();

/**
 * @param {{contractId:number, nome?:string, corporate?:boolean, pontoAcesso?:string}[]} clients
 * @returns {{ total: number, truncado: boolean, clientes: {contractId:number, nome:string, corporativo:boolean, pontoAcesso:string}[] }}
 */
export function serializeClientesLista(clients, limite = LISTA_LIMITE_MAXIMO) {
  const todos = (Array.isArray(clients) ? clients : []).map((c) => ({
    contractId: c.contractId,
    nome: text(c.nome),
    corporativo: c.corporate === true,
    pontoAcesso: text(c.pontoAcesso),
  }));
  todos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.contractId - b.contractId);
  return { total: todos.length, truncado: todos.length > limite, clientes: todos.slice(0, limite) };
}
