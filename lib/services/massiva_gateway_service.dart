import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:nexaview/models/massiva_models.dart';
import 'package:nexaview/services/auth_service.dart';
import 'package:nexaview/utils/web_utils.dart';

/// Cliente HTTP da area de massivas.
///
/// Este servico concentra toda a conversa com o backend de massivas:
/// - abertura de protocolo
/// - consulta da listagem
/// - envio e limpeza de PPPoEs afetados
/// - encerramento de massivas
class MassivaGatewayService {
  static const int closeIncidentStatusId = 4;
  static const int closeProgress = 0;
  static const int closePriority = 35;
  static const int closeNotificationTarget = 0;
  static const bool closePrivateReport = true;

  final String endpoint;
  final String listEndpoint;
  final String affectedUsersEndpoint;
  final String hubGoogleIdTokenEndpoint;
  final String? sessionToken;
  final String token; // Variável que guarda o valor do token recebido
  final http.Client _client;
  final Duration timeout;
  final int maxRetries;
  final Map<String, String> _hostTokenCache = {};
  final Map<String, DateTime> _hostTokenExpiry = {};
  String? _googleIdTokenCache;
  DateTime? _googleIdTokenExpiry;

  MassivaGatewayService({
    required this.endpoint,
    required this.listEndpoint,
    this.affectedUsersEndpoint = '',
    required this.hubGoogleIdTokenEndpoint,
    this.sessionToken,
    required this.token, // Token obrigatório na instanciação
    http.Client? client,
    this.timeout = const Duration(seconds: 20),
    this.maxRetries = 3,
  }) : _client = client ?? http.Client() {
    debugPrint(
      'MassivaGatewayService config: '
      'affectedUsersEndpoint=${_resolveAffectedUsersEndpoint()} '
      'hubGoogleIdTokenEndpoint=$hubGoogleIdTokenEndpoint '
      'listEndpoint=$listEndpoint',
    );
  }

  bool get isConfigured => endpoint.trim().isNotEmpty;
  bool get isListConfigured => listEndpoint.trim().isNotEmpty;
  bool get isAffectedUsersConfigured =>
      _resolveAffectedUsersEndpoint().trim().isNotEmpty;

  // Fluxo principal usado pela tela atual para abertura de massivas.
  Future<EllevenMassivaResponse> openMassivaViaApiGateway({
    required ApiGatewayMassivaRequest request,
  }) async {
    if (!isConfigured) {
      throw Exception('Endpoint de massiva do Elleven não configurado.');
    }

    final uri = Uri.parse(endpoint);
    final payload = request.toJson();

    debugPrint('➡️ [ABERTURA] POST $uri');

    if (kDebugMode) {
      final prettyPayload = const JsonEncoder.withIndent(
        '  ',
      ).convert(_sanitizePayload(payload));
      debugPrint(
        'Payload enviado [ABERTURA via API Gateway]:\n$prettyPayload',
        wrapWidth: 4096,
      );
    }

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _sendMassivaAuthorizedJson(
          (headers) => _client
              .post(uri, headers: headers, body: jsonEncode(payload))
              .timeout(timeout),
        );

        if (kDebugMode) {
          debugPrint(
            'Resposta [ABERTURA via API Gateway]: status=${response.statusCode}',
          );
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = response.body.trim().isEmpty
              ? <String, dynamic>{}
              : jsonDecode(response.body);
          final asMap = _safeMap(decoded);
          return _parseOpenMassivaResponse(
            asMap,
            operationLabel: 'API Gateway',
            rawBody: response.body,
            accessPointCode: request.authenticationAccessPointCode,
          );
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao abrir massiva via API Gateway '
            '(status ${response.statusCode}) '
            'para ${request.authenticationAccessPointCode}: ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) {
          throw Exception(
              _networkFailureMessage(uri: uri, action: 'abrir a massiva'));
        }
      } on http.ClientException catch (e) {
        if (attempt == maxRetries) {
          throw Exception(
            _clientFailureMessage(
              uri: uri,
              action: 'abrir a massiva',
              originalMessage: e.message,
            ),
          );
        }
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao abrir massiva via API Gateway.');
  }

