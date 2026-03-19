/// Representa um splitter da rede.
///
/// Esse model abastece a HomePage, a tela de detalhe e parte do fluxo de
/// massivas. Ele junta identificadores de rede, capacidade de portas,
/// coordenadas e referencias de OLT/CTO.
class SplitterModel {
  final int id;
  final String code;
  final String title;
  final int outPorts;

  final bool active;
  final String typeText;
  final String description;

  // 🔹 CTO
  final String? networkBoxCode;
  final String? networkBoxTitle;
  final String? networkBoxType;

  // 🔹 OLT
  final String? oltCode;
  final String? oltIntegrationCode;
  final String? oltDescription; // Nome da OLT
  final String integrationCode; // ID do equipamento na GeoGrid

  final String latitude;
  final String longitude;
  final String? street;

  const SplitterModel({
    required this.id,
    required this.code,
    required this.integrationCode,
    required this.title,
    required this.outPorts,
    required this.active,
    required this.typeText,
    required this.description,
    required this.latitude,
    required this.longitude,
    this.street,
    this.networkBoxCode,
    this.networkBoxTitle,
    this.networkBoxType,
    this.oltCode,
    this.oltIntegrationCode,
    this.oltDescription,
  });

  double? _parseCoordinate(String value) {
    final normalized = value.replaceAll(',', '.').trim();
    if (normalized.isEmpty) return null;
    return double.tryParse(normalized);
  }

  // Algumas APIs devolvem coordenadas como texto, inclusive com virgula.
  double? get lat => _parseCoordinate(latitude);
  double? get lng => _parseCoordinate(longitude);
  bool get hasLocation => lat != null && lng != null;

  // 🔐 NORMALIZA MAP (EVITA LinkedMap<dynamic, dynamic>)
  static Map<String, dynamic> _safeMap(dynamic raw) {
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    return {};
  }

  factory SplitterModel.fromJson(Map<String, dynamic> json) {
    final address = _safeMap(json['address']);
    final networkBox = _safeMap(json['networkBox']);
    final olt = _safeMap(json['olt']);

    return SplitterModel(
      id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
      code: json['code']?.toString() ?? '',
      integrationCode: json['integrationCode']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      outPorts: int.tryParse(json['outPorts']?.toString() ?? '0') ?? 0,
      active: json['active'] == true,
      typeText: _safeMap(json['type'])['text']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      latitude: address['latitude']?.toString().trim() ?? '',
      longitude: address['longitude']?.toString().trim() ?? '',
      street: () {
        final value = address['street'] ??
            address['road'] ??
            address['pedestrian'] ??
            address['residential'];
        final text = value?.toString().trim();
        return (text == null || text.isEmpty) ? null : text;
      }(),
      networkBoxCode: networkBox['code']?.toString(),
      networkBoxTitle: networkBox['title']?.toString(),
      networkBoxType: _safeMap(networkBox['type'])['text']?.toString(),
      oltCode: olt['code']?.toString(),
      oltIntegrationCode: olt['integrationCode']?.toString(),
      oltDescription: olt['description']?.toString(),
    );
  }
}
