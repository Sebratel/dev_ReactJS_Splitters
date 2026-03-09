import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class AutoIspAuthService {
  final String authEndpoint;
  final String username;
  final String password;
  final http.Client _client;
  final Duration timeout;

  String? _token;
  DateTime? _expiresAt;

  AutoIspAuthService({
    required this.authEndpoint,
    required this.username,
    required this.password,
    http.Client? client,
    this.timeout = const Duration(seconds: 20),
  }) : _client = client ?? http.Client();

  bool get isConfigured =>
      authEndpoint.trim().isNotEmpty &&
      username.trim().isNotEmpty &&
      password.trim().isNotEmpty;

  Future<String> ensureValidToken() async {
    if (!isConfigured) {
      throw Exception('Credenciais/token do AutoISP nao configurados.');
    }

    if (_token != null &&
        _expiresAt != null &&
        DateTime.now()
            .isBefore(_expiresAt!.subtract(const Duration(seconds: 30)))) {
      return _token!;
    }

    return _requestToken();
  }

  Future<Map<String, String>> getAuthHeaders() async {
    final token = await ensureValidToken();
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }

  void invalidateToken() {
    _token = null;
    _expiresAt = null;
  }

  Future<String> _requestToken() async {
    final uri = Uri.parse(authEndpoint);
    debugPrint('POST $uri');

    final response = await _client
        .post(
          uri,
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({
            'username': username,
            'password': password,
          }),
        )
        .timeout(timeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Falha ao autenticar no AutoISP (status ${response.statusCode}).',
      );
    }

    final decoded = jsonDecode(response.body);
    final root = _safeMap(decoded);

    final token = (root['token'] ??
            root['access_token'] ??
            root['jwt'] ??
            root['response']?['token'])
        ?.toString();

    if (token == null || token.trim().isEmpty) {
      throw Exception('AutoISP nao retornou token valido.');
    }

    final expiresInRaw = root['expires_in'] ??
        root['expiresIn'] ??
        root['response']?['expires_in'];
    final expiresInSeconds = int.tryParse((expiresInRaw ?? '').toString());

    _token = token;
    _expiresAt = DateTime.now().add(
      Duration(
        seconds: expiresInSeconds != null && expiresInSeconds > 0
            ? expiresInSeconds
            : 1800,
      ),
    );

    return token;
  }

  Map<String, dynamic> _safeMap(dynamic raw) {
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    return {};
  }
}
