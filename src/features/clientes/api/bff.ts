/**
 * Camada BFF usada pelo detalhe do cliente na etapa 1: lista global `listarConnections`,
 * paridade com `clientesEndpoint` no `main.dart` do Flutter.
 *
 * Não há GET por id; o hook filtra em memória com o mesmo cache que a listagem de splitters.
 */
export {
  fetchSplitterConnections as fetchConnectionsList,
  SPLITTER_CONNECTIONS_PATH,
} from '@/features/splitters/api/fetchSplitterConnections'
