import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:nexaview/models/massiva_models.dart';
import 'package:nexaview/services/autoisp_auth_service.dart';

class AutoIspEventService {
  final String baseUrl;
  final AutoIspAuthService authService;
  final http.Client _client;
  final Duration timeout;
  final int maxRetries;

  AutoIspEventService({
    required this.baseUrl,
    required this.authService,
    http.Client? client,
    this.timeout = const Duration(seconds: 20),
    this.maxRetries = 3,
  }) : _client = client ?? http.Client();

  bool get isConfigured =>
      baseUrl.trim().isNotEmpty && authService.isConfigured;

  Future<List<AutoIspEvent>> fetchEvents({
    int page = 1,
    int perPage = 1000,
    List<String> adminStatuses = const ['new', 'acknowledged'],
  }) async {
    if (!isConfigured) {
      throw Exception('Endpoint do AutoISP nao configurado.');
    }

    final statuses = adminStatuses
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toSet()
        .toList();

    if (statuses.isEmpty) {
      return const [];
    }

    final merged = <int, AutoIspEvent>{};
    for (final status in statuses) {
      final rows = await _fetchEventsByStatus(
        page: page,
        perPage: perPage,
        adminStatus: status,
      );
      for (final row in rows) {
        merged[row.id] = row;
      }
    }

    return merged.values.toList();
  }

  Future<List<AutoIspEvent>> _fetchEventsByStatus({
    required int page,
    required int perPage,
    required String adminStatus,
  }) async {
    final filters = jsonEncode([
      {
        'field': 'admin_status',
        'op': '==',
        'value': adminStatus,
      },
    ]);

    final uri = Uri.parse(
      '$baseUrl?filters=${Uri.encodeQueryComponent(filters)}'
      '&page=$page&per_page=$perPage',
    );

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final headers = await authService.getAuthHeaders();
        debugPrint('GET $uri');
        final response =
            await _client.get(uri, headers: headers).timeout(timeout);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final decoded = jsonDecode(response.body);
          final rows = _extractRows(decoded);
          return rows.map(AutoIspEvent.fromJson).toList();
        }

        if (_isUnauthorized(response.statusCode)) {
          authService.invalidateToken();
          if (attempt < maxRetries) {
            await Future.delayed(Duration(milliseconds: 400 * attempt));
            continue;
          }
        }

        if (!_shouldRetryStatus(response.statusCode) || attempt == maxRetries) {
          throw Exception(
            'Erro ao listar eventos AutoISP (status ${response.statusCode}) para admin_status=$adminStatus: ${response.body}',
          );
        }
      } on SocketException catch (_) {
        if (attempt == maxRetries) rethrow;
      } on http.ClientException catch (_) {
        if (attempt == maxRetries) rethrow;
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    throw Exception(
      'Falha inesperada ao listar eventos AutoISP para admin_status=$adminStatus.',
    );
  }

  List<Map<String, dynamic>> _extractRows(dynamic decoded) {
    if (decoded is Map) {
      final root = _safeMap(decoded);
      final events = root['events'];
      if (events is List) {
        return events.whereType<Map>().map(_safeMap).toList();
      }
    }

    if (decoded is List) {
      return decoded.whereType<Map>().map(_safeMap).toList();
    }

    return const [];
  }

  Map<String, dynamic> _safeMap(dynamic raw) {
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    return {};
  }

  bool _shouldRetryStatus(int code) {
    return code == 429 || code >= 500 || _isUnauthorized(code);
  }

  bool _isUnauthorized(int code) {
    return code == 401 || code == 403;
  }
}
