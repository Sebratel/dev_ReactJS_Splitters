# NexaView - Visao Tecnica

## Objetivo

Aplicacao Flutter usada para consultar splitters, clientes conectados e apoiar
operacoes de massiva da Sebratel.

## Fluxo de entrada

1. `lib/main.dart` inicializa Firebase, Hive e os servicos principais.
2. Em producao, o app recebe um token via URL e valida esse JWT com
   `HUB_JWT_SECRET`.
3. Em ambiente local, o app cria uma sessao tecnica a partir das variaveis
   `LOCAL_USER_*`.
4. Depois disso, a aplicacao abre a `HomePage`.

## Estrutura principal

### `lib/main.dart`

- ponto de entrada da aplicacao
- injeta configuracoes e servicos na UI
- decide entre modo local e modo autenticado

### `lib/screens/home_page.dart`

- tela principal da operacao
- carrega splitters, clientes, OLTs e cache de ruas
- controla busca, filtros e navegacao
- abre a tela de massivas quando o usuario tem permissao

### `lib/screens/splitter_detail_page.dart`

- mostra detalhes de um splitter especifico
- exibe clientes conectados
- usa GeoGrid e geocodificacao para enriquecer a visualizacao

### `lib/screens/massiva_screen.dart`

- concentra a maior parte da regra operacional de massivas
- monta a rota AP/slot/porta/splitter
- gera descricao do protocolo
- abre, lista e encerra massivas
- consulta eventos AutoISP para apoio operacional

## Servicos principais

### `lib/services/splitter_service.dart`

- integra com o ERP para buscar splitters e clientes
- mantem cache local com Hive
- expoe snapshots usados pela HomePage

### `lib/services/auth_service.dart`

- resolve autenticacao com o ERP
- devolve headers autenticados para outros servicos

### `lib/services/massiva_gateway_service.dart`

- conversa com a API Gateway de massivas
- abre protocolos
- consulta lista de massivas
- envia PPPoEs afetados
- encerra massivas

### `lib/services/autoisp_event_service.dart`

- consulta eventos do AutoISP
- alimenta a tela de massivas com eventos detectados

### `lib/services/geogrid_service.dart`

- consulta dados do GeoGrid
- usado principalmente em detalhes de splitter

## Models importantes

### `lib/models/app_session_user.dart`

- representa o usuario da sessao atual
- guarda email, papeis e `personId`
- define se a funcionalidade de massiva pode ser usada

### `lib/models/splitter_model.dart`

- representa os dados estruturais do splitter

### `lib/models/cliente_model.dart`

- representa o cliente conectado, inclusive dados de rota

### `lib/models/massiva_models.dart`

- concentra requests e responses usados pela tela e pelo servico de massivas

## Variaveis de ambiente

As configuracoes ficam em `.env.local` e sao documentadas em `.env.example`.
As mais sensiveis para o fluxo atual sao:

- `ERP_CLIENT_ID`, `ERP_CLIENT_SECRET`, `ERP_SYNDATA`
- `HUB_JWT_SECRET`
- `MASSIVA_API_GATEWAY_ENDPOINT`
- `MASSIVA_AFFECTED_USERS_ENDPOINT`
- `MASSIVA_API_GATEWAY_LIST_ENDPOINT`
- `AUTOISP_EVENTS_ENDPOINT`
- `AUTOISP_AUTH_ENDPOINT`
- `AUTOISP_USERNAME`
- `AUTOISP_PASSWORD`
- `GEOGRID_BASE_URL`
- `GEOGRID_API_KEY`

## Por onde comecar para manutencao

- problema na listagem, filtros ou cache: `lib/screens/home_page.dart` e
  `lib/services/splitter_service.dart`
- problema em detalhes de splitter: `lib/screens/splitter_detail_page.dart`,
  `lib/services/geogrid_service.dart` e `lib/services/geocoding_service.dart`
- problema em massivas: `lib/screens/massiva_screen.dart` e
  `lib/services/massiva_gateway_service.dart`
- problema de permissao/acesso: `lib/main.dart` e
  `lib/models/app_session_user.dart`
