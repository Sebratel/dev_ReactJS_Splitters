import 'package:nexaview/models/cliente_model.dart';

/// 🔌 Representa o ESTADO de uma porta do splitter
/// Fonte: endpoint AuthenticationSplittersPortsData
class PortaModel {
  /// Número da porta física
  final int port;

  /// Porta ocupada ou não
  final bool busy;

  /// Username vindo da autenticação (ERP / Radius / PPPoE)
  final String? username;

  /// Cliente enriquecido (opcional)
  /// Vem da SUA API, via match username ↔ user
  final ClienteModel? cliente;

  PortaModel({
    required this.port,
    required this.busy,
    this.username,
    this.cliente,
  });

  /// 🔄 Criação direta a partir do JSON do endpoint novo
  factory PortaModel.fromJson(Map<String, dynamic> json) {
    final contract = json['authenticationContract'];

    return PortaModel(
      port: json['port'] ?? 0,
      busy: json['busy'] ?? false,
      username: contract?['username']?.toString(),
      cliente: null, // enriquecido depois
    );
  }

  /// 🧠 Enriquecimento com ClienteModel
  PortaModel copyWithCliente(ClienteModel? cliente) {
    return PortaModel(
      port: port,
      busy: busy,
      username: username,
      cliente: cliente,
    );
  }

  factory PortaModel.fromGeoGrid(Map<String, dynamic> json) {
    final dados = json['dados'] as Map<String, dynamic>? ?? {};

    final porta = int.tryParse(dados['porta']?.toString() ?? '');
    final status = dados['status']?.toString();
    return PortaModel(
      port: porta ?? -1,
      busy: status == 'ocupado',
      username: dados['username']?.toString(),
      cliente: null,
    );
  }
}
