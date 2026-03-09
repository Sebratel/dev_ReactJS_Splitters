import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:nexaview/models/massiva_models.dart';
import 'package:nexaview/services/auth_service.dart';

class MassivaEllevenService {
  final String endpoint;
  final String listEndpoint;
  final String listBearerToken;
  final String listHeaderName;
  final String listHeaderValue;
  final AuthService authService;
  final http.Client _client;
  final Duration timeout;
  final int maxRetries;
  final Map<String, String> _hostTokenCache = {};
  final Map<String, DateTime> _hostTokenExpiry = {};

  MassivaEllevenService({
    required this.endpoint,
    required this.listEndpoint,
    this.listBearerToken = '',
    this.listHeaderName = '',
    this.listHeaderValue = '',
    required this.authService,
    http.Client? client,
    this.timeout = const Duration(seconds: 20),
    this.maxRetries = 3,
  }) : _client = client ?? http.Client() {
    debugPrint(
      'MassivaEllevenService config: '
      'listEndpoint=$listEndpoint '
      'hasListBearer=${listBearerToken.trim().isNotEmpty} '
      'listHeaderName=${listHeaderName.trim().isEmpty ? '(none)' : listHeaderName.trim()} '
      'hasListHeaderValue=${listHeaderValue.trim().isNotEmpty}',
    );
  }

  bool get isConfigured => endpoint.trim().isNotEmpty;
  bool get isListConfigured => listEndpoint.trim().isNotEmpty;

