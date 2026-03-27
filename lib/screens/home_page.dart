// ignore_for_file: uri_does_not_exist, undefined_method

import 'package:flutter/material.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/services/olt_service.dart';
import 'package:nexaview/services/splitter_service.dart';
import 'package:nexaview/widgets/splitter_card.dart';
import 'package:nexaview/screens/splitter_detail_page.dart';
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
import 'dart:ui';
import 'dart:async';

/// Tela principal do app.
///
/// Aqui ficam o bootstrap da listagem, filtros, busca e os atalhos para as
/// demais areas operacionais, como detalhe do splitter e massivas.
class HomePage extends StatefulWidget {
  final VoidCallback onThemeToggle;
  final SplitterService splitterService;
  final String token;
  final AppSessionUser sessionUser;
  final String massivaApiGatewayEndpoint;
  final String massivaAffectedUsersEndpoint;
  final String ellevenMassivaListEndpoint;
  final String autoIspEventsEndpoint;
  final String autoIspAuthEndpoint;
  final String autoIspUsername;
  final String autoIspPassword;
  final String massivaCookieString;
  final String hubGoogleIdTokenEndpoint;
  final String geogridBaseUrl;
  final String geogridApiKey;

  const HomePage({
    super.key,
    required this.onThemeToggle,
    required this.splitterService,
    required this.token,
    required this.sessionUser,
    required this.massivaApiGatewayEndpoint,
    required this.massivaAffectedUsersEndpoint,
    required this.ellevenMassivaListEndpoint,
    required this.autoIspEventsEndpoint,
    required this.autoIspAuthEndpoint,
    required this.autoIspUsername,
    required this.autoIspPassword,
    required this.massivaCookieString,
    required this.hubGoogleIdTokenEndpoint,
    required this.geogridBaseUrl,
    required this.geogridApiKey,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final SplitterService _service;
  late final String _token;
  late final OltService _oltService;
  late final GeoGridService _geoGridService;
  Timer? _clientesAutoRefreshTimer;
  Timer? _desktopSidebarAnimationTimer;

  @override
  void dispose() {
    _clientesAutoRefreshTimer?.cancel();
    _desktopSidebarAnimationTimer?.cancel();
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
  bool _desktopSidebarCollapsed = false;
  bool _desktopSidebarContentCollapsed = false;

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

  int get _desktopActiveFilterCount {
    var count = 0;
    if (_oltsSelecionadas.isNotEmpty) count++;
    if (_statusSelecionados.isNotEmpty) count++;
    if (_ruasSelecionadas.isNotEmpty) count++;
    return count;
  }

  @override
  void initState() {
    super.initState();

    _service = widget.splitterService;
    _token = widget.token;
    _oltService = OltService(_token);

    _geoGridService = GeoGridService(
      baseUrl: widget.geogridBaseUrl,
      apiKey: widget.geogridApiKey,
    );

    // 🔥 Bootstrap assíncrono (obrigatório no Web)
    // O bootstrap eh adiado para o primeiro frame para evitar travar a
    // montagem inicial da tela, especialmente no Flutter Web.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bootstrap();
    });

    _iniciarAutoRefreshClientes();
  }

  void _iniciarAutoRefreshClientes() {
    _clientesAutoRefreshTimer?.cancel();

    // Mantem a ocupacao atualizada sem depender de refresh manual do usuario.
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

  void _toggleDesktopSidebar() {
    final nextCollapsed = !_desktopSidebarCollapsed;
    _desktopSidebarAnimationTimer?.cancel();

    if (nextCollapsed) {
      setState(() {
        _desktopSidebarCollapsed = true;
        _desktopSidebarContentCollapsed = true;
      });
      return;
    }

    setState(() {
      _desktopSidebarCollapsed = false;
    });

    _desktopSidebarAnimationTimer = Timer(
      const Duration(milliseconds: 240),
      () {
        if (!mounted || _desktopSidebarCollapsed) return;
        setState(() {
          _desktopSidebarContentCollapsed = false;
        });
      },
    );
  }

  Future<void> _openMassivaPage() async {
    if (!widget.sessionUser.canAccessMassiva) return;

    // A tela de massiva recebe tudo por injecao para ficar desacoplada do
    // bootstrap da HomePage e facilitar manutencao.
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MassivaPage(
          gatewayService: MassivaGatewayService(
            endpoint: widget.massivaApiGatewayEndpoint,
            listEndpoint: widget.ellevenMassivaListEndpoint,
            token: widget.sessionUser.sessionToken!,
            affectedUsersEndpoint: widget.massivaAffectedUsersEndpoint,
            sessionToken: widget.sessionUser.sessionToken,
            hubGoogleIdTokenEndpoint: widget.hubGoogleIdTokenEndpoint,
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
    // Garante que o fluxo de bootstrap rode uma unica vez por sessao.
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
      // Primeiro tenta reidratar cache local para abrir a tela rapidamente.
      // Se o cache estiver vencido, o refresh em background busca os dados
      // novos sem bloquear a interface.
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
      // Depois carrega a lista base de splitters, usada por cards, filtros e
      // navegacao para a tela de detalhes.
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
      // As OLTs sao carregadas separadamente porque alimentam os filtros.
      if (!_oltService.isLoaded) {
        debugPrint("📡 Carregando OLTs...");
        await _oltService.loadOlts();
        if (!mounted) return;
      }

      // =====================================================
      // 3️⃣ PRIMEIRA CARGA REAL (SOMENTE SE NÃO EXISTE CACHE)
      // =====================================================
      // So faz carga completa de clientes se ainda nao houve restauracao local.
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
      // Ruas ficam em cache para reduzir reverse geocode repetido.
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
      // Enderecos sao resolvidos em background porque esta etapa costuma ser
      // a mais lenta e nao precisa bloquear a listagem.
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

    // Toda a logica de filtro fica concentrada aqui para evitar divergencia
    // entre busca textual, filtros por OLT/status e cache de clientes.
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
      // Tenta usar, nesta ordem:
      // 1. rua vinda da API de splitters
      // 2. rua persistida em cache local
      // 3. reverse geocode pelas coordenadas
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

  /*
  Future<void> _openQR() async {
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const SizedBox.shrink()),
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

  }
  */

  Future<void> _openSplitterDetails(SplitterModel splitter) async {
    final clientes = await _service.getClientesInstant(splitter.code);
    final olt = _oltService.getBySplitterCode(splitter.oltCode);

    if (!mounted) return;

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
          token: widget.token,
        ),
      ),
    );

    if (updated == true) {
      await _service.refreshClientesPorSplitter(splitter.code);
      _atualizarSnapshotLocal(splitterCode: splitter.code);
    }
  }

  void _clearSelectedFilters() {
    setState(() {
      _oltsSelecionadas.clear();
      _statusSelecionados.clear();
      _ruasSelecionadas.clear();
    });
    _applyFilters();
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

    final bool useDesktopShell = MediaQuery.of(context).size.width >= 1100;

    if (useDesktopShell) {
      return _buildDesktopHome(
        isDark,
        headerReady: headerReady,
        totalClientes: totalClientes,
        totalClientesFiltrados: totalClientesFiltrados,
        splittersExibidos: splittersExibidos,
        isFiltered: isFiltered,
      );
    }

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
                                  onTap: () => _openSplitterDetails(splitter),
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
                                  onTap: () => _openSplitterDetails(splitter),
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

  Widget _buildDesktopHome(
    bool isDark, {
    required bool headerReady,
    required int totalClientes,
    required int totalClientesFiltrados,
    required int splittersExibidos,
    required bool isFiltered,
  }) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isNotebook = screenWidth < 1500;
    final isTightNotebook = screenWidth < 1360;

    final int totalOlts = !headerReady
        ? 0
        : _splitters.map((s) => s.oltCode).whereType<String>().toSet().length;
    final int totalOltsFiltradas = !headerReady
        ? 0
        : _filtered.map((s) => s.oltCode).whereType<String>().toSet().length;

    final cards = [
      _buildStatWrapper(
        isDark: isDark,
        child: _statCard(
          title: "Clientes ativos",
          value: headerReady ? _totalClientesAtivos : 0,
          icon: Icons.check_circle_outline,
          accent: const Color.fromARGB(255, 192, 31, 31),
          isDark: isDark,
        ),
      ),
      _buildStatWrapper(
        isDark: isDark,
        child: _statCard(
          title: "Clientes bloqueados",
          value: headerReady ? _totalClientesInativos : 0,
          icon: Icons.block,
          accent: const Color.fromARGB(255, 192, 31, 31),
          isDark: isDark,
        ),
      ),
      _buildStatWrapper(
        isDark: isDark,
        child: _statCard(
          title: isFiltered ? "Splitters filtrados" : "Splitters",
          value: headerReady ? splittersExibidos : 0,
          subtitle: isFiltered ? "de ${_splitters.length}" : null,
          icon: Icons.device_hub,
          accent: const Color.fromARGB(255, 192, 31, 31),
          isDark: isDark,
        ),
      ),
      _buildStatWrapper(
        isDark: isDark,
        child: _statCard(
          title: isFiltered ? "Clientes filtrados" : "Clientes",
          value: isFiltered ? totalClientesFiltrados : totalClientes,
          subtitle: isFiltered ? "de $totalClientes" : null,
          icon: Icons.people_alt_rounded,
          accent: const Color.fromARGB(255, 192, 31, 31),
          isDark: isDark,
        ),
      ),
      _buildStatWrapper(
        isDark: isDark,
        child: _statCard(
          title: isFiltered ? "OLTs filtradas" : "OLTs",
          value: isFiltered ? totalOltsFiltradas : totalOlts,
          subtitle: isFiltered ? "de $totalOlts" : null,
          icon: Icons.router,
          accent: const Color.fromARGB(255, 192, 31, 31),
          isDark: isDark,
        ),
      ),
    ];

    return Scaffold(
      backgroundColor:
          isDark ? const Color(0xFF161616) : const Color(0xFFF5F1EA),
      body: SafeArea(
        child: Stack(
          children: [
            Row(
              children: [
                _buildDesktopSidebar(
                  isDark,
                  compactDesktop: isNotebook,
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _refreshSilencioso,
                    child: CustomScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      physics: const AlwaysScrollableScrollPhysics(),
                      slivers: [
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: EdgeInsets.fromLTRB(
                              isNotebook ? 16 : 24,
                              isNotebook ? 16 : 18,
                              isNotebook ? 16 : 24,
                              20,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildDesktopHero(
                                  isDark,
                                  splittersExibidos: splittersExibidos,
                                  isFiltered: isFiltered,
                                ),
                                const SizedBox(height: 18),
                                LayoutBuilder(
                                  builder: (context, constraints) {
                                    final spacing = isNotebook ? 12.0 : 14.0;
                                    final availableWidth = constraints.maxWidth;
                                    final targetWidth = availableWidth >= 1500
                                        ? (availableWidth - (spacing * 4)) / 5
                                        : availableWidth >= 1280
                                            ? (availableWidth - (spacing * 3)) /
                                                4
                                            : (availableWidth - (spacing * 2)) /
                                                3;

                                    return Wrap(
                                      spacing: spacing,
                                      runSpacing: spacing,
                                      children: cards
                                          .map(
                                            (card) => SizedBox(
                                              width: targetWidth
                                                  .clamp(
                                                    isNotebook ? 205.0 : 220.0,
                                                    isNotebook ? 290.0 : 320.0,
                                                  )
                                                  .toDouble(),
                                              child: card,
                                            ),
                                          )
                                          .toList(),
                                    );
                                  },
                                ),
                                const SizedBox(height: 18),
                                _buildDesktopSearchPanel(
                                  isDark,
                                  compactDesktop: isTightNotebook,
                                ),
                                if (_hasFiltroAtivo) ...[
                                  const SizedBox(height: 14),
                                  _buildDesktopFilterSummary(isDark),
                                ],
                                const SizedBox(height: 18),
                                _buildDesktopSectionTitle(
                                  isDark,
                                  title: 'Painel de Splitters',
                                  subtitle:
                                      'Acompanhe a ocupacao, pesquise equipamentos e abra o detalhe operacional de cada splitter.',
                                ),
                                const SizedBox(height: 14),
                              ],
                            ),
                          ),
                        ),
                        if (_filtered.isEmpty)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: EdgeInsets.fromLTRB(
                                isNotebook ? 16 : 24,
                                0,
                                isNotebook ? 16 : 24,
                                32,
                              ),
                              child: _buildDesktopEmptyState(isDark),
                            ),
                          )
                        else
                          SliverPadding(
                            padding: EdgeInsets.fromLTRB(
                              isNotebook ? 16 : 24,
                              0,
                              isNotebook ? 16 : 24,
                              32,
                            ),
                            sliver: SliverGrid(
                              delegate: SliverChildBuilderDelegate(
                                (context, index) {
                                  final splitter = _filtered[index];
                                  return SplitterCard(
                                    splitter: splitter,
                                    ocupacao:
                                        _ocupacaoSnapshot[splitter.code] ?? 0,
                                    onTap: () => _openSplitterDetails(splitter),
                                  );
                                },
                                childCount: _filtered.length,
                              ),
                              gridDelegate:
                                  SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: MediaQuery.of(context)
                                            .size
                                            .width >=
                                        1680
                                    ? 4
                                    : MediaQuery.of(context).size.width >= 1500
                                        ? 3
                                        : 2,
                                mainAxisSpacing: isNotebook ? 12 : 14,
                                crossAxisSpacing: isNotebook ? 12 : 14,
                                childAspectRatio: isNotebook ? 2.85 : 2.95,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
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
                          "Carregando clientes...",
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

  Widget _buildDesktopSidebar(
    bool isDark, {
    bool compactDesktop = false,
  }) {
    final collapsed = _desktopSidebarCollapsed;
    final contentCollapsed = _desktopSidebarContentCollapsed;
    final surface = isDark ? const Color(0xFF232323) : const Color(0xFFFBF8F2);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.black.withValues(alpha: 0.08);
    final expandedWidth = compactDesktop ? 250.0 : 290.0;
    final collapsedWidth = compactDesktop ? 84.0 : 92.0;
    final outerMargin = compactDesktop ? 12.0 : 16.0;
    final innerPadding = compactDesktop ? 12.0 : 14.0;
    final logoSize = compactDesktop ? 46.0 : 52.0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      clipBehavior: Clip.antiAlias,
      width: collapsed ? collapsedWidth : expandedWidth,
      margin: EdgeInsets.fromLTRB(outerMargin, outerMargin, 0, outerMargin),
      padding: EdgeInsets.fromLTRB(
        innerPadding,
        compactDesktop ? 14 : 18,
        innerPadding,
        innerPadding,
      ),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.08),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: compactDesktop ? 10 : 14),
        child: Column(
          crossAxisAlignment: contentCollapsed
              ? CrossAxisAlignment.center
              : CrossAxisAlignment.start,
          children: [
            if (contentCollapsed)
              Column(
                children: [
                  Container(
                    width: logoSize,
                    height: logoSize,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color.fromARGB(255, 255, 174, 0),
                          Color.fromARGB(255, 222, 120, 0),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Image.asset(
                        'assets/icons/logo-circular-sebratel.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  SizedBox(height: compactDesktop ? 6 : 8),
                  IconButton(
                    tooltip: 'Expandir menu',
                    onPressed: _toggleDesktopSidebar,
                    icon: Icon(
                      Icons.keyboard_double_arrow_right_rounded,
                      color: isDark ? Colors.white70 : Colors.black54,
                    ),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Container(
                    width: logoSize,
                    height: logoSize,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color.fromARGB(255, 255, 174, 0),
                          Color.fromARGB(255, 222, 120, 0),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Image.asset(
                        'assets/icons/logo-circular-sebratel.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  SizedBox(width: compactDesktop ? 10 : 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Operação',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontWeight: FontWeight.w800,
                            fontSize: compactDesktop ? 16 : 18,
                          ),
                        ),
                        Text(
                          'Dashboard Sebratel',
                          style: TextStyle(
                            color: isDark ? Colors.white60 : Colors.black54,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Recolher menu',
                    onPressed: _toggleDesktopSidebar,
                    icon: Icon(
                      Icons.keyboard_double_arrow_left_rounded,
                      color: isDark ? Colors.white70 : Colors.black54,
                    ),
                  ),
                ],
              ),
            SizedBox(height: compactDesktop ? 18 : 22),
            _buildDesktopSidebarSection(
              isDark,
              title: 'Navegação',
              children: [
                _buildDesktopSidebarButton(
                  isDark,
                  icon: Icons.hub_outlined,
                  label: 'Splitters',
                  selected: true,
                  onTap: () {},
                ),
                if (widget.sessionUser.canAccessMassiva)
                  _buildDesktopSidebarButton(
                    isDark,
                    icon: Icons.campaign_outlined,
                    label: 'Massivas',
                    highlighted: true,
                    onTap: _openMassivaPage,
                  ),
                _buildDesktopSidebarButton(
                  isDark,
                  icon: Icons.sync_rounded,
                  label: 'Atualizar dados',
                  onTap: _refreshSilencioso,
                ),
              ],
            ),
            const SizedBox(height: 18),
            _buildDesktopSidebarSection(
              isDark,
              title: 'Filtros',
              children: [
                _buildDesktopSidebarButton(
                  isDark,
                  icon: Icons.router,
                  label: _oltsSelecionadas.isEmpty
                      ? 'Filtrar OLT'
                      : _oltsSelecionadas.length == 1
                          ? 'OLT selecionada'
                          : '${_oltsSelecionadas.length} OLTs',
                  subtitle: _oltsSelecionadas.isEmpty
                      ? 'Escolha uma ou mais OLTs'
                      : null,
                  active: _oltsSelecionadas.isNotEmpty,
                  onTap: () async {
                    final selected = await _selectOltsDialog();
                    if (selected == null || !mounted) return;
                    setState(() => _oltsSelecionadas = selected);
                    _applyFilters();
                  },
                ),
                _buildDesktopSidebarButton(
                  isDark,
                  icon: Icons.warning_amber_rounded,
                  label: _statusSelecionados.isEmpty
                      ? 'Filtrar Status'
                      : _statusSelecionados.length == 1
                          ? _statusSelecionados.first.name
                          : '${_statusSelecionados.length} status',
                  subtitle: _statusSelecionados.isEmpty
                      ? 'Critico, alerta, excedente'
                      : null,
                  active: _statusSelecionados.isNotEmpty,
                  onTap: () async {
                    final selected = await _selectStatusDialog();
                    if (selected == null || !mounted) return;
                    setState(() => _statusSelecionados = selected);
                    _applyFilters();
                  },
                ),
                _buildDesktopSidebarButton(
                  isDark,
                  icon: Icons.signpost_outlined,
                  label: _ruasSelecionadas.isEmpty
                      ? 'Filtrar Rua'
                      : _ruasSelecionadas.length == 1
                          ? _ruasSelecionadas.first
                          : '${_ruasSelecionadas.length} ruas',
                  subtitle: _ruasSelecionadas.isEmpty
                      ? 'Refine por logradouro'
                      : null,
                  active: _ruasSelecionadas.isNotEmpty,
                  onTap: () async {
                    final selected = await _selectRuaDialog();
                    if (selected == null || !mounted) return;
                    setState(() => _ruasSelecionadas = selected);
                    _applyFilters();
                  },
                ),
                if (_oltsSelecionadas.isNotEmpty ||
                    _statusSelecionados.isNotEmpty ||
                    _ruasSelecionadas.isNotEmpty)
                  _buildDesktopSidebarButton(
                    isDark,
                    icon: Icons.clear_all_rounded,
                    label: 'Limpar filtros',
                    highlighted: true,
                    onTap: _clearSelectedFilters,
                  ),
              ],
            ),
            const SizedBox(height: 18),
            _buildDesktopSidebarButton(
              isDark,
              icon: isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              label: isDark ? 'Tema claro' : 'Tema escuro',
              onTap: widget.onThemeToggle,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDesktopSidebarSection(
    bool isDark, {
    required String title,
    required List<Widget> children,
  }) {
    final collapsed = _desktopSidebarContentCollapsed;
    return Column(
      crossAxisAlignment:
          collapsed ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        if (!collapsed)
          Padding(
            padding: const EdgeInsets.only(left: 6, bottom: 10),
            child: Text(
              title,
              style: TextStyle(
                color: isDark ? Colors.white60 : Colors.black54,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ...children,
      ],
    );
  }

  Widget _buildDesktopSidebarButton(
    bool isDark, {
    required IconData icon,
    required String label,
    String? subtitle,
    VoidCallback? onTap,
    bool selected = false,
    bool active = false,
    bool highlighted = false,
  }) {
    final collapsed = _desktopSidebarContentCollapsed;
    final backgroundColor = selected
        ? const Color.fromARGB(255, 255, 174, 0)
        : highlighted
            ? const Color.fromARGB(255, 192, 31, 31).withValues(alpha: 0.12)
            : active
                ? const Color.fromARGB(255, 255, 174, 0).withValues(alpha: 0.16)
                : Colors.transparent;
    final borderColor = selected
        ? Colors.transparent
        : highlighted
            ? const Color.fromARGB(255, 192, 31, 31).withValues(alpha: 0.25)
            : active
                ? const Color.fromARGB(255, 255, 174, 0).withValues(alpha: 0.22)
                : (isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.black.withValues(alpha: 0.05));
    final foregroundColor = selected
        ? const Color(0xFF1F1F1F)
        : highlighted
            ? const Color.fromARGB(255, 192, 31, 31)
            : active
                ? const Color.fromARGB(255, 194, 121, 0)
                : (isDark ? Colors.white : const Color(0xFF1F1F1F));

    final button = Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.only(bottom: 8),
          padding: EdgeInsets.symmetric(
            horizontal: collapsed ? 0 : 14,
            vertical: collapsed ? 12 : 14,
          ),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: borderColor),
          ),
          child: collapsed
              ? Center(
                  child: Icon(icon, color: foregroundColor, size: 22),
                )
              : Row(
                  children: [
                    Icon(icon, color: foregroundColor, size: 22),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: foregroundColor,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                          if (subtitle != null && subtitle.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Text(
                                subtitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color:
                                      isDark ? Colors.white60 : Colors.black54,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );

    return Tooltip(
      message: label,
      child: button,
    );
  }

  Widget _buildDesktopHero(
    bool isDark, {
    required int splittersExibidos,
    required bool isFiltered,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 1380;

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? const [Color(0xFF2B2B2B), Color(0xFF1E1E1E)]
                  : const [
                      Color.fromARGB(255, 255, 196, 70),
                      Color.fromARGB(255, 245, 241, 234),
                    ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.26 : 0.08),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: compact
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDesktopHeroIntro(isDark),
                    const SizedBox(height: 14),
                    _buildDesktopHeroSummary(
                      isDark,
                      splittersExibidos: splittersExibidos,
                      isFiltered: isFiltered,
                    ),
                  ],
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _buildDesktopHeroIntro(isDark)),
                    const SizedBox(width: 14),
                    SizedBox(
                      width: 236,
                      child: _buildDesktopHeroSummary(
                        isDark,
                        splittersExibidos: splittersExibidos,
                        isFiltered: isFiltered,
                      ),
                    ),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildDesktopSearchPanel(
    bool isDark, {
    bool compactDesktop = false,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = compactDesktop || constraints.maxWidth < 1320;

        return Container(
          width: double.infinity,
          padding: EdgeInsets.all(compactDesktop ? 18 : 20),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF232323) : Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : Colors.black.withValues(alpha: 0.05),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.06),
                blurRadius: 18,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: compact
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDesktopSearchIntro(isDark),
                    const SizedBox(height: 16),
                    _searchBar(isDark),
                    const SizedBox(height: 16),
                    _buildDesktopSearchStatusCard(isDark),
                  ],
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildDesktopSearchIntro(isDark),
                          const SizedBox(height: 16),
                          _searchBar(isDark),
                        ],
                      ),
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      child: _buildDesktopSearchStatusCard(isDark),
                    ),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildDesktopHeroIntro(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.white.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            'Centro operacional de splitters',
            style: TextStyle(
              color: isDark ? Colors.white70 : const Color(0xFF5C4300),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Operacão de rede com foco em agilidade, contexto e respostas rápidas.',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF1F1F1F),
            fontSize: 28,
            fontWeight: FontWeight.w900,
            height: 1.0,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Use o menu lateral para abrir massivas, filtrar por OLTs, status e ruas.',
          style: TextStyle(
            color: isDark ? Colors.white70 : const Color(0xFF4E4E4E),
            fontSize: 14,
            height: 1.1,
          ),
        ),
      ],
    );
  }

  Widget _buildDesktopHeroSummary(
    bool isDark, {
    required int splittersExibidos,
    required bool isFiltered,
  }) {
    final searchActive = _searchController.text.trim().isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.white.withValues(alpha: 0.80),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.05),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Visão atual',
            style: TextStyle(
              color: isDark ? Colors.white70 : Colors.black54,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '$splittersExibidos',
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF1F1F1F),
              fontSize: 38,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isFiltered
                ? 'Splitters visíveis filtrados'
                : 'Splitters monitorados nesta sessão',
            style: TextStyle(
              color: isDark ? Colors.white70 : const Color(0xFF4E4E4E),
              fontWeight: FontWeight.w600,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildDesktopMiniPill(
                isDark,
                icon: Icons.tune_rounded,
                label: _desktopActiveFilterCount == 0
                    ? 'Sem filtros'
                    : '${_desktopActiveFilterCount} filtros',
              ),
              _buildDesktopMiniPill(
                isDark,
                icon: Icons.search_rounded,
                label: searchActive ? 'Busca ativa' : 'Busca livre',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopSearchIntro(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Busca operacional',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF1F1F1F),
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Pesquise por código, nome ou cliente vinculado de um splitter.',
          style: TextStyle(
            color: isDark ? Colors.white60 : Colors.black54,
            height: 1.4,
          ),
        ),
      ],
    );
  }

  Widget _buildDesktopSearchStatusCard(bool isDark) {
    final searchActive = _searchController.text.trim().isNotEmpty;
    final hasRefinement = _desktopActiveFilterCount > 0 || searchActive;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.04)
            : const Color(0xFFF7F4EE),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'Estado da busca',
            style: TextStyle(
              color: isDark ? Colors.white70 : Colors.black54,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildDesktopMiniPill(
                isDark,
                icon: Icons.view_list_rounded,
                label: hasRefinement ? 'Lista refinada' : 'Lista completa',
              ),
              _buildDesktopMiniPill(
                isDark,
                icon: Icons.tune_rounded,
                label: _desktopActiveFilterCount == 0
                    ? 'Sem filtros'
                    : '${_desktopActiveFilterCount} filtros',
              ),
              _buildDesktopMiniPill(
                isDark,
                icon: Icons.search_rounded,
                label: searchActive ? 'Busca ativa' : 'Sem busca',
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            hasRefinement
                ? 'A listagem foi refinada para acelerar a leitura operacional.'
                : 'Painel para a visão completa da operação.',
            style: TextStyle(
              color: isDark ? Colors.white60 : Colors.black54,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopMiniPill(
    bool isDark, {
    required IconData icon,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.08)
            : Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.07)
              : Colors.black.withValues(alpha: 0.05),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 15,
            color: isDark ? Colors.white70 : const Color(0xFF7A5C12),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF1F1F1F),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopFilterSummary(bool isDark) {
    final chips = <Widget>[];

    if (_searchController.text.trim().isNotEmpty) {
      chips.add(_buildDesktopSummaryChip(
        isDark,
        icon: Icons.search,
        label: 'Busca ativa',
      ));
    }
    if (_oltsSelecionadas.isNotEmpty) {
      chips.add(_buildDesktopSummaryChip(
        isDark,
        icon: Icons.router,
        label: '${_oltsSelecionadas.length} OLTs',
      ));
    }
    if (_statusSelecionados.isNotEmpty) {
      chips.add(_buildDesktopSummaryChip(
        isDark,
        icon: Icons.warning_amber_rounded,
        label: '${_statusSelecionados.length} status',
      ));
    }
    if (_ruasSelecionadas.isNotEmpty) {
      chips.add(_buildDesktopSummaryChip(
        isDark,
        icon: Icons.signpost_outlined,
        label: '${_ruasSelecionadas.length} ruas',
      ));
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF232323) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.07)
              : Colors.black.withValues(alpha: 0.05),
        ),
      ),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: chips,
      ),
    );
  }

  Widget _buildDesktopSummaryChip(
    bool isDark, {
    required IconData icon,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : const Color(0xFFF6F1E7),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: isDark ? Colors.white70 : const Color(0xFF7A5C12),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF1F1F1F),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopSectionTitle(
    bool isDark, {
    required String title,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF1F1F1F),
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: TextStyle(
                  color: isDark ? Colors.white60 : Colors.black54,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDesktopEmptyState(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF232323) : Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.07)
              : Colors.black.withValues(alpha: 0.05),
        ),
      ),
      child: Column(
        children: [
          SizedBox(
            width: 220,
            height: 220,
            child: Lottie.asset(
              'assets/animations/notFound.json',
            ),
          ),
          const SizedBox(height: 16),
          Text(
            "Nenhum splitter encontrado",
            style: TextStyle(
              color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "Ajuste a busca ou remova filtros laterais para voltar a visualizar a lista completa.",
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? Colors.white60 : Colors.black54,
              height: 1.4,
            ),
          ),
        ],
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
                    const Color.fromARGB(255, 255, 174, 0)
                        .withValues(alpha: 0.35),
                    const Color.fromARGB(255, 255, 174, 0)
                        .withValues(alpha: 0.35),
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
                                      color:
                                          Colors.black.withValues(alpha: 0.3),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (widget.sessionUser.canAccessMassiva)
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
            onTap: _clearSelectedFilters,
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

    if (olts.isEmpty) {
      _showLoadingFilterMessage();
      return null;
    }

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

    if (ruas.isEmpty) {
      _showLoadingFilterMessage();
      return null;
    }

    return _showMultiSelectSearchDialog<String>(
      title: 'Filtrar por Rua',
      items: ruas,
      label: (r) => r,
      initialSelected:
          _ruasSelecionadas.where((rua) => ruas.contains(rua)).toSet(),
    );
  }

  void _showLoadingFilterMessage() {
    if (!mounted) return;

    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 900;
    final messenger = ScaffoldMessenger.of(context);

    messenger.clearSnackBars();

    messenger.showSnackBar(
      SnackBar(
        content: const Text('Carregando dados...'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        width: isDesktop ? 320 : null,
      ),
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

    // Sempre que o snapshot muda precisamos recalcular status e filtros.
    _statusCache.clear();
    _buildClientesIndex();
    _recalcularStatusClientes();
    _applyFilters();
  }
}
