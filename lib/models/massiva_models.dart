class MassivaTarget {
  final String apCode;
  final int slot;
  final int port;
  final String splitterCode;

  const MassivaTarget({
    required this.apCode,
    required this.slot,
    required this.port,
    required this.splitterCode,
  });

  Map<String, dynamic> toJson() => {
        'apCode': apCode,
        'slot': slot,
        'port': port,
        'splitterCode': splitterCode,
      };
}

class MassivaIncidentRequest {
  final String startDate;
  final String startTime;
  final List<int> accessPointIds;
  final List<int> slotOlt;
  final List<int> portaOlt;
  final List<int> addressListId;
  final int companyPlaceId;
  final int assignmentTypeId;
  final String assignmentDescription;
  final String maintenanceDate;
  final String maintenanceTime;
  final String cookieString;

  const MassivaIncidentRequest({
    required this.startDate,
    required this.startTime,
    required this.accessPointIds,
    required this.slotOlt,
    required this.portaOlt,
    required this.addressListId,
    required this.companyPlaceId,
    required this.assignmentTypeId,
    required this.assignmentDescription,
    required this.maintenanceDate,
    required this.maintenanceTime,
    required this.cookieString,
  });

  Map<String, dynamic> toJson() => {
        'startDate': startDate,
        'startTime': startTime,
        'accessPointIds': accessPointIds,
        'slotOlt': slotOlt,
        'portaOlt': portaOlt,
        'addressListId': addressListId,
        'companyPlaceId': companyPlaceId,
        'assignmentTypeId': assignmentTypeId,
        'assignmentDescription': assignmentDescription,
        'maintenanceDate': maintenanceDate,
        'maintenanceTime': maintenanceTime,
        'cookieString': cookieString,
      };
}

class MiddlewareFilterResponse {
  final String correlationId;
  final List<int> cleanAuthenticationIds;
  final int totalAffected;

  const MiddlewareFilterResponse({
    required this.correlationId,
    required this.cleanAuthenticationIds,
    required this.totalAffected,
  });

  factory MiddlewareFilterResponse.fromJson(Map<String, dynamic> json) {
    final ids = (json['cleanAuthenticationIds'] as List? ?? const [])
        .map((e) => int.tryParse(e.toString()) ?? -1)
        .where((id) => id > 0)
        .toList();

    return MiddlewareFilterResponse(
      correlationId: json['correlationId']?.toString() ?? '',
      cleanAuthenticationIds: ids,
      totalAffected: (json['totalAffected'] as num?)?.toInt() ?? ids.length,
    );
  }
}

class EllevenMassivaResponse {
  final bool success;
  final int? protocol;
  final String message;
  final List<int> createdProtocols;

  const EllevenMassivaResponse({
    required this.success,
    required this.message,
    this.protocol,
    this.createdProtocols = const [],
  });

  factory EllevenMassivaResponse.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> nestedMap(dynamic raw) {
      if (raw is Map) {
        return raw.map((k, v) => MapEntry(k.toString(), v));
      }
      return const {};
    }

    final data = nestedMap(json['data']);
    final response = nestedMap(json['response']);
    final result = nestedMap(json['result']);
    final merged = <String, dynamic>{
      ...result,
      ...response,
      ...data,
      ...json,
    };

    final created = (merged['createdProtocols'] as List? ?? const [])
        .map((e) => int.tryParse(e.toString()) ?? -1)
        .where((id) => id > 0)
        .toList();

    final protocol = int.tryParse(
          (merged['protocol'] ?? merged['protocolo'] ?? merged['id'] ?? '')
              .toString(),
        ) ??
        (created.isNotEmpty ? created.first : null);

    return EllevenMassivaResponse(
      success: merged['success'] == false ? false : true,
      protocol: protocol,
      message: (merged['message'] ?? merged['mensagem'] ?? '').toString(),
      createdProtocols: created,
    );
  }
}

class MassivaExecutionResult {
  final MiddlewareFilterResponse filtered;
  final EllevenMassivaResponse elleven;
  final bool usedFallback;

  const MassivaExecutionResult({
    required this.filtered,
    required this.elleven,
    required this.usedFallback,
  });
}

enum MassivaStatus {
  aberta,
  encerrada,
  desconhecida,
}

class MassivaTicket {
  final int protocol;
  final String title;
  final String apCode;
  final String splitterCode;
  final MassivaStatus status;
  final DateTime? openedAt;
  final DateTime? closedAt;
  final int affectedClients;
  final bool usedFallback;

  const MassivaTicket({
    required this.protocol,
    required this.title,
    required this.apCode,
    required this.splitterCode,
    required this.status,
    required this.openedAt,
    required this.closedAt,
    required this.affectedClients,
    required this.usedFallback,
  });

  bool get isOpen => status == MassivaStatus.aberta;

  bool get isClosed => status == MassivaStatus.encerrada;

  Duration? get resolutionTime {
    if (openedAt == null || closedAt == null) return null;
    return closedAt!.difference(openedAt!);
  }

