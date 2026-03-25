import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  final String tokenUrl = "https://erp.sebratel.net.br:45700/connect/token";

  String clientId;
  String clientSecret;
  String syndata;
  String grantType;
  String scope;

  AuthService({
    required this.clientId,
    required this.clientSecret,
    required this.syndata,
    required this.grantType,
    required this.scope,
  });

  bool get isConfigured =>
      clientId.trim().isNotEmpty &&
      clientSecret.trim().isNotEmpty &&
      syndata.trim().isNotEmpty &&
      grantType.trim().isNotEmpty &&
      scope.trim().isNotEmpty;

  // STORAGE KEYS
  static const _kAccessToken = "access_token";
  static const _kExpiresAt = "access_token_expires_at";

  // âœ… Headers padrÃ£o para API JSON
  Future<Map<String, String>> getAuthHeaders() async {
    final token = await ensureValidToken();
    return {
      "Authorization": "Bearer $token",
      "Content-Type": "application/json",
    };
  }

  // âœ… Garante token vÃ¡lido
  Future<String> ensureValidToken() async {
    final prefs = await SharedPreferences.getInstance();
    final savedToken = prefs.getString(_kAccessToken);
    final expiresAt = prefs.getInt(_kExpiresAt) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;

    if (savedToken != null && now < expiresAt - 30000) {
      return savedToken;
    }

    return await _fetchToken();
  }

  // âœ… Chama o endpoint /connect/token
  Future<String> _fetchToken() async {
    if (!isConfigured) {
      throw Exception("Credenciais do ERP nao configuradas.");
    }

    debugPrint("Solicitando novo token... ELEVEN");

    final response = await http.post(
      Uri.parse(tokenUrl),
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: {
        "client_id": clientId,
        "client_secret": clientSecret,
        "syndata": syndata,
        "grant_type": grantType,
        "scope": scope,
      },
    );

    debugPrint("STATUS TOKEN: ${response.statusCode}");
    debugPrint(
      "TOKEN content-type: ${response.headers['content-type'] ?? '(sem content-type)'}",
    );

    if (response.statusCode != 200) {
      throw Exception("Erro ao obter token (status ${response.statusCode}).");
    }

    Map json;
    try {
      json = jsonDecode(response.body);
    } catch (_) {
      final preview = _bodyPreview(response.body);
      debugPrint("TOKEN body preview: $preview");
      throw Exception("Resposta invalida do servidor ao obter token.");
    }

    final token = json["access_token"];
    final expiresIn = (json["expires_in"] ?? 3600).toInt();

    final expiresAt =
        DateTime.now().add(Duration(seconds: expiresIn)).millisecondsSinceEpoch;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kAccessToken, token);
    await prefs.setInt(_kExpiresAt, expiresAt);

    debugPrint("Novo token salvo. Expira em $expiresIn segundos.");

    return token;
  }

  // âœ… ForÃ§a renovaÃ§Ã£o manual
  Future<void> forceRefresh() async {
    await _fetchToken();
  }

  // âœ… Logout
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kAccessToken);
    await prefs.remove(_kExpiresAt);
  }

  String _bodyPreview(String body, {int maxLength = 180}) {
    final normalized = body.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return '${normalized.substring(0, maxLength)}...';
  }
}
