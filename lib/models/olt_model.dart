class OltModel {
  final int id;
  final String code;
  final String title;
  final String ip;
  final int slotsNumber;
  final int portsNumber;
  final int portsFirstNumber;
  final bool active;

  final String? integrationCodeMap;
  final String? postalCode;
  final String? street;
  final String? streetNumber;
  final String? neighborhood;
  final String? city;
  final String? uf;
  final double? lat;
  final double? lng;

  OltModel({
    required this.id,
    required this.code,
    required this.title,
    required this.ip,
    required this.slotsNumber,
    required this.portsNumber,
    required this.portsFirstNumber,
    required this.active,
    this.integrationCodeMap,
    this.postalCode,
    this.street,
    this.streetNumber,
    this.neighborhood,
    this.city,
    this.uf,
    this.lat,
    this.lng,
  });

  // 🔐 NORMALIZA MAP (EVITA LinkedMap<dynamic, dynamic>)
  static Map<String, dynamic> _safeMap(dynamic raw) {
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    return {};
  }

  factory OltModel.fromJson(Map<String, dynamic> raw) {
    final json = _safeMap(raw);

    return OltModel(
      id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
      code: json['code']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      ip: json['ip']?.toString() ?? '',
      slotsNumber: json['slotsNumber'] is int
          ? json['slotsNumber']
          : int.tryParse('${json['slotsNumber']}') ?? 0,
      portsNumber: json['portsNumber'] is int
          ? json['portsNumber']
          : int.tryParse('${json['portsNumber']}') ?? 0,
      portsFirstNumber: json['portsFirstNumber'] is int
          ? json['portsFirstNumber']
          : int.tryParse('${json['portsFirstNumber']}') ?? 0,
      active: json['active'] == true,
      integrationCodeMap: json['integrationCodeMap']?.toString(),
      postalCode: json['postalCode']?.toString(),
      street: json['street']?.toString(),
      streetNumber: json['streetNumber']?.toString(),
      neighborhood: json['neighborhood']?.toString(),
      city: json['city']?.toString(),
      uf: json['uf']?.toString(),
      lat: json['lat'] != null ? double.tryParse('${json['lat']}') : null,
      lng: json['lng'] != null ? double.tryParse('${json['lng']}') : null,
    );
  }
}
