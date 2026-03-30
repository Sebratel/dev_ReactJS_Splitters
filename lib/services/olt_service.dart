import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:nexaview/utils/web_utils.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../models/olt_model.dart';
import 'package:flutter/foundation.dart';

class OltService {
  final String token;
  static const _endpoint =
      'https://api-gateway-bff.sebratel.net.br/api/v1/splitters/listarOlts';

  OltService(this.token);

  final Map<String, OltModel> _oltByCode = {};
  bool get isLoaded => _oltByCode.isNotEmpty;

  Future<void> loadOlts() async {
    final headers = {'Authorization': 'Bearer $token'};
    print("Consultando OLTs... com headers $headers");
    final response = await http.get(Uri.parse(_endpoint), headers: headers);

    if (response.statusCode != 200) {
      throw Exception('Erro ao buscar OLTs');
    }

    if(response.statusCode == 401) {
      debugPrint('401 ao buscar OLTs, token pode estar expirado');
        final authBox = await Hive.openBox('auth_cache');
        await authBox.delete('googleIdToken');
        WebUtils.redirect("https://sebratel-hub.web.app");
        return;
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
