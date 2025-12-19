import 'dart:convert';
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

  // STORAGE KEYS
  static const _kAccessToken = "access_token";
  static const _kExpiresAt = "access_token_expires_at";

  // ✅ Headers padrão para API JSON
  Future<Map<String, String>> getAuthHeaders() async {
    final token = await _ensureValidToken();
    return {
      "Authorization": "Bearer $token",
      "Content-Type": "application/json",
    };
  }

  // ✅ Garante token válido
  Future<String> _ensureValidToken() async {
    final prefs = await SharedPreferences.getInstance();
    final savedToken = prefs.getString(_kAccessToken);
    final expiresAt = prefs.getInt(_kExpiresAt) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;

    if (savedToken != null && now < expiresAt - 30000) {
      return savedToken;
    }

    return await _fetchToken();
  }

  // ✅ Chama o endpoint /connect/token
  Future<String> _fetchToken() async {
    print("🔵 Solicitando novo token...");

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

    print("🔵 STATUS TOKEN: ${response.statusCode}");
    print("🔵 BODY: ${response.body}");

    if (response.statusCode != 200) {
      throw Exception("Erro ao obter token: ${response.body}");
    }

    Map json;
    try {
      json = jsonDecode(response.body);
    } catch (_) {
      throw Exception("Resposta inválida do servidor ao obter token.");
    }

    final token = json["access_token"];
    final expiresIn = (json["expires_in"] ?? 3600).toInt();

    final expiresAt =
        DateTime.now().add(Duration(seconds: expiresIn)).millisecondsSinceEpoch;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kAccessToken, token);
    await prefs.setInt(_kExpiresAt, expiresAt);

    print("✅ Novo token salvo. Expira em $expiresIn segundos.");

    return token;
  }

  // ✅ Força renovação manual
  Future<void> forceRefresh() async {
    await _fetchToken();
  }

  // ✅ Logout
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kAccessToken);
    await prefs.remove(_kExpiresAt);
  }
}
