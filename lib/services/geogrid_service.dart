// lib/services/geogrid_service.dart

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:nexaview/models/porta_geogrid_model.dart';

class GeoGridService {
  final String baseUrl;
  final String apiKey;

  /// Cache por splitter
  final Map<String, Map<int, PortaGeoGrid>> _cachePorSplitter = {};
  final Map<String, String> _cacheNomeCliente = {};

  GeoGridService({
    required this.baseUrl,
    required this.apiKey,
  });

// lib/services/geogrid_service.dart

  void clearCache({String? splitterIntegrationCode}) {
    if (splitterIntegrationCode != null) {
      _cachePorSplitter.remove(splitterIntegrationCode);
    } else {
      _cachePorSplitter.clear();
      _cacheNomeCliente.clear();
    }
  }

  // =====================================================
  // BUSCA RESERVAS POR SPLITTER (DETALHE)
  // =====================================================
  Future<Map<int, PortaGeoGrid>> fetchReservasPorSplitter(
    String splitterIntegrationCode,
  ) async {
    // cache por splitter
    if (_cachePorSplitter.containsKey(splitterIntegrationCode)) {
      return _cachePorSplitter[splitterIntegrationCode]!;
    }

    final url = Uri.parse(
      '$baseUrl/equipamentos/$splitterIntegrationCode/portas',
    );
    print("Consultando portas para o splitter $splitterIntegrationCode...");
    final response = await http.get(
      url,
      headers: {
        'Accept': 'application/json',
        'api-key': apiKey,
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Erro ao buscar portas na GeoGrid');
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final portas = body['portas'] as List? ?? [];

    final Map<int, PortaGeoGrid> result = {};

    for (final raw in portas) {
      final porta = PortaGeoGrid.fromGeoGrid(raw);

      if (porta.porta <= 0) continue;

      // consolidacao por porta:
      // prioriza reserva com cadeado (reserva sem atendimento)
      if (!result.containsKey(porta.porta)) {
        result[porta.porta] = porta;
      } else if (porta.hasReservaComCadeado) {
        result[porta.porta] = porta;
      }
    }

    _cachePorSplitter[splitterIntegrationCode] = result;
    return result;
  }

  Future<String?> fetchClienteNomeById(String idCliente) async {
    final id = idCliente.trim();
    if (id.isEmpty) return null;

    if (_cacheNomeCliente.containsKey(id)) {
      return _cacheNomeCliente[id];
    }
    print("Consultando nome do cliente para o ID: $id");
    final url = Uri.parse('$baseUrl/clientes/$id');
    final response = await http.get(
      url,
      headers: {
        'Accept': 'application/json',
        'api-key': apiKey,
      },
    );

    if (response.statusCode != 200) {
      return null;
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final dados = body['dados'] as Map<String, dynamic>? ?? {};
    final nome = dados['nome']?.toString().trim();

    if (nome == null || nome.isEmpty) return null;

    _cacheNomeCliente[id] = nome;
    return nome;
  }
}

