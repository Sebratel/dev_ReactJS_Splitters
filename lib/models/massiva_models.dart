/// Representa um alvo de rede individual dentro do contexto de massiva.
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

/// Payload legado usado em alguns fluxos de abertura de massiva.
class MassivaIncidentRequest {
  final String startDate;
  final String startTime;
  final List<int> accessPointIds;
  final List<int> slotOlt;
  final List<int> portaOlt;
  final List<int>? addressListId;
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
    this.addressListId,
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
        if (addressListId != null && addressListId!.isNotEmpty)
          'addressListId': addressListId,
        'companyPlaceId': companyPlaceId,
        'assignmentTypeId': assignmentTypeId,
        'assignmentDescription': assignmentDescription,
        'maintenanceDate': maintenanceDate,
        'maintenanceTime': maintenanceTime,
        'cookieString': cookieString,
      };
}

/// Bloco `assignment` esperado pelo API Gateway ao abrir uma massiva.
class ApiGatewayMassivaAssignment {
  final String title;
  final String description;
  final String finalDate;
  final int companyPlaceId;

  const ApiGatewayMassivaAssignment({
    required this.title,
    required this.description,
    required this.finalDate,
    required this.companyPlaceId,
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        'description': description,
        'finalDate': finalDate,
        'companyPlaceId': companyPlaceId,
      };
}

/// Payload principal usado hoje para abertura via API Gateway.
class ApiGatewayMassivaRequest {
  final int incidentStatusId;
  final int personId;
  final int incidentTypeId;
  final int catalogServiceId;
  final int serviceLevelAgreementId;
  final int matrixType;
  final String teamCode;
  final String solicitationServiceCategory1;
  final String solicitationServiceCategory2;
  final String solicitationServiceCategory3;
  final String solicitationServiceCategory4;
  final String solicitationServiceCategory5;
  final String authenticationAccessPointCode;
  final ApiGatewayMassivaAssignment assignment;
  final List<AffectedUserRequest> affectedUsers;

  const ApiGatewayMassivaRequest({
    required this.incidentStatusId,
    required this.personId,
    required this.incidentTypeId,
    required this.catalogServiceId,
    required this.serviceLevelAgreementId,
    required this.matrixType,
    required this.teamCode,
    required this.solicitationServiceCategory1,
    required this.solicitationServiceCategory2,
    required this.solicitationServiceCategory3,
    required this.solicitationServiceCategory4,
    required this.solicitationServiceCategory5,
    required this.authenticationAccessPointCode,
    required this.assignment,
    required this.affectedUsers,
  });

  Map<String, dynamic> toJson(int affectedUsersQuantity) => {
        'incidentStatusId': incidentStatusId,
        'personId': personId,
        'incidentTypeId': incidentTypeId,
        'catalogServiceId': catalogServiceId,
        'serviceLevelAgreementId': serviceLevelAgreementId,
        'matrixType': matrixType,
        'teamCode': teamCode,
        'solicitationServiceCategory1': solicitationServiceCategory1,
        'solicitationServiceCategory2': solicitationServiceCategory2,
        'solicitationServiceCategory3': solicitationServiceCategory3,
        'solicitationServiceCategory4': solicitationServiceCategory4,
        'solicitationServiceCategory5': solicitationServiceCategory5,
        'authenticationAccessPointCode': authenticationAccessPointCode,
        'assignment': assignment.toJson(),
        'affectedUsersQuantity': affectedUsersQuantity,
        'affectedUsers': affectedUsers,
      };
}

/// PPPoE afetado que sera registrado no endpoint de afetados.
class AffectedUserRequest {
  final String pppoe;
  final int protocol;
  final String reason;
  final String finishDate;
  final String created;
  final String createdBy;
  final int contractId;

  const AffectedUserRequest({
    required this.pppoe,
    required this.protocol,
    required this.reason,
    required this.finishDate,
    required this.created,
    required this.createdBy,
    required this.contractId,
  });

  Map<String, dynamic> toJson() => {
        'pppoe': pppoe,
        'protocol': protocol,
        'reason': reason,
        'finishDate': finishDate,
        'created': created,
        'createdBy': createdBy,
        'contractId': contractId,
      };
}

/// Resultado do filtro legado de clientes impactados.
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

/// Resposta normalizada da abertura de massiva, independentemente do backend.
class EllevenMassivaResponse {
  final bool success;
  final int? protocol;
  final int? assignmentId;
  final String message;
  final List<int> createdProtocols;

