// lib/services/splitter_service.dart
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:hive_flutter/hive_flutter.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:nexaview/services/auth_service.dart';
import 'package:flutter/foundation.dart';

/// Servico central de dados da HomePage e da tela de detalhe.
///
/// Responsabilidades principais:
/// - buscar splitters e clientes no ERP
/// - manter cache local com Hive
/// - expor snapshots e notifiers para a UI
/// - resolver ruas via reverse geocode quando necessario
class SplitterService {
  final AuthService auth;
  final String splittersEndpoint;
  final String clientesEndpoint;
  final String? reverseGeocodeEndpoint;

  static const int chunkSize = 5000;
  static const Duration cacheTtl = Duration(minutes: 5);

  // =====================================================
// 🟡 DIRTY FLAG POR SPLITTER
// =====================================================
  final Set<String> _dirtySplitters = {};
  final Map<String, DateTime> _lastUpdatePorSplitter = {};
  final Map<String, Future<void>> _inFlightRefreshPorSplitter = {};
  final Map<String, DateTime> _lastRefreshAttemptPorSplitter = {};

  // TTL de segurança (fallback)
  static const Duration splitterTtl = Duration(seconds: 30);
  static const Duration splitterRefreshCooldown = Duration(seconds: 30);

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

  static const _boxLastUpdate = "splitter_last_update";
  static late Box boxLastUpdate;

  int? getLastClientesUpdate() {
    return boxClientesIndex.get("updatedAt") as int?;
  }

  DateTime? getLastUpdateForSplitter(String splitterCode) {
    return _lastUpdatePorSplitter[splitterCode];
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

  void markSplitterDirty(String splitterCode) {
    debugPrint('🟡 Splitter $splitterCode marcado como DIRTY');
    _dirtySplitters.add(splitterCode);
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
    this.reverseGeocodeEndpoint,
  }) {
    restoreLastUpdatesFromHive();
  }

