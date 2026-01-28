class ClienteModel {
  /// ID do cliente na SUA API
  final int id;

  final String user;
  final String name;
  final int status;

  /// Porta na SUA API
  final int? port;

  /// Código do splitter na SUA API
  final String? splitterCode;

  /// 🔑 ID DO CLIENTE NA GEOGRID
  /// ⚠️ Esse campo PRECISA vir da sua API
  /// ou de uma tabela de vínculo
  final String? geoGridId;

  ClienteModel({
    required this.id,
    required this.user,
    required this.name,
    required this.status,
    required this.port,
    required this.splitterCode,
    this.geoGridId,
  });

  factory ClienteModel.fromJson(Map<String, dynamic> json) {
    final splitter = json["splitter"];
    final client = json["client"];

    return ClienteModel(
      id: json["id"] ?? 0,
      user: json["user"] ?? "",
      name: client?["name"] ?? "",
      status: json["status"] ?? 0,

      port: splitter?["port"],
      splitterCode: splitter?["code"]?.toString(),

      /// ⚠️ AJUSTE AQUI CONFORME SUA API REAL
      /// Opção 1 (RECOMENDADA):
      /// client: { geoGridId: "55643" }
      geoGridId: client?["geoGridId"]?.toString(),

      /// Opção 2 (se vier fora do client):
      /// geoGridId: json["geoGridId"]?.toString(),
    );
  }
}
