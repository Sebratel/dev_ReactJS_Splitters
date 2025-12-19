import 'package:flutter/foundation.dart';

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
  final String? oltDescription; // 👈 NOME DA OLT

  final String latitude;
  final String longitude;

  const SplitterModel({
    required this.id,
    required this.code,
    required this.title,
    required this.outPorts,
    required this.active,
    required this.typeText,
    required this.description,
    required this.latitude,
    required this.longitude,
    this.networkBoxCode,
    this.networkBoxTitle,
    this.networkBoxType,
    this.oltCode,
    this.oltIntegrationCode,
    this.oltDescription,
  });

  double? get lat => double.tryParse(latitude);
  double? get lng => double.tryParse(longitude);
  bool get hasLocation => lat != null && lng != null;

  factory SplitterModel.fromJson(Map<String, dynamic> json) {
    final address = json['address'] as Map<String, dynamic>? ?? {};
    final networkBox = json['networkBox'] as Map<String, dynamic>?;
    final olt = json['olt'] as Map<String, dynamic>?;

    // 🔍 DEBUG CONTROLADO
    if (kDebugMode && (olt == null || olt['description'] == null)) {
      debugPrint(
        '⚠️ SPLITTER SEM OLT → '
        'code=${json['code']} | '
        'title=${json['title']} | '
        'oltRaw=$olt',
      );
    }

    return SplitterModel(
      id: json['id'] ?? 0,
      code: json['code']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      outPorts: int.tryParse(json['outPorts']?.toString() ?? '0') ?? 0,
      active: json['active'] ?? false,
      typeText: json['type']?['text']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      latitude: address['latitude']?.toString().trim() ?? '',
      longitude: address['longitude']?.toString().trim() ?? '',
      networkBoxCode: networkBox?['code']?.toString(),
      networkBoxTitle: networkBox?['title']?.toString(),
      networkBoxType: networkBox?['type']?['text']?.toString(),
      oltCode: olt?['code']?.toString(),
      oltIntegrationCode: olt?['integrationCode']?.toString(),
      oltDescription: olt?['description']?.toString(),
    );
  }
}