  factory MassivaTicket.fromJson(Map<String, dynamic> json) {
    final input = json['input'] is Map
        ? (json['input'] as Map).map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};
    final assignment = json['assignment'] is Map
        ? (json['assignment'] as Map).map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};
    final incidentStatus = json['incidentStatus'] is Map
        ? (json['incidentStatus'] as Map)
            .map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};
    final merged = <String, dynamic>{...input, ...json};

    final protocolRaw =
        merged['protocol'] ?? merged['protocolo'] ?? merged['id'] ?? input['id'];
    final statusRaw = (merged['status'] ??
            merged['situation'] ??
            incidentStatus['title'] ??
            merged['situationDescription'] ??
            merged['incidentSituation'] ??
            merged['incidentSituationDescription'] ??
            merged['solicitationSituation'] ??
            '')
        .toString()
        .trim()
        .toLowerCase();

    final status = statusRaw.contains('abert')
        ? MassivaStatus.aberta
        : statusRaw.contains('encerr') ||
                statusRaw.contains('fech') ||
                statusRaw.contains('close')
            ? MassivaStatus.encerrada
            : MassivaStatus.desconhecida;

    return MassivaTicket(
      protocol: int.tryParse((protocolRaw ?? '').toString()) ?? 0,
      title: (merged['title'] ??
              assignment['title'] ??
              merged['descricao'] ??
              merged['description'] ??
              merged['subject'] ??
              'Massiva')
          .toString(),
      apCode: (merged['apCode'] ??
              merged['accessPoint'] ??
              merged['accessPointCode'] ??
              '')
          .toString(),
      splitterCode: (merged['splitterCode'] ??
              merged['splitter'] ??
              merged['networkBoxCode'] ??
              '')
          .toString(),
      status: status,
      openedAt: _parseDate(
        merged['openedAt'] ??
            assignment['beginningDate'] ??
            merged['beginningDate'] ??
            merged['creationDate'] ??
            merged['createdAt'] ??
            merged['openingDate'],
      ),
      closedAt: _parseDate(
        merged['closedAt'] ??
            assignment['finalDate'] ??
            merged['finalDate'] ??
            merged['finalizationDate'] ??
            merged['closedDate'] ??
            merged['closureDate'],
      ),
      affectedClients: int.tryParse(
              (merged['affectedClients'] ??
                      merged['impacted'] ??
                      merged['contractsCounter'] ??
                      merged['clientsCount'] ??
                      '0')
                  .toString()) ??
          0,
      usedFallback: merged['strategy']?.toString() == 'bulk_individual' ||
          merged['usedFallback'] == true,
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}

class AutoIspResource {
  final String? ponlink;
  final String? pppoeUsername;
  final String? networkStatus;
  final int? contractId;
  final int? onuId;

  const AutoIspResource({
    required this.ponlink,
    required this.pppoeUsername,
    required this.networkStatus,
    required this.contractId,
    required this.onuId,
  });

  factory AutoIspResource.fromJson(Map<String, dynamic> json) {
    return AutoIspResource(
      ponlink: json['ponlink']?.toString(),
      pppoeUsername: json['pppoe_username']?.toString(),
      networkStatus: json['network_status']?.toString(),
      contractId: int.tryParse((json['contract_id'] ?? '').toString()),
      onuId: int.tryParse((json['onu_id'] ?? '').toString()),
    );
  }
}

class AutoIspEvent {
  final int id;
  final String eventType;
  final String adminStatus;
  final DateTime? startAt;
  final DateTime? endAt;
  final int countOnus;
  final int countCircuits;
  final List<AutoIspResource> resources;

  const AutoIspEvent({
    required this.id,
    required this.eventType,
    required this.adminStatus,
    required this.startAt,
    required this.endAt,
    required this.countOnus,
    required this.countCircuits,
    required this.resources,
  });

  bool get isOpen {
    final status = adminStatus.toLowerCase();
    return endAt == null &&
        (status == 'new' || status == 'open' || status == 'in_progress');
  }

  factory AutoIspEvent.fromJson(Map<String, dynamic> json) {
    final resourcesRaw = (json['resources'] as List? ?? const []);
    final resources = resourcesRaw
        .whereType<Map>()
        .map((it) => it.map((k, v) => MapEntry(k.toString(), v)))
        .map(AutoIspResource.fromJson)
        .toList();

    return AutoIspEvent(
      id: int.tryParse((json['id'] ?? '').toString()) ?? 0,
      eventType: json['event_type']?.toString() ?? '',
      adminStatus: json['admin_status']?.toString() ?? '',
      startAt: _parseDate(json['start_at']),
      endAt: _parseDate(json['end_at']),
      countOnus: int.tryParse((json['count_onus'] ?? '0').toString()) ?? 0,
      countCircuits:
          int.tryParse((json['count_circuits'] ?? '0').toString()) ?? 0,
      resources: resources,
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
