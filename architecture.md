# NexaView - Plataforma de Gerenciamento de Splitters

## Visão Geral
Plataforma para visualização e gerenciamento de splitters de rede, permitindo consulta via lista ou QR code scanner para visualizar clientes conectados.

## Arquitetura da Aplicação

### 1. Modelos de Dados (`lib/models/`)
- **User**: Modelo de usuário básico
- **SplitterModel**: Representa um splitter com ID, porta, total de portas
- **ClienteModel**: Representa um cliente conectado com PPPOE, nome, ID

### 2. Serviços (`lib/services/`)
- **SplitterService**: Gerencia operações CRUD de splitters e clientes (local storage)
  - Carrega/salva dados no shared_preferences
  - Fornece dados de amostra realistas
  - Busca splitter por ID ou QR code
  - Lista clientes por splitter

### 3. Telas (`lib/screens/`)
- **HomePage**: Lista de splitters com busca e QR scanner
- **SplitterDetailPage**: Detalhes do splitter com clientes conectados

### 4. Widgets Reutilizáveis (`lib/widgets/`)
- **SplitterCard**: Card visual para exibir splitter na lista
- **ClienteCard**: Card para exibir informações do cliente
- **ScanQRButton**: Botão para abrir scanner QR

### 5. Design
- Paleta de cores vibrantes (roxo, ciano, coral, verde neon)
- Tipografia refinada usando Google Fonts
- Espaçamento generoso (24-32dp)
- Cards com bordas arredondadas e gradientes sutis
- Animações suaves nas transições

## Funcionalidades Principais
1. ✅ Listagem de splitters com informações principais
2. ✅ Busca de splitters por ID
3. ✅ Scanner QR code para acessar splitter
4. ✅ Visualização detalhada com clientes conectados
5. ✅ Interface moderna e elegante
6. ✅ Suporte a modo claro e escuro

## Tecnologias
- Flutter SDK 3.6+
- shared_preferences para storage local
- qr_code_scanner para leitura QR
- google_fonts para tipografia refinada
