# NexaView - Referencia para NotebookLM

## Objetivo deste material

Este documento foi preparado para servir como fonte de consulta no NotebookLM.
Ele resume:

- o objetivo do projeto
- o fluxo principal da aplicacao
- onde ficam as regras mais importantes
- o papel de cada arquivo relevante

## O que subir no NotebookLM

Arquivos recomendados para upload:

- `README.md`
- `architecture.md`
- `docs/notebooklm_team_reference.md`
- `docs/abertura_massivas_roadmap.md`
- `.env.example`

Arquivos que **nao** devem ser enviados:

- `.env.local`
- qualquer arquivo com credenciais reais
- logs temporarios (`.codex_*.log`)
- caches locais

## Visao geral do sistema

O projeto e uma aplicacao Flutter para operacao de rede da Sebratel, com foco em:

- listar splitters
- consultar clientes conectados
- mostrar detalhe operacional do splitter
- abrir, monitorar e encerrar massivas
- apoiar a operacao com eventos AutoISP

## Fluxo principal da aplicacao

1. `lib/main.dart` inicializa Firebase, Hive e os servicos principais.
2. O app valida o token recebido via URL ou cria uma sessao local de desenvolvimento.
3. `lib/screens/home_page.dart` carrega splitters, clientes, OLTs e cache de ruas.
4. A HomePage permite:
   - buscar e filtrar splitters
   - abrir o detalhe de um splitter
   - abrir a tela de massivas
   - usar QR scanner
5. `lib/screens/splitter_detail_page.dart` mostra:
   - dados do splitter
   - clientes por porta
   - reservas do GeoGrid
   - mapa e splitters proximos
6. `lib/screens/massiva_screen.dart` concentra:
   - selecao de rota de rede
   - descricao operacional
   - abertura de massivas
   - monitoramento e encerramento
   - eventos AutoISP

## Regras e areas mais importantes

### Autenticacao e sessao

- `lib/main.dart`: decide entre modo local e modo autenticado
- `lib/models/app_session_user.dart`: transforma o payload do JWT em sessao do app
- `lib/services/auth_service.dart`: autentica no ERP e gerencia token

### Dados de splitters e clientes

- `lib/services/splitter_service.dart`: servico central de dados
- `lib/services/olt_service.dart`: carrega OLTs
- `lib/services/splitter_status_service.dart`: calcula status visual da ocupacao

### Geolocalizacao e GeoGrid

- `lib/services/geocoding_service.dart`: resolve endereco por coordenada
- `lib/services/address_cache_service.dart`: cache local de endereco
- `lib/services/geogrid_service.dart`: consulta portas e reservas no GeoGrid

### Massivas

- `lib/screens/massiva_screen.dart`: UI e regra operacional
- `lib/services/massiva_gateway_service.dart`: cliente HTTP das APIs de massiva
- `lib/services/autoisp_auth_service.dart`: autenticacao AutoISP
- `lib/services/autoisp_event_service.dart`: consulta eventos AutoISP

## Estrutura por arquivo

### Raiz do projeto

- `README.md`: instrucoes de setup, handoff e publicacao.
- `architecture.md`: visao tecnica resumida do projeto.
- `.env.example`: lista de variaveis de ambiente esperadas pelo app.
- `build-web.ps1.example`: exemplo de script para build web com `dart-define`.
- `run-local.ps1.example`: exemplo de script para execucao local com `dart-define`.
- `firebase.json`: configuracao do Firebase Hosting.
- `pubspec.yaml`: dependencias, assets e configuracoes do Flutter.

### `lib/main.dart`

- ponto de entrada da aplicacao
- inicializa Firebase e Hive
- valida token de acesso
- cria sessao local em ambiente de desenvolvimento
- injeta configuracoes e servicos na `HomePage`

### `lib/firebase_options.dart`

- configuracoes geradas pelo FlutterFire para cada plataforma

### `lib/theme.dart`

- temas claro/escuro usados na aplicacao

### `lib/enums/splitter_status.dart`

- enum usado para classificar ocupacao de splitters

### `lib/utils/`

- `lib/utils/web_utils.dart`: export condicional de utilitarios Web
- `lib/utils/web_utils_web.dart`: operacoes reais de URL/query string no navegador
- `lib/utils/web_utils_stub.dart`: fallback para plataformas sem implementacao web
- `lib/utils/string_utils.dart`: normalizacao e comparacao aproximada de nomes