  Future<EllevenMassivaResponse> openMassiva({
    required MassivaIncidentRequest incident,
    required List<int> authenticationIds,
    required bool individualTickets,
  }) async {
    if (!isConfigured) {
      throw Exception('Endpoint de massiva do Elleven não configurado.');
    }

    final uri = Uri.parse(endpoint);
    final headers = await _getAuthHeadersForUri(uri);
    final payload = authenticationIds.isEmpty
        ? incident.toJson()
        : {
            'incident': incident.toJson(),
            'authenticationIds': authenticationIds,
            'strategy': individualTickets ? 'bulk_individual' : 'single_massive',
          };

    debugPrint('➡️ POST $uri');

    if (kDebugMode) {
      final prettyPayload = const JsonEncoder.withIndent('  ').convert(payload);
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
          debugPrint(
            'Resposta Abrir Massiva: status=${response.statusCode} body=${response.body}',
            wrapWidth: 4096,
          );
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = response.body.trim().isEmpty
              ? <String, dynamic>{}
              : jsonDecode(response.body);
          final asMap = _safeMap(decoded);
          return EllevenMassivaResponse.fromJson(asMap);
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

  bool _shouldRetryStatus(int code) {
    return code == 429 || code >= 500;
  }

  Future<List<MassivaTicket>> fetchMassivas() async {
    if (!isListConfigured) {
      throw Exception('Endpoint de listagem de massivas não configurado.');
    }

    final uri = _buildMassivaListUri();
    final headers = {
      ...await _getListAuthHeaders(uri),
      'Accept': '*/*',
    };

    debugPrint('➡️ GET $uri');

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response =
            await _client.get(uri, headers: headers).timeout(timeout);

        if (kDebugMode) {
          debugPrint(
            'Resposta Listar Massivas: status=${response.statusCode} body=${response.body}',
            wrapWidth: 4096,
          );
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = jsonDecode(response.body);
          final rows = _extractRows(decoded);
          final parsed = rows.map(MassivaTicket.fromJson).toList();
          if (kDebugMode) {
            debugPrint('Massivas extraidas: ${rows.length}');
            if (rows.isNotEmpty) {
              debugPrint(
                'Primeira massiva extraida: ${const JsonEncoder.withIndent('  ').convert(rows.first)}',
                wrapWidth: 4096,
              );
            }
            debugPrint('Massivas parseadas: ${parsed.length}');
            if (parsed.isNotEmpty) {
              final first = parsed.first;
              debugPrint(
                'Primeira massiva parseada: protocol=${first.protocol} title=${first.title} status=${first.status} openedAt=${first.openedAt} closedAt=${first.closedAt}',
              );
            }
          }
          return parsed;
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao listar massivas (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) rethrow;
      } on http.ClientException catch (_) {
        if (attempt == maxRetries) rethrow;
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao listar massivas.');
  }

  Future<Map<String, String>> _getAuthHeadersForUri(Uri targetUri) async {
    final authUri = Uri.parse(authService.tokenUrl);
    if (authUri.host == targetUri.host) {
      return authService.getAuthHeaders();
    }

    final token = await _ensureTokenForHost(targetUri);
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }

  Future<Map<String, String>> _getListAuthHeaders(Uri targetUri) async {
    final extraHeaders = _getListExtraHeaders();
    final explicitBearer = listBearerToken.trim();
    if (explicitBearer.isNotEmpty) {
      return {
        'Authorization': 'Bearer $explicitBearer',
        'Content-Type': 'application/json',
        ...extraHeaders,
      };
    }

    if (extraHeaders.isNotEmpty || _looksLikeWebhookEndpoint(targetUri)) {
      return {
        'Content-Type': 'application/json',
        ...extraHeaders,
      };
    }

    return {
      ...await _getAuthHeadersForUri(targetUri),
      ...extraHeaders,
    };
  }

  Map<String, String> _getListExtraHeaders() {
    final name = listHeaderName.trim();
    final value = listHeaderValue.trim();
    if (name.isEmpty || value.isEmpty) {
      return const {};
    }

    return {name: value};
  }

  bool _looksLikeWebhookEndpoint(Uri targetUri) {
    final path = targetUri.path.toLowerCase();
    return path.contains('/webhook');
  }

  Future<String> _ensureTokenForHost(Uri targetUri) async {
    final cacheKey = targetUri.host;
    final cachedToken = _hostTokenCache[cacheKey];
    final expiresAt = _hostTokenExpiry[cacheKey];
    final now = DateTime.now();

    if (cachedToken != null &&
        expiresAt != null &&
        now.isBefore(expiresAt.subtract(const Duration(seconds: 30)))) {
      return cachedToken;
    }

    final tokenUri = targetUri.replace(
      port: 45700,
      path: '/connect/token',
      queryParameters: const {},
    );

    final response = await _client
        .post(
          tokenUri,
          headers: const {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: {
            'client_id': authService.clientId,
            'client_secret': authService.clientSecret,
            'syndata': authService.syndata,
            'grant_type': authService.grantType,
            'scope': authService.scope,
          },
        )
        .timeout(timeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Erro ao autenticar no host ${targetUri.host} (status ${response.statusCode}).',
      );
    }

    final decoded = jsonDecode(response.body);
    final root = _safeMap(decoded);
    final token = root['access_token']?.toString();
    final expiresIn = int.tryParse((root['expires_in'] ?? '3600').toString()) ?? 3600;

    if (token == null || token.trim().isEmpty) {
      throw Exception('Host ${targetUri.host} não retornou access_token válido.');
    }

    _hostTokenCache[cacheKey] = token;
    _hostTokenExpiry[cacheKey] = now.add(Duration(seconds: expiresIn));

    return token;
  }

  Uri _buildMassivaListUri() {
    final baseUri = Uri.parse(listEndpoint);
    final orderBy = jsonEncode([
      {'PropertyName': 'id', 'Dir': 'd'},
    ]);
    final filter = jsonEncode({
      'Connector': 'And',
      'Values': [
        {
          'PropertyName': 'incidentTypeId',
          'Value': '302',
          'Operation': 'equals',
        },
      ],
    });

    return baseUri.replace(
      queryParameters: {
        ...baseUri.queryParameters,
        'OrderBy': orderBy,
        'Page': '1',
        'PageSize': '20',
        'Filter': filter,
        'slaType': 'null',
      },
    );
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
}