  const EllevenMassivaResponse({
    required this.success,
    required this.message,
    this.protocol,
    this.assignmentId,
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
    final dataResponse = nestedMap(data['response']);
    final response = nestedMap(json['response']);
    final result = nestedMap(json['result']);
    final merged = <String, dynamic>{
      ...dataResponse,
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
    final assignmentId =
        int.tryParse((merged['assignmentId'] ?? '').toString());

    return EllevenMassivaResponse(
      success: merged['success'] == false ? false : true,
      protocol: protocol,
      assignmentId: assignmentId,
      message: (dataResponse['message'] ??
              merged['message'] ??
              merged['mensagem'] ??
              '')
          .toString(),
      createdProtocols: created,
    );
  }
}

/// Resultado consolidado do fluxo legado com filtro + abertura.
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

/// Item da listagem de massivas usado na area de monitoramento.
class MassivaTicket {
  final int protocol;
  final int? assignmentId;
  final String title;
  final String apCode;
  final String splitterCode;
  final String team;
  final String createdBy;
  final String responsible;
  final MassivaStatus status;
  final DateTime? openedAt;
  final DateTime? expectedCloseAt;
  final DateTime? closedAt;
  final int affectedClients;
  final bool usedFallback;

  const MassivaTicket({
    required this.protocol,
    this.assignmentId,
    required this.title,
    required this.apCode,
    required this.splitterCode,
    required this.team,
    required this.createdBy,
    required this.responsible,
    required this.status,
    required this.openedAt,
    required this.expectedCloseAt,
    required this.closedAt,
    required this.affectedClients,
    required this.usedFallback,
  });

  MassivaTicket copyWith({
    int? protocol,
    int? assignmentId,
    String? title,
    String? apCode,
    String? splitterCode,
    String? team,
    String? createdBy,
    String? responsible,
    MassivaStatus? status,
    DateTime? openedAt,
    DateTime? expectedCloseAt,
    DateTime? closedAt,
    int? affectedClients,
    bool? usedFallback,
  }) {
    return MassivaTicket(
      protocol: protocol ?? this.protocol,
      assignmentId: assignmentId ?? this.assignmentId,
      title: title ?? this.title,
      apCode: apCode ?? this.apCode,
      splitterCode: splitterCode ?? this.splitterCode,
      team: team ?? this.team,
      createdBy: createdBy ?? this.createdBy,
      responsible: responsible ?? this.responsible,
      status: status ?? this.status,
      openedAt: openedAt ?? this.openedAt,
      expectedCloseAt: expectedCloseAt ?? this.expectedCloseAt,
      closedAt: closedAt ?? this.closedAt,
      affectedClients: affectedClients ?? this.affectedClients,
      usedFallback: usedFallback ?? this.usedFallback,
    );
  }

  bool get isOpen => status == MassivaStatus.aberta;

  bool get isClosed => status == MassivaStatus.encerrada;

  Duration? get resolutionTime {
    if (openedAt == null || closedAt == null) return null;
    return closedAt!.difference(openedAt!);
  }

  factory MassivaTicket.fromJson(Map<String, dynamic> json) {
    print(json.toString());

    final input = json['input'] is Map
        ? (json['input'] as Map).map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};
    final inputAssignment = input['assignment'] is Map
        ? (input['assignment'] as Map).map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};
    final assignment = json['assignment'] is Map
        ? (json['assignment'] as Map).map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};
    final incidentStatus = json['incidentStatus'] is Map
        ? (json['incidentStatus'] as Map)
            .map((k, v) => MapEntry(k.toString(), v))
        : const <String, dynamic>{};
    final merged = <String, dynamic>{...input, ...json};
    final assignmentIdRaw = merged['assignmentId'] ??
        merged['id'] ??
        merged['ID'] ??
        merged['idAssignment'] ??
        assignment['id'] ??
        assignment['ID'] ??
        merged['assignmentIdValue'] ??
        '';

