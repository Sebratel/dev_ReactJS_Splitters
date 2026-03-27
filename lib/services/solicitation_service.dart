import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/solicitation_model.dart';
import '../services/auth_service.dart';

class SolicitationService {
  final String baseUrl;
  final String token;

  SolicitationService({
    required this.baseUrl,
    required this.token,
  });

  Future<List<SolicitationModel>> fetchByAuthenticationId(
    int authenticationId,
  ) async {
    final headers = {
      'Authorization': 'Bearer $token',
    };

    final uri = Uri.parse(
      '$baseUrl/api/v1/splitters/listarSolicitacoes/'
      '$authenticationId',
    );

    debugPrint('GET $uri');
    debugPrint('Headers: ${_sanitizeHeaders(headers)}');

    final response = await http.get(uri, headers: headers);

    debugPrint('Status: ${response.statusCode}');

    if (response.statusCode != 200) {
      throw Exception(
        'Erro ao buscar solicitacoes '
        '(status ${response.statusCode})',
      );
    }

    final decoded = jsonDecode(response.body);

    final List data = decoded['response']?['data'] ?? [];

    return data
        .map<SolicitationModel>(
          (e) => SolicitationModel.fromJson(e),
        )
        .toList();
  }

  Map<String, String> _sanitizeHeaders(Map<String, String> headers) {
    final sanitized = Map<String, String>.from(headers);
    if (sanitized.containsKey('Authorization')) {
      sanitized['Authorization'] = 'Bearer ***';
    }
    return sanitized;
  }
}
