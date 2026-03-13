// ignore_for_file: uri_does_not_exist, undefined_method

import 'package:flutter/material.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/services/olt_service.dart';
import 'package:nexaview/services/splitter_service.dart';
import 'package:nexaview/widgets/splitter_card.dart';
import 'package:nexaview/screens/splitter_detail_page.dart';
import 'package:nexaview/screens/qr_scanner_page.dart';
import 'package:intl/intl.dart';
import 'package:lottie/lottie.dart';
import 'package:nexaview/models/olt_model.dart'; // ✅ IMPORTANTE
import 'package:nexaview/services/auth_service.dart';
import 'package:nexaview/services/splitter_status_service.dart';
import 'package:nexaview/enums/splitter_status.dart';
import 'package:nexaview/services/geogrid_service.dart';
import 'package:flutter/foundation.dart';
import 'package:nexaview/models/app_session_user.dart';
import 'package:nexaview/screens/massiva_screen.dart';
import 'package:nexaview/services/autoisp_auth_service.dart';
import 'package:nexaview/services/autoisp_event_service.dart';
import 'package:nexaview/services/massiva_gateway_service.dart';
import 'package:nexaview/services/massiva_middleware_service.dart';
import 'dart:ui';
import 'dart:async';

class HomePage extends StatefulWidget {
  final VoidCallback onThemeToggle;
  final SplitterService splitterService;
  final AuthService authService; // ✅
  final AppSessionUser sessionUser;
  final String middlewareMassivaBaseUrl;
  final String massivaApiGatewayEndpoint;
  final String ellevenMassivaListEndpoint;
  final String ellevenMassivaListBearerToken;
  final String ellevenMassivaListHeaderName;
  final String ellevenMassivaListHeaderValue;
  final String autoIspEventsEndpoint;
  final String autoIspAuthEndpoint;
  final String autoIspUsername;
  final String autoIspPassword;
  final String massivaCookieString;