  // ===================================================================
  // ✅ Inicialização (main)
  // ===================================================================
  // Abre todas as boxes usadas pelo app. Esse metodo roda no bootstrap.
  static Future<void> initHive() async {
    boxSplitters = await Hive.openBox(_boxSplitters);
    boxClientesIndex = await Hive.openBox(_boxClientesIndex);
    boxOcupacoes = await Hive.openBox(_boxOcupacoes);
    boxClientesPorSplitter = await Hive.openBox(_boxClientesPorSplitter);
    boxStreetCache = await Hive.openBox(_boxStreetCache);

    // ✅ NOVO
    boxLastUpdate = await Hive.openBox(_boxLastUpdate);
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

  // Wrapper simples para GET autenticado com retry explicito de 401.
  Future<http.Response> _authedGet(String url) async {
    debugPrint('GET $url');
    final h = await auth.getAuthHeaders();
    var r = await http.get(Uri.parse(url), headers: h);
    debugPrint(
      'GET status=${r.statusCode} content-type=${r.headers['content-type'] ?? '(sem content-type)'} bytes=${r.bodyBytes.length}, headers=${r.headers}',
    );

    if (r.statusCode == 401) {
      debugPrint('GET recebeu 401, renovando token e repetindo chamada');
      print("$auth.getAuthHeaders() = $h");
      await auth.forceRefresh();
      final h2 = await auth.getAuthHeaders();
      print("$auth.getAuthHeaders() após refresh = $h2");
      r = await http.get(Uri.parse(url), headers: h2);
      debugPrint(
        'GET retry status=${r.statusCode} content-type=${r.headers['content-type'] ?? '(sem content-type)'} bytes=${r.bodyBytes.length}',
      );
    }
    return r;
  }

  // ===================================================================
  // ✅ SPLITTERS
// ===================================================================
  // Busca splitters do cache quando valido e cai para a API quando necessario.
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
  // Faz a carga completa de clientes e reconstrui os indices usados pela UI.
  //
  // Esse eh o refresh "global" do app: atualiza ocupacao, mapa por splitter
  // e notifiers reativos que abastecem as telas abertas.
  Future<int> refreshClientesCache({
    void Function(int loaded, int total)? onProgress,
    void Function(Map<String, int> snapshot)? onSnapshot,
  }) async {
    final r = await _authedGet(clientesEndpoint);
    if (r.statusCode != 200) throw Exception("Erro clientes");

    final body = jsonDecode(r.body);
    final response = body["response"] as List;
    debugPrint('Clientes response count=${response.length}');

    final all = response.map((e) => _safeMap(e)).toList();
    final total = all.length;

    final chunks = (total + chunkSize - 1) ~/ chunkSize;
    final oldChunks = boxClientesIndex.get("chunks") as int? ?? 0;

    // =====================================================
    // 1️⃣ LIMPA CHUNKS ANTIGOS (DEBUG ONLY)
    // =====================================================
    for (int i = 0; i < oldChunks; i++) {
      final name = _chunkBoxName(i);
      if (Hive.isBoxOpen(name)) {
        await Hive.box(name).deleteFromDisk();
      } else {
        final b = await Hive.openBox(name);
        await b.deleteFromDisk();
      }
    }

    // =====================================================
    // 2️⃣ PROCESSA CHUNKS + ÍNDICE GLOBAL
    // =====================================================
    Map<String, int> occTemp = {};
    Map<String, List<Map>> indexTemp = {};

    for (int i = 0; i < chunks; i++) {
      final start = i * chunkSize;
      final end = min(start + chunkSize, total);
      final slice = all.sublist(start, end);

      // salva chunk APENAS em debug
      if (kDebugMode) {
        final box = await Hive.openBox(_chunkBoxName(i));
        await box.put("data", slice);
        await box.close();
      }

      for (final m in slice) {
        final code = m["splitter"]?["code"]?.toString();
        if (code == null) continue;

        occTemp[code] = (occTemp[code] ?? 0) + 1;
        indexTemp.putIfAbsent(code, () => []);
        indexTemp[code]!.add(m);
      }

      // progresso visual
      onProgress?.call(i + 1, chunks);

      // snapshot incremental (UI)
      onSnapshot?.call(
        indexTemp.map((k, v) => MapEntry(k, v.length)),
      );
    }

    // =====================================================
    // 3️⃣ SALVA META DO CACHE
    // =====================================================
    await boxClientesIndex.put("total", total);
    await boxClientesIndex.put("chunks", chunks);
    await boxClientesIndex.put(
      "updatedAt",
      DateTime.now().millisecondsSinceEpoch,
    );

    await boxClientesIndex.put(_clientesReadyKey, true);

    // =====================================================
    // 4️⃣ SALVA OCUPAÇÕES
    // =====================================================
    ocupacoesCache = occTemp;
    await boxOcupacoes.put("map", occTemp);

    // =====================================================
    // 5️⃣ SALVA ÍNDICE GLOBAL
    // =====================================================
    clientesPorSplitterCache = indexTemp;
    await boxClientesPorSplitter.put("map", indexTemp);

    // =====================================================
    // 5.1️⃣ PROPAGA REFRESH PARA NOTIFIERS REATIVOS
    // =====================================================
    for (final entry in _clientesNotifier.entries) {
      final code = entry.key;
      final notifier = entry.value;
      final rawList = clientesPorSplitterCache[code] ?? const [];
      notifier.value =
          rawList.map((e) => ClienteModel.fromJson(_safeMap(e))).toList();
    }

    // =====================================================
    // 6️⃣ 🔥 RESTAURA ÚLTIMAS ATUALIZAÇÕES (NÃO PERDE HISTÓRICO)
    // =====================================================
    restoreLastUpdatesFromHive();

    debugPrint(
      '📦 Refresh global concluído | Splitters: ${indexTemp.length}',
    );

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

  // Resolve rua por coordenada.
  //
  // No Web, preferimos um endpoint intermediario quando configurado para evitar
  // limitacoes de CORS/quotas do provedor de geocoding direto no navegador.
  Future<String?> getStreetFromLatLng(double lat, double lng) async {
    if (kIsWeb &&
        (reverseGeocodeEndpoint == null || reverseGeocodeEndpoint!.isEmpty)) {
      //debugPrint(
      //'Reverse geocoding desabilitado no Web: configure REVERSE_GEOCODE_ENDPOINT',
      //);
      return null;
    }

    const maxAttempts = 3;
    var backoff = const Duration(seconds: 2);

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final Uri url;
        if (reverseGeocodeEndpoint != null &&
            reverseGeocodeEndpoint!.isNotEmpty) {
          final base = Uri.parse(reverseGeocodeEndpoint!);
          final qp = Map<String, String>.from(base.queryParameters)
            ..addAll({
              'lat': '$lat',
              'lng': '$lng',
              'lon': '$lng',
            });
          url = base.replace(queryParameters: qp);
        } else {
          url = Uri.parse(
            'https://nominatim.openstreetmap.org/reverse'
            '?lat=$lat&lon=$lng&format=json&addressdetails=1',
          );
        }

        print(
            "Consultando geocodificação para $lat, $lng (attempt $attempt/$maxAttempts)...");

        final response = await http.get(
          url,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'NexaView/1.0 (contato@sebratel.com.br)',
          },
        ).timeout(const Duration(seconds: 8));

        if (response.statusCode == 429) {
          if (attempt < maxAttempts) {
            await Future.delayed(backoff);
            backoff *= 2;
            continue;
          }
          debugPrint('Nominatim limitou requisição (429): lat=$lat, lng=$lng');
          return null;
        }

        if (response.statusCode != 200) {
          debugPrint(
            'Falha ao resolver rua (status ${response.statusCode}): lat=$lat, lng=$lng',
          );
          return null;
        }

        final street = _extractStreetFromReverseResponse(response.body);
        if (street == null || street.isEmpty) {
          debugPrint('Sem logradouro para coordenada: lat=$lat, lng=$lng');
          return null;
        }

        return street;
      } catch (e) {
        if (attempt < maxAttempts) {
          await Future.delayed(backoff);
          backoff *= 2;
          continue;
        }
        debugPrint('Erro no reverse geocoding: $e (lat=$lat, lng=$lng)');
        return null;
      }
    }

