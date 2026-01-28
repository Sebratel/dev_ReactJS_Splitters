// lib/services/splitter_service.dart
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:hive_flutter/hive_flutter.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:nexaview/services/auth_service.dart';
import 'package:flutter/foundation.dart';

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
  static const _clientesReadyKey = "clientes_ready";
  static const _boxStreetCache = "street_cache";
  static late Box boxStreetCache;

  static String _chunkBoxName(int i) => "clientes_chunk_$i";

  // Box estáticas
  static late Box boxSplitters;
  static late Box boxClientesIndex;
  static late Box boxOcupacoes;
  static late Box boxClientesPorSplitter;

  int? getLastClientesUpdate() {
    return boxClientesIndex.get("updatedAt") as int?;
  }

  // Cache em memória
  Map<String, int> ocupacoesCache = {};
  Map<String, List<Map>> clientesPorSplitterCache = {};

  Map<String, dynamic> _safeMap(dynamic raw) {
    if (raw is Map) {
      return raw.map(
        (key, value) => MapEntry(key.toString(), value),
      );
    }
    return {};
  }

// 🔥 NOTIFIERS REATIVOS POR SPLITTER
  final Map<String, ValueNotifier<List<ClienteModel>>> _clientesNotifier = {};

  List<ClienteModel> getClientesInstantSync(String code) {
    if (clientesPorSplitterCache.isEmpty) {
      clientesPorSplitterCache = _readClientesMapFromHive();
    }

    final list = clientesPorSplitterCache[code] ?? [];

    return list.map((e) => ClienteModel.fromJson(_safeMap(e))).toList();
  }

// 🔥 OBSERVADOR REATIVO DE CLIENTES POR SPLITTER
  ValueNotifier<List<ClienteModel>> watchClientes(String splitterCode) {
    return _clientesNotifier.putIfAbsent(
      splitterCode,
      () => ValueNotifier<List<ClienteModel>>(
        getClientesInstantSync(splitterCode),
      ),
    );
  }

  Map<String, List<Map<String, dynamic>>> _readClientesMapFromHive() {
    final raw = boxClientesPorSplitter.get("map");

    final Map<String, List<Map<String, dynamic>>> safe = {};

    if (raw is Map) {
      raw.forEach((key, value) {
        if (key != null && value is List) {
          safe[key.toString()] = value
              .whereType<Map>()
              .map((e) => _safeMap(e)) // ✅ CORRETO
              .toList();
        }
      });
    }

    return safe;
  }

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
    boxStreetCache = await Hive.openBox(_boxStreetCache);
  }

  bool clientesJaCarregados() {
    final ready = boxClientesIndex.get(_clientesReadyKey) == true;

    final raw = boxClientesPorSplitter.get("map");

    return ready && raw is Map && raw.isNotEmpty;
  }

  // Utils
  bool _isExpired(DateTime? at) {
    if (at == null) return true;
    return DateTime.now().isAfter(at.add(cacheTtl));
  }

  bool clientesCacheValidoParaBootstrap() {
    final updatedAt = getLastClientesUpdate();
    if (updatedAt == null) return false;

    final lastUpdate = DateTime.fromMillisecondsSinceEpoch(updatedAt);
    return DateTime.now().difference(lastUpdate) < cacheTtl;
  }