  const HomePage({
    super.key,
    required this.onThemeToggle,
    required this.splitterService,
    required this.authService,
    required this.sessionUser,
    required this.middlewareMassivaBaseUrl,
    required this.massivaApiGatewayEndpoint,
    required this.ellevenMassivaListEndpoint,
    required this.ellevenMassivaListBearerToken,
    required this.ellevenMassivaListHeaderName,
    required this.ellevenMassivaListHeaderValue,
    required this.autoIspEventsEndpoint,
    required this.autoIspAuthEndpoint,
    required this.autoIspUsername,
    required this.autoIspPassword,
    required this.massivaCookieString,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final SplitterService _service;
  late final AuthService _authService;
  late final OltService _oltService;
  late final GeoGridService _geoGridService;
  Timer? _clientesAutoRefreshTimer;

  @override
  void dispose() {
    _clientesAutoRefreshTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  final TextEditingController _searchController = TextEditingController();
  Map<String, int> _ocupacaoSnapshot = {};
  final Map<String, String> _streetBySplitter = {};
  final Map<String, List<String>> _clientesPorSplitter = {};

  final Map<String, SplitterStatus> _statusCache = {};
  //final Map<String, int> _ocupacaoRealCache = {};

  List<SplitterModel> _splitters = [];
  List<SplitterModel> _filtered = [];
  List<String>? _ruasCacheOrdenadas;

  int _totalOcupacaoFiltrada = 0;
  bool _cacheReady = false;
  int _totalClientesSnapshot = 0;
  bool _clientesLoading = true;
  bool _splittersReady = false;
  bool _clientesReady = false;
  bool _bootstrapFinalizado = false;
  int _totalClientesAtivos = 0;
  int _totalClientesInativos = 0;
  bool _bootstrapJaExecutado = false;
  bool _resolvingAddresses = false;

  // 🔥 filtros
  Set<String> _oltsSelecionadas = {};
  Set<SplitterStatus> _statusSelecionados = {};
  Set<String> _ruasSelecionadas = {};

  // ✅ INDICA SE HÁ FILTRO ATIVO (estado lógico, não visual)
  bool get _hasFiltroAtivo {
    return _oltsSelecionadas.isNotEmpty ||
        _statusSelecionados.isNotEmpty ||
        _ruasSelecionadas.isNotEmpty ||
        _searchController.text.trim().isNotEmpty;
  }

  @override
  void initState() {
    super.initState();

    _service = widget.splitterService;
    _authService = widget.authService;
    _oltService = OltService(_authService);

    _geoGridService = GeoGridService(
      baseUrl: 'https://eros.geogridmaps.com.br/sebratel/api/v3',
      apiKey: '***REMOVED***',
    );

    // 🔥 Bootstrap assíncrono (obrigatório no Web)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bootstrap();
    });

    _iniciarAutoRefreshClientes();
  }

  void _iniciarAutoRefreshClientes() {
    _clientesAutoRefreshTimer?.cancel();

    _clientesAutoRefreshTimer = Timer.periodic(
      SplitterService.cacheTtl,
      (_) async {
        if (!mounted || !_bootstrapFinalizado) return;
        try {
          debugPrint('⏱️ Auto-refresh (5 min) iniciado');
          await _refreshSilencioso();
          debugPrint('✅ Auto-refresh (5 min) concluído');
        } catch (e, s) {
          debugPrint('Erro no auto-refresh de clientes: $e\n$s');
        }
      },
    );
  }

  Future<void> _openMassivaPage() async {
    if (!widget.sessionUser.canOpenMassiva) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MassivaPage(
          middlewareService: MassivaMiddlewareService(
            baseUrl: widget.middlewareMassivaBaseUrl,
            authService: _authService,
          ),
          gatewayService: MassivaGatewayService(
            endpoint: widget.massivaApiGatewayEndpoint,
            listEndpoint: widget.ellevenMassivaListEndpoint,
            listBearerToken: widget.ellevenMassivaListBearerToken,
            listHeaderName: widget.ellevenMassivaListHeaderName,
            listHeaderValue: widget.ellevenMassivaListHeaderValue,
            authService: _authService,
          ),
          autoIspService: AutoIspEventService(
            baseUrl: widget.autoIspEventsEndpoint,
            authService: AutoIspAuthService(
              authEndpoint: widget.autoIspAuthEndpoint,
              username: widget.autoIspUsername,
              password: widget.autoIspPassword,
            ),
          ),
          sessionUser: widget.sessionUser,
          splitters: _splitters,
          cachedSplitterCodes: const [],
          getClientesForSplitter: _service.getClientesInstantSync,
          getOltIdByCode: (oltCode) =>
              _oltService.getBySplitterCode(oltCode)?.id,
          cookieString: widget.massivaCookieString,
        ),
      ),
    );
  }

  void _recalcularStatusClientes() {
    int ativos = 0;
    int inativos = 0;

    final clientesIndex = _service.getClientesIndexFromMemory();

    for (final entry in clientesIndex.entries) {
      for (final cliente in entry.value) {
        if (cliente.status == 1) {
          ativos++;
        } else {
          inativos++;
        }
      }
    }

    _totalClientesAtivos = ativos;
    _totalClientesInativos = inativos;
  }

  Future<void> _bootstrap() async {
    // 🔒 Garante que o bootstrap roda apenas UMA vez por sessão
    if (_bootstrapJaExecutado) {
      debugPrint("♻️ Bootstrap ignorado (sessão ativa)");
      return;
    }

    debugPrint("🚀 BOOTSTRAP SEGURO INICIADO");

    try {
      // =====================================================
      // 1️⃣ RESTAURA CACHE LOCAL (STALE-WHILE-REVALIDATE)
      // =====================================================
      final snapshot = _service.getOcupacaoSnapshot();
      final cacheValido =
          snapshot.isNotEmpty && _service.clientesCacheValidoParaBootstrap();

      if (snapshot.isNotEmpty) {
        debugPrint(
          cacheValido
              ? "⚡ Cache válido restaurado"
              : "♻️ Cache vencido restaurado (refresh em background)",
        );

        _buildClientesIndex();
        _recalcularStatusClientes();

        setState(() {
          _ocupacaoSnapshot = snapshot;
          _totalClientesSnapshot = snapshot.values.fold(0, (a, b) => a + b);
          _cacheReady = true;
          _clientesReady = true;
          _clientesLoading = false;
        });

        // 🔄 Cache vencido → atualiza em BACKGROUND (sem await)
        if (!cacheValido) {
          _service.refreshClientesCache().then((_) {
            if (!mounted) return;
            debugPrint("✅ Refresh silencioso concluído");
            _atualizarSnapshotLocal();
          });
        }
      }

      // =====================================================
      // 2️⃣ SPLITTERS (CACHE → API)
      // =====================================================
      final splitters = await _service.fetchSplitters();
      if (!mounted) return;

      setState(() {
        _splitters = splitters;
        _filtered = splitters;
        _splittersReady = splitters.isNotEmpty;
      });

      for (final s in splitters) {
        final streetFromApi = s.street;
        if (streetFromApi == null || streetFromApi.isEmpty) continue;
        await _service.saveStreet(s.code, streetFromApi);
      }

      // =====================================================
      // 2.5️⃣ CARREGA OLTs (FILTROS)
      // =====================================================
      if (!_oltService.isLoaded) {
        debugPrint("📡 Carregando OLTs...");
        await _oltService.loadOlts();
        if (!mounted) return;
      }

      // =====================================================
      // 3️⃣ PRIMEIRA CARGA REAL (SOMENTE SE NÃO EXISTE CACHE)
      // =====================================================
      if (!_clientesReady && snapshot.isEmpty) {
        debugPrint("🌐 Primeira carga REAL (sem cache)");

        setState(() => _clientesLoading = true);

        await _service.refreshClientesCache();
        if (!mounted) return;

        final novoSnapshot = _service.getOcupacaoSnapshot();

        setState(() {
          _ocupacaoSnapshot = novoSnapshot;
          _totalClientesSnapshot = novoSnapshot.values.fold(0, (a, b) => a + b);
          _cacheReady = true;
          _clientesReady = true;
          _clientesLoading = false;
        });

        _buildClientesIndex();
        _recalcularStatusClientes();
      }

      // =====================================================
      // 4️⃣ CACHE DE RUAS
      // =====================================================
      await _service.loadStreetCache();

      setState(() {
        _streetBySplitter
          ..clear()
          ..addAll(_service.streetCache);
        _ruasCacheOrdenadas = null;
      });

      // =====================================================
      // 5️⃣ FILTROS
      // =====================================================
      _applyFilters();

      // =====================================================
      // 6️⃣ ENDEREÇOS EM BACKGROUND
      // =====================================================
      _resolveAddressesInBackground();

      // =====================================================
      // ✅ BOOTSTRAP FINALIZADO
      // =====================================================
      if (mounted) {
        setState(() {
          _clientesLoading = false;
          _bootstrapFinalizado = true;
        });
      }

      _bootstrapJaExecutado = true; // 🔥 ESSENCIAL
    } catch (e, s) {
      debugPrint("❌ ERRO NO BOOTSTRAP: $e\n$s");

      if (!mounted) return;

      setState(() {
        _clientesLoading = false;
        _bootstrapFinalizado = true;
      });
    }
  }

  int _calcularOcupacaoFiltrada() {
    if (!_cacheReady) return 0;

    int total = 0;
    for (final splitter in _filtered) {
      total += _ocupacaoSnapshot[splitter.code] ?? 0;
    }
    return total;
  }

  SplitterStatus _getStatus(SplitterModel splitter) {
    return _statusCache.putIfAbsent(
      splitter.code,
      () => SplitterStatusService.resolve(
        ocupacaoReal: _ocupacaoSnapshot[splitter.code] ?? 0,
        totalPortas: splitter.outPorts,
      ),
    );
  }

  void _applyFilters() {
    if (!mounted) return;
    if (!_bootstrapFinalizado) return;
    if (!_splittersReady || !_clientesReady) return;
    if (_splitters.isEmpty) return;

    final query = _searchController.text.trim().toLowerCase();

    final newFiltered = _splitters.where((s) {
      final clientes = _clientesPorSplitter[s.code] ?? const [];

      final matchCliente =
          query.isNotEmpty && clientes.any((n) => n.contains(query));

      final matchBusca = query.isEmpty ||
          s.code.toLowerCase().contains(query) ||
          s.title.toLowerCase().contains(query) ||
          matchCliente;

      final matchOlt = _oltsSelecionadas.isEmpty ||
          (s.oltCode != null && _oltsSelecionadas.contains(s.oltCode));

      final matchStatus = _statusSelecionados.isEmpty ||
          _statusSelecionados.contains(_getStatus(s));

      final street = _streetBySplitter[s.code];
      final matchRua = _ruasSelecionadas.isEmpty ||
          (street != null &&
              _ruasSelecionadas.any(
                (rua) => street.toLowerCase().contains(rua.toLowerCase()),
              ));

      return matchBusca && matchOlt && matchStatus && matchRua;
    }).toList();

    if (listEquals(newFiltered, _filtered)) return;

    setState(() {
      _filtered = newFiltered;
      _totalOcupacaoFiltrada = _calcularOcupacaoFiltrada();
    });
  }

  void _buildClientesIndex() {
    _clientesPorSplitter.clear();

    //  final clientesIndex = _service.getClientesIndex();
    final clientesIndex = _service.getClientesIndexFromMemory();

    for (final entry in clientesIndex.entries) {
      _clientesPorSplitter[entry.key] =
          entry.value.map((c) => c.name.toLowerCase()).toList();
    }

    debugPrint('👥 Clientes indexados: ${_clientesPorSplitter.length}');
  }

  Future<void> _resolveAddressesInBackground() async {
    if (_resolvingAddresses) return;
    _resolvingAddresses = true;

    try {
      for (final s in _splitters) {
        if (!mounted) return;

        final streetFromApi = s.street;
        if (streetFromApi != null && streetFromApi.isNotEmpty) {
          if (_streetBySplitter[s.code] != streetFromApi) {
            await _service.saveStreet(s.code, streetFromApi);
            setState(() {
              _streetBySplitter[s.code] = streetFromApi;
              _ruasCacheOrdenadas = null;
            });
            if (_ruasSelecionadas.isNotEmpty) _applyFilters();
          }
          continue;
        }

        final cached = _service.getStreet(s.code);
        if (cached != null) {
          _streetBySplitter[s.code] = cached;
          continue;
        }

        if (s.lat == null || s.lng == null) continue;

        final street = await _service.getStreetFromLatLng(s.lat!, s.lng!);
        if (!mounted || street == null) continue;

        await _service.saveStreet(s.code, street);

        setState(() {
          _streetBySplitter[s.code] = street;
          _ruasCacheOrdenadas = null;
        });

        if (_ruasSelecionadas.isNotEmpty) _applyFilters();

        await Future.delayed(const Duration(milliseconds: 1200));
      }
    } finally {
      _resolvingAddresses = false;
    }
  }

  Future<Set<T>?> _showMultiSelectSearchDialog<T>({
    required String title,
    required List<T> items,
    required String Function(T) label,
    required Set<T> initialSelected,
  }) {
    List<T> filtered = List.from(items);
    final controller = TextEditingController();
    final selected = Set<T>.from(initialSelected);

    return showDialog<Set<T>>(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        const headerYellow = Color.fromARGB(255, 255, 174, 0);

        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              backgroundColor:
                  isDark ? const Color(0xFF1E1E1E) : const Color(0xFFE4E4E4),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
              title: Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),

              // 🔥 CONTEÚDO RESPONSIVO AO TECLADO
              content: Padding(
                padding: EdgeInsets.only(
                  bottom:
                      MediaQuery.of(context).viewInsets.bottom, // 🔑 CRÍTICO
                ),
                child: SizedBox(
                  width: 420,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxHeight: 420, // 🔥 NÃO fixa, apenas limita
                    ),
                    child: Column(
                      children: [
                        // 🔍 CAMPO DE BUSCA
                        TextField(
                          controller: controller,
                          autofocus: true,
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                          decoration: InputDecoration(
                            hintText: 'Buscar...',
                            hintStyle: TextStyle(
                              color: isDark ? Colors.white54 : Colors.black54,
                            ),
                            prefixIcon: Icon(
                              Icons.search,
                              color: isDark ? Colors.white70 : Colors.black54,
                            ),
                            filled: true,
                            fillColor: isDark
                                ? const Color(0xFF2A2A2A)
                                : const Color(0xFFEDEDED),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                          ),
                          onChanged: (value) {
                            setState(() {
                              filtered = items
                                  .where(
                                    (e) => label(e)
                                        .toLowerCase()
                                        .contains(value.toLowerCase()),
                                  )
                                  .toList();
                            });
                          },
                        ),

                        const SizedBox(height: 12),

                        // 📋 LISTA DE RESULTADOS (SCROLL CONTROLADO)
                        Expanded(
                          child: filtered.isEmpty
                              ? Center(
                                  child: Text(
                                    'Nenhum resultado',
                                    style: TextStyle(
                                      color: isDark
                                          ? Colors.white54
                                          : Colors.black54,
                                    ),
                                  ),
                                )
                              : ListView.builder(
                                  keyboardDismissBehavior:
                                      ScrollViewKeyboardDismissBehavior.onDrag,
                                  itemCount: filtered.length,
                                  itemBuilder: (_, index) {
                                    final item = filtered[index];

                                    return Card(
                                      elevation: 0,
                                      margin: const EdgeInsets.symmetric(
                                          vertical: 4),
                                      color: isDark
                                          ? const Color(0xFF2A2A2A)
                                          : Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: ListTile(
                                        leading: Checkbox(
                                          value: selected.contains(item),
                                          side: BorderSide(
                                            color: isDark
                                                ? Colors.white70
                                                : Colors.grey.shade600,
                                            width: 1.4,
                                          ),
                                          fillColor: WidgetStateProperty
                                              .resolveWith<Color?>(
                                            (states) {
                                              if (states.contains(
                                                  WidgetState.selected)) {
                                                return headerYellow;
                                              }
                                              return isDark
                                                  ? const Color(0xFF3A3A3A)
                                                  : Colors.grey.shade300;
                                            },
                                          ),
                                          checkColor: Colors.black87,
                                          onChanged: (_) {
                                            setState(() {
                                              if (selected.contains(item)) {
                                                selected.remove(item);
                                              } else {
                                                selected.add(item);
                                              }
                                            });
                                          },
                                        ),
                                        title: Text(
                                          label(item),
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: isDark
                                                ? Colors.white
                                                : Colors.black87,
                                          ),
                                        ),
                                        onTap: () {
                                          setState(() {
                                            if (selected.contains(item)) {
                                              selected.remove(item);
                                            } else {
                                              selected.add(item);
                                            }
                                          });
                                        },
                                      ),
                                    );
                                  },
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  style: TextButton.styleFrom(
                    backgroundColor: headerYellow,
                    foregroundColor: Colors.black87,
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    backgroundColor: headerYellow,
                    foregroundColor: Colors.black87,
                  ),
                  onPressed: () => setState(() => selected.clear()),
                  child: const Text('Limpar'),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: headerYellow,
                    foregroundColor: Colors.black87,
                  ),
                  onPressed: () => Navigator.pop(context, selected),
                  child: const Text('Aplicar'),
                ),
              ],
            );
          },
        );
      },
    ).whenComplete(controller.dispose);
  }

  // ignore: unused_element
  Future<void> _openQR() async {
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const QRScannerPage()),
    );
    if (result == null || !mounted) return;

    final match = _splitters.where((s) => s.code == result);
    if (match.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text("Splitter não encontrado"),
            backgroundColor: Color.fromARGB(255, 255, 174, 0)),
      );
      return;
    }

    final splitter = match.first;
    final clientes = await _service.getClientesInstant(splitter.code);
    debugPrint('🧪 DEBUG HOME → SPLITTER ${splitter.code}');
    debugPrint('Total clientes: ${clientes.length}');

    for (final c in clientes) {
      debugPrint(
        'Cliente: ${c.name} | porta=${c.port} | totalPortas=${splitter.outPorts}',
      );
    }
    if (!mounted) return;

    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => SplitterDetailPage(
          splitter: splitter,
          clientes: clientes,
          allSplitters: _splitters, // 👈 passa todos
          splitterService: _service, // 👈 PASSA AQUI
          oltService: _oltService, // 👈 PASSA AQUI
          ocupacaoSnapshot: _ocupacaoSnapshot,
          geoGridService: _geoGridService,
          authService: widget.authService, // 🔥 FALTAVA ISSO
        ),
      ),
    );
    if (updated == true) {
      await _service.refreshClientesPorSplitter(splitter.code);
      _atualizarSnapshotLocal(splitterCode: splitter.code); // 🔥 força UI
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bool headerReady = _splittersReady && _clientesReady;

    // 🔹 LOADING INICIAL ÚNICO (somente antes do bootstrap)
    if (!_bootstrapFinalizado && _splitters.isEmpty) {
      return Scaffold(
        resizeToAvoidBottomInset: true, // 🔥 FUNDAMENTAL
        backgroundColor: Theme.of(context).colorScheme.surface,
        body: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    final int totalClientes = headerReady ? _totalClientesSnapshot : 0;

    final bool isFiltered =
        headerReady && _bootstrapFinalizado && _hasFiltroAtivo;

    final int totalClientesFiltrados =
        isFiltered ? _totalOcupacaoFiltrada : totalClientes;

    final int splittersExibidos =
        isFiltered ? _filtered.length : _splitters.length;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: SafeArea(
        // ❌ REMOVER
        child: Stack(
          children: [
            // ================= CONTEÚDO PRINCIPAL
            RefreshIndicator(
              onRefresh: _refreshSilencioso,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final width = constraints.maxWidth;

                  int columns = 1;
                  if (width >= 1200) {
                    columns = 3;
                  } else if (width >= 800) {
                    columns = 2;
                  }

                  const double gridSpacing = 10;

                  // 🔥 ALTURA DO TECLADO
                  //final bottomInset = MediaQuery.of(context).viewInsets.bottom;

                  return CustomScrollView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      // ================= HEADER
                      SliverToBoxAdapter(
                        child: Column(
                          children: [
                            _header(
                              isDark,
                              headerReady: headerReady,
                              totalClientes: totalClientes,
                              totalClientesFiltrados: totalClientesFiltrados,
                              splittersExibidos: splittersExibidos,
                              isFiltered: isFiltered,
                            ),
                            const SizedBox(height: 20),
                          ],
                        ),
                      ),

                      // ================= EMPTY STATE
                      if (_filtered.isEmpty)
                        SliverToBoxAdapter(
                          child: Column(
                            children: [
                              const SizedBox(height: 80),
                              SizedBox(
                                width: 220,
                                height: 220,
                                child: Lottie.asset(
                                  'assets/animations/notFound.json',
                                ),
                              ),
                              const SizedBox(height: 20),
                              Text(
                                "Nenhum splitter encontrado",
                                style: TextStyle(
                                  color: isDark
                                      ? Colors.grey.shade400
                                      : Colors.grey.shade700,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 200),
                            ],
                          ),
                        ),

                      // ================= LISTA (MOBILE)
                      if (_filtered.isNotEmpty && columns == 1)
                        SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final splitter = _filtered[index];

                              return Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 24,
                                  vertical: 6,
                                ),
                                child: SplitterCard(
                                  splitter: splitter,
                                  ocupacao:
                                      _ocupacaoSnapshot[splitter.code] ?? 0,
                                  onTap: () async {
                                    final clientes = await _service
                                        .getClientesInstant(splitter.code);
                                    final olt = _oltService
                                        .getBySplitterCode(splitter.oltCode);

                                    if (!context.mounted) return;

                                    final updated = await Navigator.push<bool>(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => SplitterDetailPage(
                                          splitter: splitter,
                                          clientes: clientes,
                                          olt: olt,
                                          allSplitters: _splitters,
                                          splitterService: _service,
                                          oltService: _oltService,
                                          ocupacaoSnapshot: _ocupacaoSnapshot,
                                          geoGridService: _geoGridService,
                                          authService: widget.authService,
                                        ),
                                      ),
                                    );

                                    if (updated == true) {
                                      await _service.refreshClientesPorSplitter(
                                          splitter.code);
                                      _atualizarSnapshotLocal(
                                          splitterCode: splitter.code);
                                    }
                                  },
                                ),
                              );
                            },
                            childCount: _filtered.length,
                          ),
                        ),

                      // ================= GRID (TABLET / DESKTOP)
                      if (_filtered.isNotEmpty && columns > 1)
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(horizontal: 22),
                          sliver: SliverGrid(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final splitter = _filtered[index];

                                return SplitterCard(
                                  splitter: splitter,
                                  ocupacao:
                                      _ocupacaoSnapshot[splitter.code] ?? 0,
                                  onTap: () async {
                                    final clientes = await _service
                                        .getClientesInstant(splitter.code);
                                    final olt = _oltService
                                        .getBySplitterCode(splitter.oltCode);

                                    if (!context.mounted) return;

                                    final updated = await Navigator.push<bool>(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => SplitterDetailPage(
                                          splitter: splitter,
                                          clientes: clientes,
                                          olt: olt,
                                          allSplitters: _splitters,
                                          splitterService: _service,
                                          oltService: _oltService,
                                          ocupacaoSnapshot: _ocupacaoSnapshot,
                                          geoGridService: _geoGridService,
                                          authService: widget.authService,
                                        ),
                                      ),
                                    );

                                    if (updated == true) {
                                      await _service.refreshClientesPorSplitter(
                                          splitter.code);
                                      _atualizarSnapshotLocal(
                                          splitterCode: splitter.code);
                                    }
                                  },
                                );
                              },
                              childCount: _filtered.length,
                            ),
                            gridDelegate:
                                SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: columns,
                              mainAxisSpacing: gridSpacing,
                              crossAxisSpacing: gridSpacing,
                              childAspectRatio: 3.3,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),

            // ================= OVERLAY DE LOADING
            if (_clientesLoading && !_bootstrapFinalizado)
              IgnorePointer(
                ignoring: true,
                child: Container(
                  color: Colors.black.withValues(alpha: 0.12),
                  alignment: Alignment.topCenter,
                  padding: const EdgeInsets.only(top: 220),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 280,
                        height: 280,
                        child: Lottie.asset(
                          'assets/animations/loading3.json',
                          repeat: true,
                          fit: BoxFit.contain,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Text(
                          "Carregando clientes…",
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _header(
    bool isDark, {
    required bool headerReady,
    required int totalClientes,
    required int totalClientesFiltrados,
    required int splittersExibidos,
    required bool isFiltered,
  }) {
    final width = MediaQuery.of(context).size.width;
    final bool isDesktop = width >= 900;

    // 🔥 ALTURA AJUSTADA (agora com 5 cards)
    final double headerHeight =
        isDesktop ? (isFiltered ? 330 : 320) : (isFiltered ? 800 : 710);

    final clientesAtivos = headerReady ? _totalClientesAtivos : 0;
    final clientesInativos = headerReady ? _totalClientesInativos : 0;

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(32),
        bottomRight: Radius.circular(32),
      ),
      child: SizedBox(
        height: headerHeight,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 🖼️ FUNDO
            Image.asset(
              'assets/images/sebratelimagem.jpg',
              fit: BoxFit.cover,
            ),

            // 🎨 OVERLAY
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color.fromARGB(255, 255, 174, 0).withValues(alpha: 0.35),
                    const Color.fromARGB(255, 255, 174, 0).withValues(alpha: 0.35),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),

            // 🧩 CONTEÚDO
            SafeArea(
              bottom: false,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1600),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 26, 24, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ================= TOPO
                        Row(
                          children: [
                            Image.asset(
                              'assets/icons/logo-circular-sebratel.png',
                              width: 44,
                              height: 44,
                            ),
                            const SizedBox(width: 15),
                            Expanded(
                              child: Text(
                                "SPLITTERS",
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineMedium
                                    ?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 36,
                                  letterSpacing: 0.9,
                                  color:
                                      const Color.fromARGB(255, 255, 255, 255),
                                  shadows: [
                                    Shadow(
                                      offset: const Offset(0, 3),
                                      blurRadius: 2,
                                      color: Colors.black.withValues(alpha: 0.3),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (widget.sessionUser.canOpenMassiva)
                              Padding(
                                padding: const EdgeInsets.only(right: 10),
                                child: Tooltip(
                                  message: 'Abertura de massivas',
                                  child: Container(
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: isDark
                                          ? Colors.white.withValues(alpha: 0.5)
                                          : Colors.black.withValues(alpha: 0.5),
                                      boxShadow: [
                                        BoxShadow(
                                          color: (isDark
                                                  ? const Color.fromARGB(
                                                      255, 253, 179, 18)
                                                  : Colors.orange)
                                              .withValues(alpha: 0.8),
                                          blurRadius: 18,
                                          spreadRadius: 2,
                                        ),
                                      ],
                                    ),
                                    child: IconButton(
                                      onPressed: _openMassivaPage,
                                      icon: const Icon(
                                        Icons.campaign_outlined,
                                        color:
                                            Color.fromARGB(255, 255, 255, 255),
                                        size: 35,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isDark
                                    ? Colors.white.withValues(alpha: 0.5)
                                    : Colors.black.withValues(alpha: 0.5),
                                boxShadow: [
                                  BoxShadow(
                                    color: (isDark
                                            ? const Color.fromARGB(
                                                255, 253, 179, 18)
                                            : Colors.orange)
                                        .withValues(alpha: 0.8),
                                    blurRadius: 18,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                              child: IconButton(
                                onPressed: widget.onThemeToggle,
                                icon: Icon(
                                  isDark ? Icons.light_mode : Icons.dark_mode,
                                  color:
                                      const Color.fromARGB(255, 255, 255, 255),
                                  size: 36,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 18),

                        // ================= CARDS
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final bool isMobile = constraints.maxWidth < 600;
                            final bool isTablet = constraints.maxWidth >= 600 &&
                                constraints.maxWidth < 1000;

                            final int totalOlts = !headerReady
                                ? 0
                                : _splitters
                                    .map((s) => s.oltCode)
                                    .whereType<String>()
                                    .toSet()
                                    .length;

                            final int totalOltsFiltradas = !headerReady
                                ? 0
                                : _filtered
                                    .map((s) => s.oltCode)
                                    .whereType<String>()
                                    .toSet()
                                    .length;

                            final cards = [
                              _buildStatWrapper(
                                isDark: isDark,
                                child: _statCard(
                                  title: "Clientes ativos",
                                  value: clientesAtivos,
                                  icon: Icons.check_circle_outline,
                                  accent:
                                      const Color.fromARGB(255, 192, 31, 31),
                                  isDark: isDark,
                                ),
                              ),
                              _buildStatWrapper(
                                isDark: isDark,
                                child: _statCard(
                                  title: "Clientes bloqueados",
                                  value: clientesInativos,
                                  icon: Icons.block,
                                  accent:
                                      const Color.fromARGB(255, 192, 31, 31),
                                  isDark: isDark,
                                ),
                              ),
                              _buildStatWrapper(
                                isDark: isDark,
                                child: _statCard(
                                  title: isFiltered
                                      ? "Splitters filtrados"
                                      : "Splitters",
                                  value: headerReady ? splittersExibidos : 0,
                                  subtitle: isFiltered
                                      ? "de ${_splitters.length}"
                                      : null,
                                  icon: Icons.device_hub,
                                  accent:
                                      const Color.fromARGB(255, 192, 31, 31),
                                  isDark: isDark,
                                ),
                              ),
                              _buildStatWrapper(
                                isDark: isDark,
                                child: _statCard(
                                  title: isFiltered
                                      ? "Clientes filtrados"
                                      : "Clientes",
                                  value: isFiltered
                                      ? totalClientesFiltrados
                                      : totalClientes,
                                  subtitle:
                                      isFiltered ? "de $totalClientes" : null,
                                  icon: Icons.people_alt_rounded,
                                  accent:
                                      const Color.fromARGB(255, 192, 31, 31),
                                  isDark: isDark,
                                ),
                              ),
                              _buildStatWrapper(
                                isDark: isDark,
                                child: _statCard(
                                  title: isFiltered ? "OLTs filtradas" : "OLTs",
                                  value: isFiltered
                                      ? totalOltsFiltradas
                                      : totalOlts,
                                  subtitle: isFiltered ? "de $totalOlts" : null,
                                  icon: Icons.router,
                                  accent:
                                      const Color.fromARGB(255, 192, 31, 31),
                                  isDark: isDark,
                                ),
                              ),
                            ];

                            // 📱 MOBILE → 1 por linha
                            if (isMobile) {
                              return Column(
                                children: cards
                                    .map((c) => Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 12),
                                          child: c,
                                        ))
                                    .toList(),
                              );
                            }

                            // 📲 TABLET → 2 + 2 + 1
                            if (isTablet) {
                              return Column(
                                children: [
                                  Row(
                                    children: [
                                      Expanded(child: cards[0]),
                                      const SizedBox(width: 12),
                                      Expanded(child: cards[1]),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(child: cards[2]),
                                      const SizedBox(width: 12),
                                      Expanded(child: cards[3]),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  cards[4],
                                ],
                              );
                            }

                            // 🖥️ DESKTOP → 5 lado a lado
                            return Row(
                              children: [
                                for (int i = 0; i < cards.length; i++) ...[
                                  Expanded(child: cards[i]),
                                  if (i < cards.length - 1)
                                    const SizedBox(width: 14),
                                ]
                              ],
                            );
                          },
                        ),

                        const SizedBox(height: 16),

                        // ================= BUSCA
                        _searchBar(isDark),
                        const SizedBox(height: 12),

                        // ================= FILTROS
                        Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1000),
                            child: _filterChips(isDark),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatWrapper({
    required bool isDark,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? const Color.fromARGB(255, 109, 71, 0)
            : const Color.fromARGB(248, 247, 185, 52),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.52),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _filterChips(bool isDark) {
    return Wrap(
      alignment: WrapAlignment.center, // 🔥 CENTRALIZA
      spacing: 10,
      runSpacing: 8,
      children: [
        // 🔌 OLT
        _filterChip(
          isDark: isDark,
          icon: Icons.router,
          label: _oltsSelecionadas.isEmpty
              ? 'OLT'
              : _oltsSelecionadas.length == 1
                  ? (_oltService
                          .getBySplitterCode(_oltsSelecionadas.first)
                          ?.title ??
                      _oltsSelecionadas.first)
                  : 'OLT (${_oltsSelecionadas.length})',
          selected: _oltsSelecionadas.isNotEmpty,
          activeColor: Colors.blueAccent,
          onTap: () async {
            final selected = await _selectOltsDialog();
            if (selected == null || !mounted) return;
            setState(() => _oltsSelecionadas = selected);
            _applyFilters();
          },
        ),

        // 🚦 STATUS
        _filterChip(
          isDark: isDark,
          icon: Icons.warning_amber_rounded,
          label: _statusSelecionados.isEmpty
              ? 'Status'
              : _statusSelecionados.length == 1
                  ? _statusSelecionados.first.name
                  : 'Status (${_statusSelecionados.length})',
          selected: _statusSelecionados.isNotEmpty,
          activeColor: _statusSelecionados.contains(SplitterStatus.excedente)
              ? const Color.fromARGB(255, 117, 6, 6) // ou vermelho escuro
              : _statusSelecionados.contains(SplitterStatus.critico)
                  ? Colors.redAccent
                  : _statusSelecionados.contains(SplitterStatus.alerta)
                      ? Colors.orangeAccent
                      : Colors.green,
          onTap: () async {
            final selected = await _selectStatusDialog();
            if (selected == null || !mounted) return;
            setState(() => _statusSelecionados = selected);
            _applyFilters();
          },
        ),

        // 🛣️ RUA
        _filterChip(
          isDark: isDark,
          icon: Icons.signpost_outlined,
          label: _ruasSelecionadas.isEmpty
              ? 'Rua'
              : _ruasSelecionadas.length == 1
                  ? _ruasSelecionadas.first
                  : 'Rua (${_ruasSelecionadas.length})',
          selected: _ruasSelecionadas.isNotEmpty,
          activeColor: Colors.blueAccent,
          onTap: () async {
            final selected = await _selectRuaDialog();
            if (selected == null || !mounted) return;
            setState(() => _ruasSelecionadas = selected);
            _applyFilters();
          },
        ),

        // ❌ LIMPAR FILTROS
        if (_oltsSelecionadas.isNotEmpty ||
            _statusSelecionados.isNotEmpty ||
            _ruasSelecionadas.isNotEmpty)
          _filterChip(
            isDark: isDark,
            icon: Icons.clear_all_rounded,
            label: 'Limpar',
            selected: true,
            activeColor: Colors.redAccent,
            onTap: () {
              setState(() {
                _oltsSelecionadas.clear();
                _statusSelecionados.clear();
                _ruasSelecionadas.clear();
              });
              _applyFilters();
            },
          ),
      ],
    );
  }

  Future<Set<String>?> _selectOltsDialog() async {
    // 🔹 pega todas as OLTs resolvidas a partir dos splitters
    final Map<String, OltModel> oltsMap = {};

    for (final s in _splitters) {
      if (s.oltCode == null) continue;

      final olt = _oltService.getBySplitterCode(s.oltCode);
      if (olt != null) {
        oltsMap[s.oltCode!] = olt;
      }
    }

    final List<OltModel> olts = oltsMap.values.toList()
      ..sort((a, b) => a.title.compareTo(b.title));

    final selected = await _showMultiSelectSearchDialog<OltModel>(
      title: 'Filtrar por OLT',
      items: olts,
      label: (olt) => olt.title, // ✅ DESCRIÇÃO
      initialSelected:
          olts.where((olt) => _oltsSelecionadas.contains(olt.code)).toSet(),
    );

    return selected?.map((olt) => olt.code).toSet();
  }

  Future<Set<SplitterStatus>?> _selectStatusDialog() {
    return _showMultiSelectSearchDialog<SplitterStatus>(
      title: 'Filtrar por Status',
      items: SplitterStatus.values,
      label: (s) => s.name,
      initialSelected: Set<SplitterStatus>.from(_statusSelecionados),
    );
  }

  Future<Set<String>?> _selectRuaDialog() async {
    _ruasCacheOrdenadas = _streetBySplitter.values.toSet().toList()..sort();

    final ruas = _ruasCacheOrdenadas!;

    return _showMultiSelectSearchDialog<String>(
      title: 'Filtrar por Rua',
      items: ruas,
      label: (r) => r,
      initialSelected:
          _ruasSelecionadas.where((rua) => ruas.contains(rua)).toSet(),
    );
  }

  Widget _statCard({
    required String title,
    required int value,
    String? subtitle, // ex: "de 19489"
    required IconData icon,
    required Color accent,
    required bool isDark,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final bool isMobile = constraints.maxWidth < 460;
        final bool hasSubtitle = subtitle != null;

        final String valueFormatted =
            NumberFormat.decimalPattern('pt_BR').format(value);

        final String? subtitleFormatted = hasSubtitle
            ? 'de ${NumberFormat.decimalPattern('pt_BR').format(
                int.tryParse(
                      subtitle.replaceAll(RegExp(r'[^0-9]'), ''),
                    ) ??
                    0,
              )}'
            : null;

        return ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: isMobile ? 72 : 96,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
              child: Container(
                padding: EdgeInsets.all(isMobile ? 12 : 20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      accent.withValues(alpha: isDark ? 0.55 : 0.60),
                      accent.withValues(alpha: 0.18),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: isDark ? 0.08 : 0.12),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 18,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // 🔹 ÍCONE PREMIUM
                    Container(
                      width: isMobile ? 52 : 58,
                      height: isMobile ? 52 : 58,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            accent.withValues(alpha: 0.95),
                            accent.withValues(alpha: 0.75),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: accent.withValues(alpha: 0.6),
                            blurRadius: 14,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: Icon(
                        icon,
                        color: Colors.white,
                        size: isMobile ? 22 : 30,
                      ),
                    ),

                    const SizedBox(width: 14),

                    // 🔹 TEXTO
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            valueFormatted,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: isMobile ? 20 : 24,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                              color: Colors.white,
                              height: 1,
                            ),
                          ),
                          if (hasSubtitle)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                subtitleFormatted!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: isMobile ? 11 : 12,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white.withValues(alpha: 0.75),
                                ),
                              ),
                            ),
                          const SizedBox(height: 4),
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: isMobile ? 12 : 13,
                              fontWeight: FontWeight.w500,
                              color: Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _searchBar(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? const Color.fromARGB(255, 78, 78, 78).withValues(alpha: 0.7)
            : Colors.white.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            blurRadius: 8,
            color: Colors.black.withValues(alpha: 0.05),
          ),
        ],
      ),
      child: TextField(
        controller: _searchController,
        onChanged: (_) => _applyFilters(),
        style: TextStyle(
          color:
              isDark ? Colors.white : Colors.black, // 🔥 cor do texto digitado
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
        decoration: InputDecoration(
          hintText: "Buscar splitter/cliente…",
          hintStyle: TextStyle(
            color: isDark
                ? const Color.fromARGB(255, 255, 255, 255)
                : const Color.fromARGB(255, 71, 71, 71),
            fontSize: 15,
          ),
          prefixIcon: Icon(
            Icons.search,
            color: isDark
                ? const Color.fromARGB(255, 255, 255, 255)
                : const Color.fromARGB(255, 0, 0, 0),
          ),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        ),
      ),
    );
  }

  Widget _filterChip({
    required bool selected,
    required VoidCallback onTap,
    required IconData icon,
    required String label,
    required Color activeColor,
    required bool isDark,
  }) {
    final baseColor = isDark
        ? const Color.fromARGB(255, 78, 78, 78).withValues(alpha: 1.00)
        : const Color.fromARGB(255, 226, 226, 226).withValues(alpha: 1.00);

    final textColor = selected
        ? const Color.fromARGB(255, 255, 255, 255)
        : isDark
            ? const Color.fromARGB(
                255, 255, 255, 255) // 🔥 DARK MODE (não selecionado)
            : const Color.fromARGB(
                255, 24, 23, 23); // ☀️ LIGHT MODE (não selecionado)

    final iconColor = selected
        ? Colors.white
        : isDark
            ? const Color.fromARGB(206, 255, 255, 255)
            : const Color.fromARGB(255, 105, 105, 105);

    return ChoiceChip(
      selected: selected,
      onSelected: (_) => onTap(),
      elevation: selected ? 6 : 6,
      pressElevation: 8,
      shadowColor: isDark
          ? Colors.black.withValues(alpha: 0.50)
          : Colors.black.withValues(alpha: 0.50),
      padding: const EdgeInsets.symmetric(
        horizontal: 20,
        vertical: 8,
      ),
      avatar: Icon(
        icon,
        size: 20,
        color: iconColor,
      ),
      label: Text(
        label,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
      selectedColor: activeColor,
      backgroundColor: baseColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide.none, // ❌ REMOVE A BORDA
      ),
    );
  }

  bool _refreshing = false;

  Future<void> _refreshSilencioso() async {
    if (_refreshing) return;
    _refreshing = true;

    try {
      await _service.refreshClientesCache();
      if (!mounted) return;
      _atualizarSnapshotLocal();
    } finally {
      _refreshing = false;
    }
  }

  void _atualizarSnapshotLocal({String? splitterCode}) {
    final snapshot = _service.getOcupacaoSnapshot();

    setState(() {
      if (splitterCode != null) {
        _ocupacaoSnapshot[splitterCode] = snapshot[splitterCode] ?? 0;
      } else {
        _ocupacaoSnapshot = snapshot;
      }

      _totalClientesSnapshot =
          _ocupacaoSnapshot.values.fold(0, (a, b) => a + b);
    });

    _statusCache.clear(); // 🔥 IMPORTANTE
    _buildClientesIndex();
    _recalcularStatusClientes();
    _applyFilters();
  }
}

