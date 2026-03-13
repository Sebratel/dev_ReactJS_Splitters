// ===============================
// 📍 ENDEREÇO DO CLIENTE
// ===============================
class ClienteAddress {
  final String street;
  final String number;
  final String neighborhood;
  final String city;
  final String state;
  final String postalCode;
  final String? complement;
  final double? latitude;
  final double? longitude;

  ClienteAddress({
    required this.street,
    required this.number,
    required this.neighborhood,
    required this.city,
    required this.state,
    required this.postalCode,
    this.complement,
    this.latitude,
    this.longitude,
  });

  factory ClienteAddress.fromJson(Map<String, dynamic> json) {
    return ClienteAddress(
      street: json['street'] ?? '',
      number: json['number'] ?? '',
      neighborhood: json['neighborhood'] ?? '',
      city: json['city'] ?? '',
      state: json['state'] ?? '',
      postalCode: json['postalCode'] ?? '',
      complement: json['addressComplement'],
      latitude: double.tryParse(json['latitude'] ?? ''),
      longitude: double.tryParse(json['longitude'] ?? ''),
    );
  }
}

// 🔌 PONTO DE ACESSO (OLT)
// ===============================
class AuthenticationAccessPoint {
  final String code;
  final String title;
  final int slotOlt;
  final int portOlt;

  AuthenticationAccessPoint({
    required this.code,
    required this.title,
    required this.slotOlt,
    required this.portOlt,
  });

  factory AuthenticationAccessPoint.fromJson(Map<String, dynamic> json) {
    return AuthenticationAccessPoint(
      code: json['code']?.toString() ?? '',
      title: json['title'] ?? '',
      slotOlt: json['slotOlt'] ?? 0,
      portOlt: json['portOlt'] ?? 0,
    );
  }
}

// 📑 CONTRATO
// ===============================
class ContractInfo {
  final int status;
  final String statusDescription;
  final int stage;
  final String stageDescription;

  ContractInfo({
    required this.status,
    required this.statusDescription,
    required this.stage,
    required this.stageDescription,
  });

  factory ContractInfo.fromJson(Map<String, dynamic> json) {
    return ContractInfo(
      status: json['status'] ?? 0,
      statusDescription: json['statusDescription'] ?? '',
      stage: json['stage'] ?? 0,
      stageDescription: json['stageDescription'] ?? '',
    );
  }
}

// 👤 CLIENTE (MODEL PRINCIPAL)
// ===============================
class ClienteModel {
  /// ID do cliente (client.id)
  final int clientId;

  /// ID da autenticação
  final int authenticationId;

  final String user;
  final String name;
  final int status;
  final int? port;
  final String? splitterCode;

  final ClienteAddress? address;
  final AuthenticationAccessPoint? accessPoint;
  final ContractInfo? contract;

  ClienteModel({
    required this.clientId,
    required this.authenticationId,
    required this.user,
    required this.name,
    required this.status,
    required this.port,
    required this.splitterCode,
    this.address,
    this.accessPoint,
    this.contract,
  });

  factory ClienteModel.fromJson(Map<String, dynamic> json) {
    return ClienteModel(
      authenticationId: json['id'] ?? 0, // 111581
      clientId: json['client']?['id'] ?? 0, // 119108
      user: json['user'] ?? '',
      name: json['client']?['name'] ?? '',
      status: json['status'] ?? 0,
      port: json['splitter']?['port'],
      splitterCode: json['splitter']?['code']?.toString(),
      address: json['address'] != null
          ? ClienteAddress.fromJson(json['address'])
          : null,
      accessPoint: json['authenticationAccessPoint'] != null
          ? AuthenticationAccessPoint.fromJson(
              json['authenticationAccessPoint'],
            )
          : null,
      contract: json['contract'] != null
          ? ContractInfo.fromJson(json['contract'])
          : null,
    );
  }
}