  Future<EllevenMassivaResponse> openMassiva({
    required MassivaIncidentRequest incident,
    required List<int> authenticationIds,
    required bool individualTickets,
  }) async {
    if (!isConfigured) {
      throw Exception('Endpoint de massiva do Elleven não configurado.');
    }

    final uri = Uri.parse(endpoint);
    final headers = Map<String, String>.from("Authorization: Bearer $token".split(': ').asMap().map((_, e) => MapEntry(e[0], e[1])));
    final payload = authenticationIds.isEmpty
        ? incident.toJson()
        : {
            'incident': incident.toJson(),
            'authenticationIds': authenticationIds,
            'strategy':
                individualTickets ? 'bulk_individual' : 'single_massive',
          };

    debugPrint('➡️ POST $uri');

    if (kDebugMode) {
      final prettyPayload = const JsonEncoder.withIndent(
        '  ',
      ).convert(_sanitizePayload(payload));
      debugPrint(
        'Payload enviado (Abrir Massiva):\n$prettyPayload',
        wrapWidth: 4096,
      );
    }

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _client
            .post(uri, headers: headers, body: jsonEncode(payload))
            .timeout(timeout);

        if (kDebugMode) {
          debugPrint('Resposta Abrir Massiva: status=${response.statusCode}');
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = response.body.trim().isEmpty
              ? <String, dynamic>{}
              : jsonDecode(response.body);
          final asMap = _safeMap(decoded);
          return _parseOpenMassivaResponse(
            asMap,
            operationLabel: 'Elleven',
            rawBody: response.body,
          );
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro no Elleven (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) rethrow;
      } on http.ClientException catch (_) {
        if (attempt == maxRetries) rethrow;
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao abrir massiva no Elleven.');
  }

  // Envia a lista de PPPoEs afetados depois que o protocolo ja foi aberto.
  Future<int> notifyAffectedUsers({
    required List<AffectedUserRequest> users,
  }) async {
    if (users.isEmpty) return 0;

    final endpointUrl = _resolveAffectedUsersEndpoint();
    if (endpointUrl.trim().isEmpty) {
      throw Exception('Endpoint de afetados nao configurado.');
    }

    final uri = Uri.parse(endpointUrl);
    final payload = users.map((item) => item.toJson()).toList();

    debugPrint('➡️ [AFETADOS] POST $uri');

    if (kDebugMode) {
      final prettyPayload = const JsonEncoder.withIndent(
        '  ',
      ).convert(_sanitizePayload(payload));
      debugPrint(
        'Payload enviado [AFETADOS]:\n$prettyPayload',
        wrapWidth: 4096,
      );
    }

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _sendMassivaAuthorizedJson(
          (headers) => _client
              .post(uri, headers: headers, body: jsonEncode(payload))
              .timeout(timeout),
        );

        if (kDebugMode) {
          debugPrint(
            'Resposta [AFETADOS]: status=${response.statusCode}',
          );
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final body = response.body.trim();
          if (body.isNotEmpty) {
            final decoded = jsonDecode(body);
            final asMap = _safeMap(decoded);
            if (asMap.isNotEmpty && asMap['success'] == false) {
              throw Exception(
                'Erro ao enviar afetados: ${asMap['message'] ?? body}',
              );
            }
          }
          return users.length;
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao enviar afetados (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) {
          throw Exception(
            _networkFailureMessage(
                uri: uri, action: 'enviar os PPPoEs afetados'),
          );
        }
      } on http.ClientException catch (e) {
        if (attempt == maxRetries) {
          throw Exception(
            _clientFailureMessage(
              uri: uri,
              action: 'enviar os PPPoEs afetados',
              originalMessage: e.message,
            ),
          );
        }
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao enviar afetados.');
  }

  bool _shouldRetryStatus(int code) {
    return code == 429 || code >= 500;
  }

  // Quando o endpoint de afetados nao eh informado explicitamente, tentamos
  // derivar uma rota padrao a partir do endpoint principal.
  String _resolveAffectedUsersEndpoint() {
    final configured = affectedUsersEndpoint.trim();
    if (configured.isNotEmpty) {
      return configured;
    }

    final base = endpoint.trim();
    if (base.isEmpty) {
      return '';
    }

    final uri = Uri.tryParse(base);
    if (uri == null) {
      return '';
    }

    return uri.replace(
      path: '/api/v1/afetados',
      queryParameters: const {},
    ).toString();
  }

  Future<Map<String, String>> _buildMassivaApiHeaders() async {
    // Agora utilizamos o token injetado na instanciação para todas as chamadas.
    return {
      'User-Agent': 'insomnia/12.4.0',
      'Accept': '*/*',
      'Authorization': 'Bearer $token',
    };
  }

  Future<String> _ensureGoogleIdToken() async {
    // Mantido por compatibilidade de estrutura, mas redirecionado para o token injetado.
    return token;
  }

  Future<String> _fetchGoogleIdTokenFromHub() async {
    final hubToken = sessionToken?.trim() ?? '';
    if (hubToken.isEmpty) {
      throw Exception(
        'Sessão do Hub indisponível. Abra o Splitters novamente a partir do Hub.',
      );
    }

    final endpointUrl = hubGoogleIdTokenEndpoint.trim();
    if (endpointUrl.isEmpty) {
      throw Exception('Endpoint do googleIdToken do Hub nao configurado.');
    }

    final uri = Uri.parse(endpointUrl);
    final response = await _client.get(
      uri,
      headers: {
        'User-Agent': 'insomnia/12.4.0',
        'Accept': 'application/json',
        'Authorization': 'Bearer $hubToken',
      },
    ).timeout(timeout);

    if (response.statusCode == 401) {
      _redirectToHub();
      throw Exception('Sessão do Hub expirada. Redirecionando para o Hub.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Erro ao obter googleIdToken no Hub (status ${response.statusCode}): ${response.body}',
      );
    }

    final decoded = response.body.trim().isEmpty
        ? const <String, dynamic>{}
        : jsonDecode(response.body);
    final root = _safeMap(decoded);
    final googleIdToken = root['googleIdToken']?.toString().trim() ?? '';
    final expiresAtRaw = root['expiresAt']?.toString().trim() ?? '';
    final expiresAt = DateTime.tryParse(expiresAtRaw)?.toUtc();

    if (googleIdToken.isEmpty) {
      throw Exception('Hub nao retornou googleIdToken valido.');
    }

    _googleIdTokenCache = googleIdToken;
    _googleIdTokenExpiry = expiresAt;
    return googleIdToken;
  }

  void _clearGoogleIdTokenCache() {
    _googleIdTokenCache = null;
    _googleIdTokenExpiry = null;
  }

  Future<http.Response> _sendMassivaAuthorized(
    Future<http.Response> Function(Map<String, String> headers) send,
  ) async {
    for (var attempt = 1; attempt <= 2; attempt++) {
      final headers = await _buildMassivaApiHeaders();
      final response = await send(headers);
      if (response.statusCode != 401) {
        return response;
      }

      _clearGoogleIdTokenCache();
      if (attempt == 2) {
        _redirectToHub();
        return response;
      }
    }

    throw Exception('Falha inesperada ao autenticar na API de massivas.');
  }

  Future<http.Response> _sendMassivaAuthorizedJson(
    Future<http.Response> Function(Map<String, String> headers) send,
  ) {
    return _sendMassivaAuthorized((headers) {
      final merged = <String, String>{
        ...headers,
        'Content-Type': 'application/json',
      };
      return send(merged);
    });
  }

  void _redirectToHub() {
    final endpointUrl = hubGoogleIdTokenEndpoint.trim();
    final uri = Uri.tryParse(endpointUrl);
    final destination = uri == null || !uri.hasScheme
        ? 'https://sebratel-hub.web.app'
        : uri.origin;
    WebUtils.redirect(destination);
  }

  String _resolveAffectedUsersByProtocolEndpoint(int protocol) {
    final base = _resolveAffectedUsersEndpoint().trim();
    if (base.isEmpty) {
      return '';
    }

    final uri = Uri.tryParse(base);
    if (uri == null) {
      return '';
    }

    final segments = uri.pathSegments.where((it) => it.isNotEmpty).toList();
    return uri.replace(
      pathSegments: [...segments, 'protocol', protocol.toString()],
      queryParameters: const {},
    ).toString();
  }

  String _resolveCloseMassivaEndpoint() {
    final base = endpoint.trim();
    if (base.isEmpty) {
      return '';
    }

    final uri = Uri.tryParse(base);
    if (uri == null) {
      return '';
    }

    return uri.replace(
      path: '/api/v1/massivas/finalizar-chamado-via-api',
      queryParameters: const {},
    ).toString();
  }

  EllevenMassivaResponse _parseOpenMassivaResponse(
    Map<String, dynamic> json, {
    required String operationLabel,
    required String rawBody,
    String? accessPointCode,
  }) {
    final parsed = EllevenMassivaResponse.fromJson(json);
    if (parsed.success) {
      return parsed;
    }

    final backendMessage = parsed.message.trim();
    final bodyMessage = rawBody.trim();
    final details = backendMessage.isNotEmpty
        ? backendMessage
        : bodyMessage.isNotEmpty
            ? bodyMessage
            : 'backend retornou success=false sem mensagem.';
    final apSegment = accessPointCode == null ? '' : ' para $accessPointCode';

    throw Exception(
      'Erro ao abrir massiva via $operationLabel$apSegment: $details',
    );
  }

  // Consulta a listagem consolidada de massivas para abastecer o monitoramento.
  Future<List<MassivaTicket>> fetchMassivas() async {
    if (!isListConfigured) {
      throw Exception('Endpoint de listagem de massivas não configurado.');
    }

    final uri = Uri.parse(listEndpoint);

    debugPrint('➡️ [LISTAGEM] GET $uri');

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _sendMassivaAuthorized(
          (headers) => _client.get(uri, headers: headers).timeout(timeout),
        );
        
        if (kDebugMode) {
          debugPrint(
              'Resposta [LISTAGEM de Massivas]: status=${response.statusCode}');
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = jsonDecode(response.body);
          final rows = _extractRows(decoded);
          final parsed = rows.map(MassivaTicket.fromJson).toList();
          final enriched = await Future.wait(
            parsed.map((ticket) async {
              if (!isAffectedUsersConfigured || ticket.protocol <= 0) {
                return ticket;
              }
              try {
                final count =
                    await fetchAffectedUsersCountByProtocol(ticket.protocol);
                return ticket.copyWith(affectedClients: count);
              } catch (_) {
                return ticket;
              }
            }),
          );
          if (kDebugMode) {
            debugPrint('Massivas extraidas: ${rows.length}');
            if (rows.isNotEmpty) {
              debugPrint(
                'Primeira massiva extraida: ${const JsonEncoder.withIndent('  ').convert(rows.first)}',
                wrapWidth: 4096,
              );
            }
            debugPrint('Massivas parseadas: ${enriched.length}');
            if (enriched.isNotEmpty) {
              final first = enriched.first;
              debugPrint(
                'Primeira massiva parseada: protocol=${first.protocol} title=${first.title} status=${first.status} openedAt=${first.openedAt} expectedCloseAt=${first.expectedCloseAt} closedAt=${first.closedAt}',
              );
            }
          }
          return enriched;
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao listar massivas (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) {
          throw Exception(
            _networkFailureMessage(uri: uri, action: 'listar as massivas'),
          );
        }
      } on http.ClientException catch (e) {
        if (attempt == maxRetries) {
          throw Exception(
            _clientFailureMessage(
              uri: uri,
              action: 'listar as massivas',
              originalMessage: e.message,
            ),
          );
        }
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao listar massivas.');
  }

  // Complementa a listagem com a quantidade de afetados por protocolo.
  Future<int> fetchAffectedUsersCountByProtocol(int protocol) async {
    if (protocol <= 0) return 0;

    final endpointUrl = _resolveAffectedUsersByProtocolEndpoint(protocol);
    if (endpointUrl.trim().isEmpty) {
      throw Exception('Endpoint de afetados por protocolo nao configurado.');
    }

    final uri = Uri.parse(endpointUrl);

    debugPrint('➡️ [AFETADOS POR PROTOCOLO] GET $uri');

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _sendMassivaAuthorized(
          (headers) => _client.get(uri, headers: headers).timeout(timeout),
        );

        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (response.body.trim().isEmpty) return 0;
          final decoded = jsonDecode(response.body);
          final root = _safeMap(decoded);
          final data = _safeMap(root['data']);
          final impactedUsers = data['impactedUsers'];
          if (impactedUsers is List) {
            return impactedUsers.length;
          }
          return 0;
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao buscar afetados do protocolo $protocol (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) rethrow;
      } on http.ClientException catch (_) {
        if (attempt == maxRetries) rethrow;
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao buscar afetados por protocolo.');
  }

  // Encerra a massiva usando o assignmentId retornado pelo backend.
  Future<String> closeMassiva({
    required int assignmentId,
    required String description,
  }) async {
    if (assignmentId <= 0) {
      throw Exception('assignmentId invalido para encerrar a massiva.');
    }

    if (!isConfigured) {
      throw Exception('Endpoint de massiva nao configurado.');
    }

    final endpointUrl = _resolveCloseMassivaEndpoint();
    if (endpointUrl.trim().isEmpty) {
      throw Exception('Endpoint de encerramento de massiva nao configurado.');
    }

    final uri = Uri.parse(endpointUrl);
    final payload = <String, dynamic>{
      'assignmentId': assignmentId.toString(),
      'incidentStatusId': closeIncidentStatusId.toString(),
      'description': description,
      'progress': closeProgress.toString(),
      'priority': closePriority.toString(),
      'notificationTarget': closeNotificationTarget.toString(),
      'privateReport': closePrivateReport.toString(),
    };

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _sendMassivaAuthorizedJson(
          (headers) => _client
              .delete(uri, headers: headers, body: jsonEncode(payload))
              .timeout(timeout),
        );

        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (response.body.trim().isEmpty) {
            return 'Massiva encerrada com sucesso.';
          }
          final decoded = jsonDecode(response.body);
          final root = _safeMap(decoded);
          if (root['success'] == false) {
            throw Exception(
              'Erro ao encerrar massiva: ${_extractCloseMessages(root).join(' | ')}',
            );
          }
          final messages = _extractCloseMessages(root);
          return messages.isNotEmpty
              ? messages.join(' | ')
              : 'Massiva encerrada com sucesso.';
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao encerrar massiva (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) rethrow;
      } on http.ClientException catch (_) {
        if (attempt == maxRetries) rethrow;
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao encerrar a massiva.');
  }

  // Limpa a lista de afetados apos o encerramento para manter o backend coerente.
  Future<String> deleteAffectedUsersByProtocol(int protocol) async {
    if (protocol <= 0) {
      throw Exception('Protocolo invalido para limpar afetados.');
    }

    final endpointUrl = _resolveAffectedUsersByProtocolEndpoint(protocol);
    if (endpointUrl.trim().isEmpty) {
      throw Exception('Endpoint de afetados por protocolo nao configurado.');
    }

    final uri = Uri.parse(endpointUrl);

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _sendMassivaAuthorized(
          (headers) => _client.delete(uri, headers: headers).timeout(timeout),
        );

        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (response.body.trim().isEmpty) {
            return 'Lista de afetados removida com sucesso.';
          }
          final decoded = jsonDecode(response.body);
          final root = _safeMap(decoded);
          if (root['success'] == false) {
            throw Exception(
              'Erro ao limpar afetados: ${root['message'] ?? response.body}',
            );
          }
          return (root['message'] ?? 'Lista de afetados removida com sucesso.')
              .toString();
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao limpar afetados (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) rethrow;
      } on http.ClientException catch (_) {
        if (attempt == maxRetries) rethrow;
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao limpar afetados do protocolo.');
  }

  List<Map<String, dynamic>> _extractRows(dynamic decoded) {
    if (decoded is List) {
      return decoded.whereType<Map>().map(_safeMap).toList();
    }

    if (decoded is Map) {
      final root = _safeMap(decoded);
      final response = _safeMap(root['response']);
      final data = _safeMap(root['data']);
      final result = _safeMap(root['result']);

      if (response['data'] is List) {
        return (response['data'] as List)
            .whereType<Map>()
            .map(_safeMap)
            .toList();
      }

      final candidates = <dynamic>[
        root['data'],
        response['data'],
        result['data'],
        root['items'],
        root['content'],
        root['results'],
        root['massivas'],
        root['rows'],
        root['records'],
        data['items'],
        data['content'],
        data['results'],
        data['massivas'],
        data['rows'],
        data['records'],
        response['items'],
        response['content'],
        response['results'],
        response['massivas'],
        response['rows'],
        response['records'],
        result['items'],
        result['content'],
        result['results'],
        result['massivas'],
        result['rows'],
        result['records'],
      ];

      for (final candidate in candidates) {
        if (candidate is List) {
          return candidate.whereType<Map>().map(_safeMap).toList();
        }
      }

      // Alguns gateways retornam um único objeto em data/response/result.
      if (data.isNotEmpty) {
        return [data];
      }
      if (response.isNotEmpty) {
        return [response];
      }
      if (result.isNotEmpty) {
        return [result];
      }

      // Fallback para raiz quando ela própria já representa uma massiva.
      final protocolHint = root['protocol'] ?? root['protocolo'] ?? root['id'];
      if (protocolHint != null) {
        return [root];
      }
    }

    return const [];
  }

  Map<String, dynamic> _safeMap(dynamic raw) {
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    if (raw is List) {
      return {'data': raw};
    }
    return {};
  }

  List<String> _extractCloseMessages(Map<String, dynamic> json) {
    final rawMessages = json['messages'];
    if (rawMessages is List) {
      return rawMessages
          .whereType<Map>()
          .map((item) => item['message']?.toString() ?? '')
          .where((it) => it.trim().isNotEmpty)
          .toList();
    }
    return const [];
  }

  dynamic _sanitizePayload(dynamic raw) {
    if (raw is Map) {
      final sanitized = <String, dynamic>{};
      for (final entry in raw.entries) {
        final key = entry.key.toString();
        sanitized[key] =
            key == 'cookieString' ? '***' : _sanitizePayload(entry.value);
      }
      return sanitized;
    }
    if (raw is List) {
      return raw.map(_sanitizePayload).toList();
    }
    return raw;
  }

  String _networkFailureMessage({
    required Uri uri,
    required String action,
  }) {
    return 'Falha de rede ao tentar $action em $uri.';
  }

  String _clientFailureMessage({
    required Uri uri,
    required String action,
    required String originalMessage,
  }) {
    final normalized = originalMessage.trim().toLowerCase();
    if (normalized.contains('failed to fetch')) {
      return 'Nao foi possivel $action em $uri. '
          'No navegador, isso normalmente indica bloqueio de CORS, certificado ou indisponibilidade da API.';
    }

    return 'Nao foi possivel $action em $uri: $originalMessage';
  }
}