// Cache em memória (🔥 ESSENCIAL NO WEB)
  List<SplitterModel> _splittersCache = [];

  List<SplitterModel> getSplittersFromMemory() {
    return _splittersCache;
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
    final saved = boxSplitters.get("data") as List?;
    final updatedAt = boxSplitters.get("updatedAt") as int?;

    if (saved != null &&
        updatedAt != null &&
        !_isExpired(DateTime.fromMillisecondsSinceEpoch(updatedAt))) {
      debugPrint("⚡ Splitters vindos do cache");

      final result =
          saved.map((e) => SplitterModel.fromJson(_safeMap(e))).toList();

      _splittersCache = result;
      return result;
    }

    debugPrint("🌐 Buscando splitters da API");

    final r = await _authedGet(splittersEndpoint);
    if (r.statusCode != 200) {
      throw Exception("Erro ao buscar splitters");
    }

    final body = jsonDecode(r.body);
    final List list = body["response"] as List;

    await boxSplitters.put("data", list);
    await boxSplitters.put(
      "updatedAt",
      DateTime.now().millisecondsSinceEpoch,
    );

    final result =
        list.map((e) => SplitterModel.fromJson(_safeMap(e))).toList();

    _splittersCache = result;
    return result;
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

    final all = response.map((e) => _safeMap(e)).toList();

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
        final code = m["splitter"]?["code"]?.toString();

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
// 🔥 FLAG DE PRONTO (ESSENCIAL)
    await boxClientesIndex.put(_clientesReadyKey, true);
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
      clientesPorSplitterCache = _readClientesMapFromHive();
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

    return list.map((e) => ClienteModel.fromJson(_safeMap(e))).toList();
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
    final raw = _readClientesMapFromHive();
    return raw[splitterCode]?.length ?? 0;
  }

  /// 🔒 Snapshot IMUTÁVEL para HomePage
  Map<String, int> getOcupacaoSnapshot() {
    // 🔒 garante que o cache em memória esteja carregado
    if (clientesPorSplitterCache.isEmpty) {
      clientesPorSplitterCache = _readClientesMapFromHive();
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
    final raw = boxClientesPorSplitter.get("map");
    if (raw is! Map) return {};

    final Map<String, List<ClienteModel>> result = {};

    raw.forEach((key, value) {
      if (value is List) {
        result[key.toString()] =
            value.map((e) => ClienteModel.fromJson(_safeMap(e))).toList();
      }
    });

    return result;
  }

  Map<String, List<ClienteModel>> getClientesIndexFromMemory() {
    if (clientesPorSplitterCache.isEmpty) {
      final raw = boxClientesPorSplitter.get("map");

      final Map<String, List<Map<String, dynamic>>> safe = {};

      if (raw is Map) {
        raw.forEach((key, value) {
          if (key != null && value is List) {
            safe[key.toString()] = value
                .whereType<Map>()
                .map((e) => _safeMap(e)) // ✅
                .toList();
          }
        });
      }

      clientesPorSplitterCache = safe;
    }

    return clientesPorSplitterCache.map(
      (k, v) => MapEntry(
          k, v.map((e) => ClienteModel.fromJson(_safeMap(e))).toList()),
    );
  }

  void restoreSplittersFromHive() {
    final saved = boxSplitters.get("data") as List?;
    if (saved == null) return;

    _splittersCache =
        saved.map((e) => SplitterModel.fromJson(_safeMap(e))).toList();
  }

  // ===================================================================
// 🛣️ CACHE DE RUAS (MEMÓRIA + HIVE)
// ===================================================================

  final Map<String, String> _streetCache = {};

  /// Getter público (read-only)
  Map<String, String> get streetCache => Map.unmodifiable(_streetCache);

  Future<void> loadStreetCache() async {
    final raw = boxStreetCache.get('map');

    _streetCache.clear();

    if (raw is Map) {
      raw.forEach((key, value) {
        if (key != null && value is String && value.isNotEmpty) {
          _streetCache[key.toString()] = value;
        }
      });
    }

    debugPrint('🛣️ Ruas restauradas do Hive: ${_streetCache.length}');
  }

  Future<void> saveStreet(String splitterCode, String street) async {
    _streetCache[splitterCode] = street;

    await boxStreetCache.put(
      'map',
      Map<String, String>.from(_streetCache),
    );
  }

  String? getStreet(String splitterCode) {
    return _streetCache[splitterCode];
  }

  Future<void> refreshClientesPorSplitter(String splitterCode) async {
    debugPrint('🔄 Refresh LOCAL do splitter $splitterCode');

    // =====================================================
    // 1️⃣ BUSCA TODOS OS CLIENTES (API NÃO SUPORTA FILTRO)
    // =====================================================
    final r = await _authedGet(clientesEndpoint);
    if (r.statusCode != 200) {
      throw Exception('Erro ao atualizar clientes do splitter');
    }

    final body = jsonDecode(r.body);
    final response = body['response'] as List;

    // =====================================================
    // 2️⃣ FILTRA APENAS O SPLITTER DESEJADO
    // =====================================================
    final filtrados = response
        .map((e) => _safeMap(e))
        .where((c) => c['splitter']?['code']?.toString() == splitterCode)
        .toList();

    // =====================================================
    // 3️⃣ ATUALIZA CACHE EM MEMÓRIA (IMEDIATO PARA UI)
    // =====================================================
    clientesPorSplitterCache[splitterCode] = filtrados;

    // 🔥 ATUALIZA STREAM REATIVO (TEMPO REAL)
    if (_clientesNotifier.containsKey(splitterCode)) {
      _clientesNotifier[splitterCode]!.value =
          filtrados.map((e) => ClienteModel.fromJson(_safeMap(e))).toList();
    }

    // =====================================================
    // 4️⃣ ATUALIZA CACHE PERSISTENTE (HIVE)
    // =====================================================
    final raw = boxClientesPorSplitter.get('map');
    final Map<String, dynamic> map =
        raw is Map ? Map<String, dynamic>.from(raw) : {};

    map[splitterCode] = filtrados;

    await boxClientesPorSplitter.put('map', map);

    // =====================================================
    // 5️⃣ ATUALIZA OCUPAÇÃO LOCAL (SEM AFETAR GLOBAL)
    // =====================================================
    ocupacoesCache[splitterCode] = filtrados.length;
    await boxOcupacoes.put(splitterCode, filtrados.length);

    // =====================================================
    // 6️⃣ (OPCIONAL, RECOMENDADO) MARCA UPDATE LOCAL
    // =====================================================
    await boxClientesPorSplitter.put(
      'last_update_$splitterCode',
      DateTime.now().millisecondsSinceEpoch,
    );

    debugPrint(
      '✅ Splitter $splitterCode atualizado (${filtrados.length} clientes)',
    );
  }

  // ===================================================================
// 🛣️ RESTAURA CACHE DE RUAS DO HIVE
// ===================================================================
}