    return null;
  }

  String? _extractStreetFromReverseResponse(String body) {
    try {
      final decoded = jsonDecode(body);

      if (decoded is Map<String, dynamic>) {
        final direct = decoded['street']?.toString().trim();
        if (direct != null && direct.isNotEmpty) return direct;

        final address = decoded['address'];
        if (address is Map<String, dynamic>) {
          final street = (address['road'] ??
                  address['street'] ??
                  address['pedestrian'] ??
                  address['residential'] ??
                  address['footway'] ??
                  address['path'] ??
                  address['cycleway'] ??
                  address['highway'])
              ?.toString()
              .trim();
          if (street != null && street.isNotEmpty) return street;
        }
      }
    } catch (_) {
      final text = body.trim();
      if (text.isNotEmpty) return text;
    }

    return null;
  }

  /// Retorna o índice completo de clientes por splitter
  /// Map&lt;splitterCode, List&lt;ClienteModel&gt;&gt;
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

  List<String> getCachedSplitterCodes() {
    final raw = boxClientesPorSplitter.get("map");
    if (raw is! Map) return const [];

    return raw.keys
        .map((key) => key?.toString().trim() ?? '')
        .where((key) => key.isNotEmpty)
        .toList();
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

  // Refresh pontual para um unico splitter. Usado principalmente quando a tela
  // de detalhe detecta mudancas operacionais naquele equipamento.
  Future<void> refreshClientesPorSplitter(
    String splitterCode, {
    bool force = false,
  }) async {
    final inFlight = _inFlightRefreshPorSplitter[splitterCode];
    if (inFlight != null) {
      debugPrint('⏳ Refresh já em andamento para $splitterCode');
      return inFlight;
    }

    final now = DateTime.now();
    final lastAttempt = _lastRefreshAttemptPorSplitter[splitterCode];
    if (lastAttempt != null &&
        now.difference(lastAttempt) < splitterRefreshCooldown) {
      debugPrint('🕒 Cooldown ativo para $splitterCode — pulando refresh');
      return;
    }
    _lastRefreshAttemptPorSplitter[splitterCode] = now;

    final future = _refreshClientesPorSplitterCore(splitterCode, force: force);
    _inFlightRefreshPorSplitter[splitterCode] = future;
    try {
      await future;
    } finally {
      if (identical(_inFlightRefreshPorSplitter[splitterCode], future)) {
        _inFlightRefreshPorSplitter.remove(splitterCode);
      }
    }
  }

  Future<void> _refreshClientesPorSplitterCore(
    String splitterCode, {
    required bool force,
  }) async {
    final now = DateTime.now();

    // 🔹 tenta memória primeiro
    DateTime? last = _lastUpdatePorSplitter[splitterCode];

    // 🔹 fallback Hive (se memória vazia)
    if (last == null) {
      final ts = boxLastUpdate.get(splitterCode) as int?;
      if (ts != null) {
        last = DateTime.fromMillisecondsSinceEpoch(ts);
        _lastUpdatePorSplitter[splitterCode] = last; // cache memória
      }
    }

    final bool isDirty = _dirtySplitters.contains(splitterCode);
    final bool ttlExpired = last == null || now.difference(last) > splitterTtl;

    // 🟢 NÃO ATUALIZA SE NÃO PRECISAR
    if (!force && !isDirty && !ttlExpired) {
      debugPrint('🟢 Splitter $splitterCode limpo — usando cache');
      return;
    }

    debugPrint(
      force
          ? '🔄 Refresh FORÇADO do splitter $splitterCode'
          : '🔄 Refresh REAL do splitter $splitterCode',
    );

    // =====================================================
    // 1️⃣ BUSCA TODOS OS CLIENTES (API)
    // =====================================================
    final r = await _authedGet(clientesEndpoint);
    if (r.statusCode != 200) {
      throw Exception('Erro ao atualizar clientes do splitter');
    }

    final body = jsonDecode(r.body);
    final response = body['response'] as List;

    // =====================================================
    // 2️⃣ FILTRA APENAS O SPLITTER
    // =====================================================
    final filtrados = response
        .map((e) => _safeMap(e))
        .where(
          (c) => c['splitter']?['code']?.toString() == splitterCode,
        )
        .toList();

    // =====================================================
    // 3️⃣ CACHE EM MEMÓRIA (UI IMEDIATA)
    // =====================================================
    clientesPorSplitterCache[splitterCode] = filtrados;

    if (_clientesNotifier.containsKey(splitterCode)) {
      _clientesNotifier[splitterCode]!.value =
          filtrados.map((e) => ClienteModel.fromJson(_safeMap(e))).toList();
    }

    // =====================================================
    // 4️⃣ CACHE PERSISTENTE (HIVE)
    // =====================================================
    final raw = boxClientesPorSplitter.get('map');
    final Map<String, dynamic> map =
        raw is Map ? Map<String, dynamic>.from(raw) : {};

    map[splitterCode] = filtrados;
    await boxClientesPorSplitter.put('map', map);

    // =====================================================
    // 5️⃣ OCUPAÇÃO LOCAL
    // =====================================================
    ocupacoesCache[splitterCode] = filtrados.length;
    await boxOcupacoes.put(splitterCode, filtrados.length);

    // =====================================================
    // 6️⃣ REGISTRA ÚLTIMA ATUALIZAÇÃO (MEMÓRIA + HIVE)
    // =====================================================
    _dirtySplitters.remove(splitterCode);

    final refreshedAt = DateTime.now();
    _lastUpdatePorSplitter[splitterCode] = refreshedAt;
    await boxLastUpdate.put(
      splitterCode,
      refreshedAt.millisecondsSinceEpoch,
    );

    debugPrint(
      '✅ Splitter $splitterCode atualizado (${filtrados.length} clientes)',
    );
  }

  void restoreLastUpdatesFromHive() {
    _lastUpdatePorSplitter.clear();

    for (final key in boxLastUpdate.keys) {
      final ts = boxLastUpdate.get(key);
      if (ts is int) {
        _lastUpdatePorSplitter[key.toString()] =
            DateTime.fromMillisecondsSinceEpoch(ts);
      }
    }

    debugPrint(
      '🕒 Últimas atualizações restauradas: ${_lastUpdatePorSplitter.length}',
    );
  }
}