### `lib/models/`

- `lib/models/app_session_user.dart`: sessao atual do usuario, permissoes e `personId`
- `lib/models/address_model.dart`: endereco resolvido para um splitter
- `lib/models/cliente_model.dart`: model principal de cliente, com dados de autenticacao, contrato e rota
- `lib/models/massiva_models.dart`: requests e responses da area de massivas e AutoISP
- `lib/models/olt_model.dart`: model de OLT com dados tecnicos e geograficos
- `lib/models/porta_geogrid_model.dart`: representa o estado de uma porta vindo do GeoGrid
- `lib/models/porta_model.dart`: model auxiliar relacionado a portas
- `lib/models/solicitation_model.dart`: protocolo/solicitacao retornado por consulta de historico
- `lib/models/splitter_model.dart`: model principal de splitter
- `lib/models/user.dart`: model generico de usuario mantido por seguranca; hoje nao participa do fluxo principal

### `lib/services/`

- `lib/services/auth_service.dart`: gera e renova token do ERP
- `lib/services/address_cache_service.dart`: persiste endereco resolvido em Hive
- `lib/services/autoisp_auth_service.dart`: autentica no AutoISP e gerencia token local
- `lib/services/autoisp_event_service.dart`: consulta eventos AutoISP com retry e refresh de token
- `lib/services/geocoding_service.dart`: consulta Nominatim e usa cache local de endereco
- `lib/services/geogrid_service.dart`: busca reservas por splitter e nome de cliente no GeoGrid
- `lib/services/massiva_gateway_service.dart`: abertura, listagem, encerramento e afetados de massivas
- `lib/services/olt_service.dart`: carrega mapa de OLTs por codigo
- `lib/services/solicitation_service.dart`: consulta solicitacoes por `authenticationId`
- `lib/services/splitter_service.dart`: busca splitters/clientes, mantem cache e snapshots da UI
- `lib/services/splitter_status_service.dart`: traduz ocupacao em status visual

### `lib/screens/`

- `lib/screens/home_page.dart`: dashboard principal com busca, filtros e navegacao
- `lib/screens/splitter_detail_page.dart`: detalhe de splitter, mapa, clientes e reservas
- `lib/screens/cliente_detail_screen.dart`: detalhe de cliente e historico de solicitacoes
- `lib/screens/massiva_screen.dart`: operacao completa de massivas

### `lib/widgets/`

- `lib/widgets/splitter_card.dart`: card visual usado na listagem da HomePage
- `lib/widgets/cliente_card.dart`: card visual de cliente por porta
- `lib/widgets/geogrid_refresh_button.dart`: botao com limite de clique para refresh do GeoGrid
- `lib/widgets/reserva_lock_badge.dart`: selo visual de reserva/bloqueio

## Arquivos mais importantes para manutencao

Se alguem do time precisar entender rapidamente onde mexer:

- problema de login, token ou permissao:
  `lib/main.dart`, `lib/models/app_session_user.dart`, `lib/services/auth_service.dart`
- problema de listagem, cache ou filtros:
  `lib/screens/home_page.dart`, `lib/services/splitter_service.dart`
- problema de detalhe do splitter:
  `lib/screens/splitter_detail_page.dart`, `lib/services/geogrid_service.dart`, `lib/services/geocoding_service.dart`
- problema de detalhe do cliente:
  `lib/screens/cliente_detail_screen.dart`, `lib/services/solicitation_service.dart`
- problema de massiva:
  `lib/screens/massiva_screen.dart`, `lib/services/massiva_gateway_service.dart`
- problema de eventos AutoISP:
  `lib/services/autoisp_auth_service.dart`, `lib/services/autoisp_event_service.dart`

## Variaveis de ambiente mais importantes

- `ERP_CLIENT_ID`
- `ERP_CLIENT_SECRET`
- `ERP_SYNDATA`
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
- `REVERSE_GEOCODE_ENDPOINT`
- `LOCAL_USER_EMAIL`
- `LOCAL_USER_PERSON_ID`
- `LOCAL_MASSIVA_ENABLED`

## Observacoes para a equipe

- o projeto ja possui uma base inicial em `test/`, mas ainda pequena
- `flutter analyze` e `flutter test` continuam sendo recomendados antes de cada `push`
- `.env.local` nunca deve ser enviado ao GitHub
- o fluxo de massivas e a parte mais sensivel do sistema e concentra mais regra de negocio