    final protocolRaw = merged['protocol'] ??
        merged['protocolo'] ??
        merged['id'] ??
        input['id'];
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
      assignmentId: int.tryParse(assignmentIdRaw.toString()),
      title: (merged['title'] ??
              assignment['title'] ??
              merged['tituloIncidente'] ??
              merged['catalogo'] ??
              merged['descricao'] ??
              merged['description'] ??
              merged['subject'] ??
              'Massiva')
          .toString(),
      apCode: (merged['apCode'] ??
              merged['pontoDeAcesso'] ??
              merged['accessPoint'] ??
              merged['accessPointCode'] ??
              '')
          .toString(),
      splitterCode: (merged['splitterCode'] ??
              merged['splitter'] ??
              merged['networkBoxCode'] ??
              '')
          .toString(),
      team: (merged['team'] ?? merged['equipe'] ?? '').toString(),
      createdBy: (inputAssignment['responsavel'] ??
              merged['responsavel'] ??
              merged['createdBy'] ??
              merged['criadoPor'] ??
              '')
          .toString(),
      responsible:
          (merged['responsavel'] ?? merged['responsible'] ?? '').toString(),
      status: status,
      openedAt: _parseDate(
        merged['openedAt'] ??
            inputAssignment['beginningDate'] ??
            inputAssignment['beginningData'] ??
            assignment['beginningDate'] ??
            assignment['beginningData'] ??
            merged['beginningDate'] ??
            merged['beginningData'] ??
            merged['criacao'] ??
            merged['creationDate'] ??
            merged['createdAt'] ??
            merged['openingDate'],
      ),
      expectedCloseAt: _parseDateCandidates(
        [
          merged['sla'],
          inputAssignment['sla'],
          inputAssignment['finalDate'],
          inputAssignment['finalData'],
          assignment['finalDate'],
          assignment['finalData'],
          merged['finalDate'],
          merged['finalData'],
          merged['maintenanceDate'],
          merged['forecastClosingDate'],
          merged['expectedCloseAt'],
          merged['expectedClosureDate'],
          merged['previsionClosingDate'],
          merged['previsionCloseAt'],
        ],
        dateCandidate: merged['maintenanceDate'] ??
            merged['forecastClosingDate'] ??
            merged['finalDate'] ??
            merged['finalData'],
        timeCandidate: merged['maintenanceTime'] ??
            merged['forecastClosingTime'] ??
            merged['finalTime'],
      ),
      closedAt: _parseDateCandidates(
        [
          merged['closedAt'],
          merged['finalizado'],
          merged['finalizationDate'],
          merged['closedDate'],
          merged['closureDate'],
          merged['closedData'],
        ],
        dateCandidate: merged['closedDate'] ?? merged['closureDate'],
        timeCandidate: merged['closedTime'] ?? merged['closureTime'],
      ),
      affectedClients: int.tryParse((merged['affectedClients'] ??
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
    final text = value.toString().trim();
    if (text.isEmpty) return null;

    final direct = DateTime.tryParse(text);
    if (direct != null) return direct;

    final match = RegExp(
      r'^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$',
    ).firstMatch(text);

    if (match == null) return null;

    final day = int.tryParse(match.group(1) ?? '');
    final month = int.tryParse(match.group(2) ?? '');
    final year = int.tryParse(match.group(3) ?? '');
    final hour = int.tryParse(match.group(4) ?? '0') ?? 0;
    final minute = int.tryParse(match.group(5) ?? '0') ?? 0;
    final second = int.tryParse(match.group(6) ?? '0') ?? 0;

    if (day == null || month == null || year == null) return null;
    return DateTime(year, month, day, hour, minute, second);
  }

  static DateTime? _parseDateCandidates(
    List<dynamic> candidates, {
    dynamic dateCandidate,
    dynamic timeCandidate,
  }) {
    for (final candidate in candidates) {
      final parsed = _parseDate(candidate);
      if (parsed != null) return parsed;
    }

    final dateText = dateCandidate?.toString().trim() ?? '';
    if (dateText.isEmpty) return null;

    final timeText = timeCandidate?.toString().trim() ?? '';
    return _parseDate(
      timeText.isEmpty ? dateText : '$dateText $timeText',
    );
  }
}

/// Recurso individual devolvido pelo AutoISP dentro de um evento.
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

/// Evento operacional devolvido pelo AutoISP.
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
