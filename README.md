# NexaView

Aplicacao Flutter para consulta de splitters, clientes e operacoes de massiva da Sebratel.

## Stack

- Flutter 3 / Dart 3
- Firebase
- Hive
- Integracoes ERP, GeoGrid, AutoISP e API Gateway de massivas

## Documentacao rapida

- Visao tecnica do projeto: `architecture.md`
- Roadmap da funcionalidade de massivas: `docs/abertura_massivas_roadmap.md`

## Como rodar

1. Copie `.env.example` para `.env.local`.
2. Preencha as credenciais e endpoints necessarios.
3. Para execucao local, use `.\run-local.ps1`.
4. Para gerar build web, use `.\build-web.ps1.example` ou mantenha um `build-web.ps1` local nao versionado.

## Variaveis importantes

- `ERP_CLIENT_ID`, `ERP_CLIENT_SECRET`, `ERP_SYNDATA`: autenticacao do ERP.
- `HUB_JWT_SECRET`: segredo usado para validar o token recebido via URL.
- `MASSIVA_API_GATEWAY_ENDPOINT`, `MASSIVA_AFFECTED_USERS_ENDPOINT`, `MASSIVA_API_GATEWAY_LIST_ENDPOINT`: integracao de massivas.
- `AUTOISP_EVENTS_ENDPOINT`, `AUTOISP_AUTH_ENDPOINT`, `AUTOISP_USERNAME`, `AUTOISP_PASSWORD`: integracao AutoISP.
- `REVERSE_GEOCODE_ENDPOINT`: reverse geocode opcional.
- `GEOGRID_BASE_URL`, `GEOGRID_API_KEY`: integracao GeoGrid.
- `LOCAL_USER_EMAIL`, `LOCAL_USER_PERSON_ID`, `LOCAL_MASSIVA_ENABLED`: defaults para ambiente local.
- `LOCAL_SESSION_TOKEN`: token tecnico usado como fallback no ambiente local quando nao houver token vindo da URL.

## Fluxo de entrega para GitHub

1. Confirmar que `.env.local`, `build-web.ps1`, caches e artefatos locais nao entraram no commit.
2. Rodar `flutter pub get`.
3. Rodar `flutter analyze`.
4. Rodar `flutter test`.
5. Gerar um smoke build com `.\build-web.ps1.example`.
6. Validar no `git status` que so entraram arquivos de codigo, docs e exemplos.

## Pendencias conhecidas

- O projeto agora possui uma base inicial de testes em `test/`, mas ela ainda
  cobre so models e regras de parsing.
- `flutter analyze` e `flutter test` ainda precisam ser confirmados no ambiente
  com dependencias e tempo suficiente de execucao.

## Arquivos locais que nao devem subir

- `.env.local`
- `run-local.ps1`
- `build-web.ps1`
- `.firebase/`
- `build/`, `.dart_tool/`, logs e artefatos temporarios
