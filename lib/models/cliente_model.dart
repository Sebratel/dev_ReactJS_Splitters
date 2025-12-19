class ClienteModel {
  final int id;
  final String user;
  final String name;
  final int status;
  final int? port;
  final String? splitterCode;

  ClienteModel({
    required this.id,
    required this.user,
    required this.name,
    required this.status,
    required this.port,
    required this.splitterCode,
  });

  factory ClienteModel.fromJson(Map<String, dynamic> json) {
    final splitter = json["splitter"];

    return ClienteModel(
      id: json["id"] ?? 0,
      user: json["user"] ?? "",
      name: json["client"]?["name"] ?? "",
      status: json["status"] ?? 0,
      port: splitter?["port"],
      splitterCode: splitter?["code"]?.toString(),
    );
  }
}
