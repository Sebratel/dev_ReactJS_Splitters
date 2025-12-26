// lib/services/splitter_service.dart
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:hive_flutter/hive_flutter.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:nexaview/services/auth_service.dart';
import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class SplitterService {
  final AuthService auth;
  final String splittersEndpoint;
  final String clientesEndpoint;

  static const int chunkSize = 5000;
  static const Duration cacheTtl = Duration(hours: 6);

  static const _boxSplitters = "splitters_all";
  static const _boxClientesIndex = "clientes_index";
  static const _boxOcupacoes = "ocupacoes_splitter";
  static const _boxClientesPorSplitter = "clientes_por_splitter";

  static String _chunkBoxName(int i) => "clientes_chunk_$i";

  // Box estáticas
  static late Box boxSplitters;
  static late Box boxClientesIndex;
  static late Box boxOcupacoes;
  static late Box boxClientesPorSplitter;

  // Cache em memória
  Map<String, int> ocupacoesCache = {};
  Map<String, List<Map>> clientesPorSplitterCache = {};

  SplitterService({
    required this.auth,
    required this.splittersEndpoint,
    required this.clientesEndpoint,
  });

  // ===================================================================
  // ✅ Inicialização (main)
  // ===================================================================
  static Future<void> initHive() async {
    boxSplitters = await Hive.openBox(_boxSplitters);
    boxClientesIndex = await Hive.openBox(_boxClientesIndex);
    boxOcupacoes = await Hive.openBox(_boxOcupacoes);
    boxClientesPorSplitter = await Hive.openBox(_boxClientesPorSplitter);
  }

  // Utils
  bool _isExpired(DateTime? at) {
    if (at == null) return true;
    return DateTime.now().isAfter(at.add(cacheTtl));
  }

  bool clientesCacheValido() {
    final updatedAt = boxClientesIndex.get("updatedAt") as int?;
    if (updatedAt == null) return false;

    final lastUpdate = DateTime.fromMillisecondsSinceEpoch(updatedAt);
    return DateTime.now().difference(lastUpdate) < cacheTtl;
  }

  Future<http.Response> _authedGet(String url) async {
    final h = await auth.getAuthHeaders();
    var r = await http.get(Uri.parse(url), headers: h);

    if (r.statusCode == 401) {
      await auth.forceRefresh();
      final h2 = await auth.getAuthHeaders();
      r = await http.get(Uri.parse(url), headers: h2);
    }
    return r;
  }

  // ===================================================================
  // ✅ SPLITTERS
// ===================================================================
  Future<List<SplitterModel>> fetchSplitters() async {
    await boxSplitters.clear(); // 👈 APENAS PARA TESTE
    final saved = boxSplitters.get("data") as List?;
    final updatedAt = boxSplitters.get("updatedAt") as int?;

    // 🔹 Usa cache se não estiver expirado
    if (saved != null &&
        updatedAt != null &&
        !_isExpired(DateTime.fromMillisecondsSinceEpoch(updatedAt))) {
      return saved
          .map((e) => SplitterModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }

    // 🔹 Busca na API
    final r = await _authedGet(splittersEndpoint);
    if (r.statusCode != 200) throw Exception("Erro splitters");

    // 🔹 Decodifica JSON
    final body = jsonDecode(r.body);

    // 🔹 Aqui está a lista real de splitters
    final List list = body["response"] as List;

    // 🔹 Salva cache
    await boxSplitters.put("data", list);
    await boxSplitters.put("updatedAt", DateTime.now().millisecondsSinceEpoch);

    // 🔹 Converte para model
    return list
        .map((e) => SplitterModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  // ===================================================================
  // ✅ CLIENTES – CHUNKS + ÍNDICE GLOBAL POR SPLITTER
  // ===================================================================
  Future<int> refreshClientesCache({
    void Function(int loaded, int total)? onProgress,
    void Function(Map<String, int> snapshot)? onSnapshot, // 🔥 NOVO
  }) async {
    final r = await _authedGet(clientesEndpoint);
    if (r.statusCode != 200) throw Exception("Erro clientes");

    final body = jsonDecode(r.body);
    final response = body["response"] as List;

    final all = response.map((e) => Map<String, dynamic>.from(e)).toList();
    final total = all.length;

    final chunks = (total + chunkSize - 1) ~/ chunkSize;
    final oldChunks = boxClientesIndex.get("chunks") as int? ?? 0;

    // ✅ limpa chunks antigos
    for (int i = 0; i < oldChunks; i++) {
      final name = _chunkBoxName(i);
      if (Hive.isBoxOpen(name)) {
        await Hive.box(name).deleteFromDisk();
      } else {
        final b = await Hive.openBox(name);
        await b.deleteFromDisk();
      }
    }

    // ✅ limpa índice global antigo
    await boxClientesPorSplitter.clear();
    clientesPorSplitterCache.clear();

    // ✅ processa chunks E cria índice global
    Map<String, int> occTemp = {};
    Map<String, List<Map>> indexTemp = {};

    for (int i = 0; i < chunks; i++) {
      final start = i * chunkSize;
      final end = min(start + chunkSize, total);
      final slice = all.sublist(start, end);

      // salva chunk APENAS em debug (evita IO pesado em produção)
      if (kDebugMode) {
        final box = await Hive.openBox(_chunkBoxName(i));
        await box.put("data", slice);
        await box.close();
      }

      // processa índice global + ocupação
      for (final m in slice) {
        final code = (m["splitter"]?["integrationCode"] ??
                m["splitterCode"] ??
                m["integrationCodeMap"] ??
                m["integrationCode"])
            ?.toString();

        if (code == null) continue;

        occTemp[code] = (occTemp[code] ?? 0) + 1;
        indexTemp.putIfAbsent(code, () => []);
        indexTemp[code]!.add(m);
      }

      // 🔹 progresso visual
      onProgress?.call(i + 1, chunks);

      // 🔥 snapshot incremental (ESSENCIAL)
      onSnapshot?.call(
        indexTemp.map((k, v) => MapEntry(k, v.length)),
      );
    }

    // salvar meta
    await boxClientesIndex.put("total", total);
    await boxClientesIndex.put("chunks", chunks);
    await boxClientesIndex.put(
        "updatedAt", DateTime.now().millisecondsSinceEpoch);

    // salvar ocupações
    ocupacoesCache = occTemp;
    await boxOcupacoes.put("map", occTemp);

    // salvar índice global
    clientesPorSplitterCache = indexTemp;
    await boxClientesPorSplitter.put("map", indexTemp);

    final box = Hive.box(_boxClientesIndex);
    debugPrint('📦 HIVE clientes_index keys: ${box.keys}');

    return total;
  }

  // ===================================================================
  // ✅ OBTÉM OCUPAÇÃO (instantâneo)
  // ===================================================================
  /// ✅ Fonte única de verdade para ocupação
  /// Conta PORTAS ocupadas (não clientes)
  /// 🔥 Fonte única de verdade
  /// Ocupação REAL = quantidade de clientes
  Future<int> getOcupacao(String splitterCode) async {
    final clientes = await getClientesInstant(splitterCode);
    return clientes.length;
  }

  Future<int> getOcupacaoReal(String code) async {
    final clientes = await getClientesInstant(code);
    return clientes.length;
  }

  // ===================================================================
  // ✅ CLIENTES DO SPLITTER — AGORA INSTANTÂNEO
// ===================================================================
  Future<List<ClienteModel>> getClientesInstant(String code) async {
    if (clientesPorSplitterCache.isEmpty) {
      final raw =
          (boxClientesPorSplitter.get("map") as Map?)?.cast<String, List>() ??
              {};
      clientesPorSplitterCache = raw.map((k, v) => MapEntry(k, v.cast<Map>()));
    }

    final list = clientesPorSplitterCache[code] ?? [];

    // 🔍 DEBUG DEFINITIVO — ISSO VAI MOSTRAR O PROBLEMA
    debugPrint("👥 CLIENTES DO SPLITTER $code (${list.length} clientes):\n"
        "${const JsonEncoder.withIndent('  ').convert(
      list
          .map((e) => {
                'id': e['id'],
                'port': e['splitter']?['port'], // ✅ AQUI
                'name': e['client']?['name'], // ✅ AQUI
                'splitterCode': e['splitter']?['code']
              })
          .toList(),
    )}");

    return list
        .map((e) => ClienteModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  // ===================================================================
// ✅ RETORNA APENAS A QUANTIDADE DE CLIENTES DE UM SPLITTER (CACHE)
// ===================================================================
  int getClientesCountFromCache(String splitterCode) {
    // Prioriza cache em memória
    if (clientesPorSplitterCache.isNotEmpty) {
      return clientesPorSplitterCache[splitterCode]?.length ?? 0;
    }

    // Fallback: cache persistido no Hive
    final raw =
        (boxClientesPorSplitter.get("map") as Map?)?.cast<String, List>() ?? {};

    return raw[splitterCode]?.length ?? 0;
  }

  /// 🔒 Snapshot IMUTÁVEL para HomePage
  Map<String, int> getOcupacaoSnapshot() {
    // 🔒 garante que o cache em memória esteja carregado
    if (clientesPorSplitterCache.isEmpty) {
      final raw =
          (boxClientesPorSplitter.get("map") as Map?)?.cast<String, List>() ??
              {};

      clientesPorSplitterCache = raw.map((k, v) => MapEntry(k, v.cast<Map>()));
    }

    // 🔒 snapshot imutável
    return clientesPorSplitterCache.map(
      (k, v) => MapEntry(k, v.length),
    );
  }

  Future<String?> getStreetFromLatLng(double lat, double lng) async {
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?lat=$lat&lon=$lng&format=json&addressdetails=1',
      );

      final response = await http.get(
        url,
        headers: {
          // 🔥 obrigatório para o Nominatim
          'User-Agent': 'NexaView/1.0 (contato@sebratel.com.br)',
        },
      );

      if (response.statusCode != 200) return null;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final address = data['address'] as Map<String, dynamic>?;

      if (address == null) return null;

      // Prioridade de retorno
      return address['road'] ??
          address['street'] ??
          address['pedestrian'] ??
          address['residential'];
    } catch (e) {
      debugPrint('❌ Erro ao resolver endereço: $e');
      return null;
    }
  }

  /// Retorna o índice completo de clientes por splitter
  /// Map<splitterCode, List<ClienteModel>>
  Map<String, List<ClienteModel>> getClientesIndex() {
    final box = Hive.box(boxClientesPorSplitter.name);

    final raw = box.get("map");
    if (raw is! Map) return {};

    final Map<String, List<ClienteModel>> result = {};

    raw.forEach((key, value) {
      if (value is List) {
        result[key.toString()] = value
            .whereType<Map>()
            .map(
              (e) => ClienteModel.fromJson(
                Map<String, dynamic>.from(e),
              ),
            )
            .toList();
      }
    });

    return result;
  }
}
