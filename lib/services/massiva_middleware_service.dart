import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:nexaview/models/massiva_models.dart';
import 'package:nexaview/services/auth_service.dart';

class MassivaMiddlewareService {
  final String baseUrl;
  final AuthService authService;
  final http.Client _client;
  final Duration timeout;
  final int maxRetries;

  MassivaMiddlewareService({
    required this.baseUrl,
    required this.authService,
    http.Client? client,
    this.timeout = const Duration(seconds: 20),
    this.maxRetries = 3,
  }) : _client = client ?? http.Client();

  bool get isConfigured => baseUrl.trim().isNotEmpty;

  Future<MiddlewareFilterResponse> filterAffectedClients(
    MassivaIncidentRequest request,
  ) async {
    if (!isConfigured) {
      throw Exception('Endpoint do middleware não configurado.');
    }

    final uri = Uri.parse('$baseUrl/massiva/filter');
    final headers = await authService.getAuthHeaders();
    final body = jsonEncode(request.toJson());

    debugPrint('➡️ POST $uri');

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await _client
            .post(uri, headers: headers, body: body)
            .timeout(timeout);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = jsonDecode(response.body) as Map<String, dynamic>;
          return MiddlewareFilterResponse.fromJson(decoded);
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro no middleware (status ${response.statusCode}): ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) rethrow;
      } on http.ClientException catch (_) {
        if (attempt == maxRetries) rethrow;
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception('Falha inesperada ao consultar middleware.');
  }

  bool _shouldRetryStatus(int code) {
    return code == 429 || code >= 500;
  }
}
