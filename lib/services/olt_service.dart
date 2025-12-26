import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/olt_model.dart';
import '../services/auth_service.dart';
import 'package:flutter/foundation.dart';

class OltService {
  final AuthService auth;
  static const _endpoint =
      'https://erp.sebratel.net.br:45715/external/map/olt/all';

  OltService(this.auth);

  final Map<String, OltModel> _oltByCode = {};
  bool get isLoaded => _oltByCode.isNotEmpty;

  Future<void> loadOlts() async {
    final headers = await auth.getAuthHeaders();
    final response = await http.get(Uri.parse(_endpoint), headers: headers);

    if (response.statusCode != 200) {
      throw Exception('Erro ao buscar OLTs');
    }

    final List list = jsonDecode(response.body)['response'];

    _oltByCode.clear();

    for (final item in list) {
      final olt = OltModel.fromJson(item);

      if (olt.code.isNotEmpty) {
        _oltByCode[olt.code] = olt;
      }
    }

    debugPrint('✅ OLTs carregadas por code: ${_oltByCode.length}');
  }

  /// 🔗 Splitter.oltCode -> OLT.code
  OltModel? getBySplitterCode(String? splitterOltCode) {
    if (splitterOltCode == null || splitterOltCode.isEmpty) return null;
    return _oltByCode[splitterOltCode];
  }
}
