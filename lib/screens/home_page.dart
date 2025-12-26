import 'package:flutter/material.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/services/olt_service.dart';
import 'package:nexaview/services/splitter_service.dart';
import 'package:nexaview/widgets/splitter_card.dart';
import 'package:nexaview/screens/splitter_detail_page.dart';
import 'package:nexaview/screens/qr_scanner_page.dart';
import 'package:intl/intl.dart';
import 'package:lottie/lottie.dart';
import 'package:nexaview/widgets/responsive_container.dart';
import 'package:nexaview/models/olt_model.dart'; // ✅ IMPORTANTE
import 'package:nexaview/services/auth_service.dart';

enum SplitterStatus { Normal, Alerta, Critico, Excedente }

class HomePage extends StatefulWidget {
  final VoidCallback onThemeToggle;
  final SplitterService splitterService;
  final AuthService authService; // ✅

  const HomePage({
    super.key,
    required this.onThemeToggle,
    required this.splitterService,
    required this.authService,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final SplitterService _service;
  late final AuthService _authService;
  late final OltService _oltService;
  final TextEditingController _searchController = TextEditingController();
  Map<String, int> _ocupacaoSnapshot = {};
  final Map<String, String> _streetBySplitter = {};
  final Map<String, List<String>> _clientesPorSplitter = {};

  List<SplitterModel> _splitters = [];
  List<SplitterModel> _filtered = [];
  bool _loadingSplitters = true;

  int _totalOcupacaoFiltrada = 0;
  bool _cacheReady = false;
  int _totalClientesSnapshot = 0;
  bool _clientesLoading = true;
  bool _primeiraCarga = true;

  // 🔥 filtros
  String? _oltSelecionada;
  SplitterStatus? _statusSelecionado;
  String? _ruaSelecionada;

  @override
  void initState() {
    super.initState();
    _service = widget.splitterService;
    _authService = widget.authService;

    _oltService = OltService(_authService);

    _bootstrap(); // 🔥 fluxo correto
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
    final ocupacao = _ocupacaoSnapshot[splitter.code] ?? 0;
    final total = splitter.outPorts;

    if (total == 0) return SplitterStatus.Normal;

    final percentual = (ocupacao / total) * 100;

    if (percentual > 100) return SplitterStatus.Excedente; // 🔥 NOVO
    if (percentual >= 100) return SplitterStatus.Critico;
    if (percentual >= 80) return SplitterStatus.Alerta;
    return SplitterStatus.Normal;
  }

  void _applyFilters() {
    final query = _searchController.text.trim().toLowerCase();

    setState(() {
      _filtered = _splitters.where((s) {
        // 🔍 CLIENTES DO SPLITTER (NUNCA NULL)
        final List<String> clientes = _clientesPorSplitter[s.code] ?? const [];

        // 🔎 MATCH POR CLIENTE
        final bool matchCliente = clientes.any((nome) => nome.contains(query));

        // 🔍 BUSCA GERAL
        final bool matchBusca = query.isEmpty ||
            s.code.toLowerCase().contains(query) ||
            s.title.toLowerCase().contains(query) ||
            matchCliente;

        // 🧩 FILTRO POR OLT
        final bool matchOlt =
            _oltSelecionada == null || s.oltCode == _oltSelecionada;

        // 🚦 FILTRO POR STATUS
        final bool matchStatus =
            _statusSelecionado == null || _getStatus(s) == _statusSelecionado;

        // 🛣️ FILTRO POR RUA
        final String? street = _streetBySplitter[s.code];
        final bool matchRua = _ruaSelecionada == null ||
            (street != null &&
                street.toLowerCase().contains(_ruaSelecionada!.toLowerCase()));

        return matchBusca && matchOlt && matchStatus && matchRua;
      }).toList();

      _totalOcupacaoFiltrada = _calcularOcupacaoFiltrada();
    });
  }

  Future<void> _bootstrap() async {
    debugPrint("🚀 BOOTSTRAP INICIADO");
    try {
      await _oltService.loadOlts();
      debugPrint("✅ OLTs OK");

      await _loadInitialData();
      debugPrint("✅ SPLITTERS OK");
    } catch (e, s) {
      debugPrint("❌ ERRO BOOTSTRAP: $e\n$s");
    }
  }

  Future<void> _loadInitialData() async {
    try {
      debugPrint("📦 CARREGANDO SPLITTERS...");

      final snapshotAntigo = _service.getOcupacaoSnapshot();

      if (_primeiraCarga) {
        setState(() {
          _clientesLoading = true;
        });
      }

      // 1️⃣ Carrega splitters (rápido)
      final splitters = await _service.fetchSplitters();
      if (!mounted) return;

      final totalAntigo = snapshotAntigo.values.fold<int>(0, (a, b) => a + b);

      setState(() {
        _splitters = splitters;
        _filtered = splitters;
        _ocupacaoSnapshot = snapshotAntigo;
        _totalClientesSnapshot = totalAntigo;
        _cacheReady = snapshotAntigo.isNotEmpty;
        _loadingSplitters = false;
        _totalOcupacaoFiltrada = _calcularOcupacaoFiltrada();
        _primeiraCarga = false;
      });

      // 🔄 Atualização silenciosa em background (SEM TRAVAR UI)
      if (_service.clientesCacheValido()) {
        Future.microtask(() async {
          await _service.refreshClientesCache();
          if (!mounted) return;
          _buildClientesIndex();
        });
      }
      // 2️⃣ Atualiza cache pesado (clientes)
      final bool cacheValido = _service.clientesCacheValido();

// 🔥 1. SEMPRE usa cache existente (rápido)
      _buildClientesIndex();

// 🔥 2. Só mostra loading se NÃO houver cache
      if (!cacheValido) {
        setState(() => _clientesLoading = true);

        await _service.refreshClientesCache();

        if (!mounted) return;

        _buildClientesIndex();

        setState(() => _clientesLoading = false);
      }

      debugPrint(_clientesPorSplitter.toString());

      if (!mounted) return;

      // 🔥 INDEXA CLIENTES PARA BUSCA
      _buildClientesIndex();

      // 3️⃣ Atualiza ocupação após cache completo
      final snapshotNovo = _service.getOcupacaoSnapshot();
      final totalNovo = snapshotNovo.values.fold<int>(0, (a, b) => a + b);

      setState(() {
        _ocupacaoSnapshot = snapshotNovo;
        _totalClientesSnapshot = totalNovo;
        _cacheReady = true;
        _clientesLoading = false; // 🔥 SEMPRE desligar aqui
        _totalOcupacaoFiltrada = _calcularOcupacaoFiltrada();
      });

      // 4️⃣ Resolve endereços em background
      _resolveAddressesInBackground();
    } catch (e, s) {
      debugPrint("❌ Erro ao carregar HomePage: $e\n$s");
      if (!mounted) return;

      setState(() {
        _clientesLoading = false;
        _loadingSplitters = false;
      });
    }
  }

  void _buildClientesIndex() {
    _clientesPorSplitter.clear();

    final clientesIndex = _service.getClientesIndex();

    for (final entry in clientesIndex.entries) {
      _clientesPorSplitter[entry.key] =
          entry.value.map((c) => c.name.toLowerCase()).toList();
    }

    debugPrint('👥 Clientes indexados: ${_clientesPorSplitter.length}');
  }

  Future<void> _resolveAddressesInBackground() async {
    for (final s in _splitters) {
      if (!_streetBySplitter.containsKey(s.code) && s.hasLocation) {
        final street = await _service.getStreetFromLatLng(
          s.lat!,
          s.lng!,
        );

        if (!mounted) return;

        if (street != null) {
          _streetBySplitter[s.code] = street;

          // 🔥 força reavaliar filtros quando novas ruas entram
          if (_ruaSelecionada != null) {
            _applyFilters();
          }
        }
      }
    }
  }

  Future<T?> _showSearchDialog<T>({
    required String title,
    required List<T> items,
    required String Function(T) label,
  }) {
    List<T> filtered = List.from(items);
    final controller = TextEditingController();

    return showDialog<T>(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;

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
              content: SizedBox(
                width: 420,
                height: 420,
                child: Column(
                  children: [
                    // 🔍 CAMPO DE BUSCA
                    TextField(
                      controller: controller,
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

                    // 📋 LISTA DE RESULTADOS
                    Expanded(
                      child: ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (_, index) {
                          final item = filtered[index];

                          return Card(
                            elevation: 0,
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            color:
                                isDark ? const Color(0xFF2A2A2A) : Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: ListTile(
                              title: Text(
                                label(item),
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              onTap: () => Navigator.pop(context, item),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

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
    if (!mounted) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SplitterDetailPage(
          splitter: splitter,
          clientes: clientes,
          allSplitters: _splitters, // 👈 passa todos
          splitterService: _service, // 👈 PASSA AQUI
          oltService: _oltService, // 👈 PASSA AQUI
          ocupacaoSnapshot: _ocupacaoSnapshot, // 🔥 FALTAVA ISSO
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_loadingSplitters) {
      return Scaffold(
        backgroundColor: Theme.of(context).colorScheme.surface,
        body: Center(
          child: CircularProgressIndicator(
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      );
    }

    final int totalClientes = _cacheReady ? _totalClientesSnapshot : 0;
    final bool isFiltered = _filtered.length != _splitters.length;
    final int totalClientesFiltrados =
        isFiltered ? _totalOcupacaoFiltrada : totalClientes;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: SafeArea(
        child: Stack(
          children: [
            // ================= CONTEÚDO PRINCIPAL (SCROLL)
            RefreshIndicator(
              onRefresh: _loadInitialData,
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

                  return CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      // ================= HEADER
                      SliverToBoxAdapter(
                        child: Column(
                          children: [
                            _header(
                              isDark,
                              totalClientes: totalClientes,
                              totalClientesFiltrados: totalClientesFiltrados,
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
                                    debugPrint(
                                        '🧩 SPLITTER OLT CODE: "${splitter.oltCode}"');
                                    debugPrint(
                                        '🧩 OLT RESOLVIDA: ${olt?.title}');

                                    if (!mounted) return;
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => SplitterDetailPage(
                                          splitter: splitter,
                                          clientes: clientes,
                                          olt: olt, // ✅ PASSA O MODEL
                                          allSplitters:
                                              _splitters, // 👈 passa todos
                                          splitterService:
                                              _service, // 👈 PASSA AQUI
                                          oltService:
                                              _oltService, // 👈 PASSA AQUI
                                          ocupacaoSnapshot:
                                              _ocupacaoSnapshot, // 🔥 FALTAVA ISSO
                                        ),
                                      ),
                                    );
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
                                    // 🔥 RESOLVE A OLT AQUI
                                    final olt = _oltService
                                        .getBySplitterCode(splitter.oltCode);
                                    debugPrint(
                                        '🧩 SPLITTER OLT CODE: "${splitter.oltCode}"');
                                    debugPrint(
                                        '🧩 OLT RESOLVIDA: ${olt?.title}');
                                    if (!mounted) return;
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => SplitterDetailPage(
                                          splitter: splitter,
                                          clientes: clientes,
                                          olt: olt, // ✅ passa pronto
                                          allSplitters:
                                              _splitters, // 👈 passa todos
                                          splitterService:
                                              _service, // 👈 PASSA AQUI
                                          oltService:
                                              _oltService, // 👈 PASSA AQUI
                                          ocupacaoSnapshot:
                                              _ocupacaoSnapshot, // 🔥 FALTAVA ISSO
                                        ),
                                      ),
                                    );
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

            // ================= OVERLAY DE LOADING (SEM ANIMAÇÃO)
            if (_clientesLoading)
              IgnorePointer(
                ignoring: true,
                child: Container(
                  color: Colors.black.withOpacity(0.12),
                  alignment: Alignment.topCenter,
                  padding: const EdgeInsets.only(top: 220),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // 🔄 LOTTIE
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

                      // 🏷️ TEXTO EM BADGE (OPÇÃO 2)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.55),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Text(
                          "Carregando clientes…",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            letterSpacing: 0.4,
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
    required int totalClientes,
    required int totalClientesFiltrados,
    required bool isFiltered,
  }) {
    final width = MediaQuery.of(context).size.width;
    final bool isDesktop = width >= 900; // ajuste se quiser
    final double headerHeight = isDesktop ? 330 : 490;

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
            // 🖼️ IMAGEM DE FUNDO
            Image.asset(
              'assets/images/sebratelimagem.jpg',
              fit: BoxFit.cover,
            ),

            // 🎨 OVERLAY AMARELO TRANSPARENTE
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color.fromARGB(255, 255, 174, 0).withOpacity(0.35),
                    const Color.fromARGB(255, 255, 174, 0).withOpacity(0.35),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    blurRadius: 10,
                    color: Colors.black.withOpacity(0.15),
                  ),
                ],
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
                              child: ShaderMask(
                                shaderCallback: (bounds) =>
                                    const LinearGradient(
                                  colors: [
                                    Color.fromARGB(255, 255, 255, 123),
                                    Color.fromARGB(255, 211, 66, 63),
                                    Color.fromARGB(255, 0, 0, 0),
                                  ],
                                ).createShader(bounds),
                                child: Text(
                                  "SPLITTERS",
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineMedium
                                      ?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 34,
                                    letterSpacing: 0.9,
                                    color: const Color.fromARGB(
                                        255, 255, 255, 255),
                                    shadows: [
                                      Shadow(
                                        offset: const Offset(0, 3),
                                        blurRadius: 2,
                                        color: Colors.black.withOpacity(0.3),
                                      )
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isDark
                                    ? Colors.white.withOpacity(0.12)
                                    : const Color.fromARGB(255, 0, 0, 0)
                                        .withOpacity(0.16),
                              ),
                              child: IconButton(
                                onPressed: widget.onThemeToggle,
                                icon: Icon(
                                  isDark ? Icons.light_mode : Icons.dark_mode,
                                  size: 30,
                                  color: isDark
                                      ? const Color.fromARGB(255, 253, 236, 181)
                                      : Colors.redAccent,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 14),

                        // ================= CONTADORES (ANTI-QUEBRA)
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final isSmall = constraints.maxWidth < 420;
                            final bool isMobile = width < 600;
                            final bool isTablet = constraints.maxWidth >= 600 &&
                                constraints.maxWidth < 1000;

                            final int totalOlts = _splitters
                                .map((s) => s.oltCode)
                                .whereType<String>()
                                .toSet()
                                .length;

                            final int totalOltsFiltradas = _filtered
                                .map((s) => s.oltCode)
                                .whereType<String>()
                                .toSet()
                                .length;

                            final widgets = [
                              _buildStatWrapper(
                                isDark: isDark,
                                child: _statCard(
                                  title: isFiltered
                                      ? "Splitters filtrados"
                                      : "Splitters",
                                  value: _filtered.length,
                                  subtitle: isFiltered
                                      ? "de ${_splitters.length}"
                                      : null,
                                  icon: Icons.device_hub,
                                  accent:
                                      const Color.fromARGB(255, 218, 22, 22),
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
                                      const Color.fromARGB(255, 218, 22, 22),
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
                                      const Color.fromARGB(255, 218, 22, 22),
                                  isDark: isDark,
                                ),
                              ),
                            ];

                            // 📱 MOBILE → UM EMBAIXO DO OUTRO
                            if (isMobile) {
                              return Column(
                                children: widgets
                                    .map(
                                      (w) => Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 12),
                                        child: w,
                                      ),
                                    )
                                    .toList(),
                              );
                            }
                            // 📲 TABLET → 2 + 1
                            if (isTablet) {
                              return Column(
                                children: [
                                  Row(
                                    children: [
                                      Expanded(child: widgets[0]),
                                      const SizedBox(width: 12),
                                      Expanded(child: widgets[1]),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  widgets[2],
                                ],
                              );
                            }
                            // 🖥️ DESKTOP → 3 LADO A LADO
                            return Row(
                              children: [
                                Expanded(child: widgets[0]),
                                const SizedBox(width: 16),
                                Expanded(child: widgets[1]),
                                const SizedBox(width: 16),
                                Expanded(child: widgets[2]),
                              ],
                            );
                          },
                        ),

                        const SizedBox(height: 14),

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
            color: Colors.black.withOpacity(0.52),
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
          label: _oltSelecionada == null
              ? 'OLT'
              : (_oltService.getBySplitterCode(_oltSelecionada!)?.title ??
                  _oltSelecionada!),
          selected: _oltSelecionada != null,
          activeColor: Colors.blueAccent,
          onTap: () async {
            final selected = await _selectOltDialog();
            setState(() => _oltSelecionada = selected);
            _applyFilters();
          },
        ),

        // 🚦 STATUS
        _filterChip(
          isDark: isDark,
          icon: Icons.warning_amber_rounded,
          label: _statusSelecionado?.name ?? 'Status',
          selected: _statusSelecionado != null,
          activeColor: _statusSelecionado == SplitterStatus.Excedente
              ? const Color.fromARGB(255, 117, 6, 6) // ou vermelho escuro
              : _statusSelecionado == SplitterStatus.Critico
                  ? Colors.redAccent
                  : _statusSelecionado == SplitterStatus.Alerta
                      ? Colors.orangeAccent
                      : Colors.green,
          onTap: () async {
            final selected = await _selectStatusDialog();
            setState(() => _statusSelecionado = selected);
            _applyFilters();
          },
        ),

        // 🛣️ RUA
        _filterChip(
          isDark: isDark,
          icon: Icons.signpost_outlined,
          label: _ruaSelecionada ?? 'Rua',
          selected: _ruaSelecionada != null,
          activeColor: Colors.blueAccent,
          onTap: () async {
            final selected = await _selectRuaDialog();
            if (!mounted) return;
            setState(() => _ruaSelecionada = selected);
            _applyFilters();
          },
        ),

        // ❌ LIMPAR FILTROS
        if (_oltSelecionada != null ||
            _statusSelecionado != null ||
            _ruaSelecionada != null)
          _filterChip(
            isDark: isDark,
            icon: Icons.clear_all_rounded,
            label: 'Limpar',
            selected: true,
            activeColor: Colors.redAccent,
            onTap: () {
              setState(() {
                _oltSelecionada = null;
                _statusSelecionado = null;
                _ruaSelecionada = null;
              });
              _applyFilters();
            },
          ),
      ],
    );
  }

  Future<String?> _selectOltDialog() async {
    // 🔹 coleta os códigos únicos de OLT
    final List<String> oltCodes = _splitters
        .map((s) => s.oltCode)
        .whereType<String>()
        .toSet()
        .toList()
      ..sort();

    return _showSearchDialog<String>(
      title: 'Filtrar por OLT',
      items: oltCodes,
      label: (code) {
        final olt = _oltService.getBySplitterCode(code);
        return olt?.title ?? code; // 👈 mostra NOME, não ID
      },
    );
  }

  Future<SplitterStatus?> _selectStatusDialog() {
    return _showSearchDialog<SplitterStatus>(
      title: 'Filtrar por Status',
      items: SplitterStatus.values,
      label: (s) => s.name,
    );
  }

  Future<String?> _selectRuaDialog() async {
    final ruas = _streetBySplitter.values.toSet().toList()..sort();

    return _showSearchDialog<String>(
      title: 'Filtrar por Rua',
      items: ruas,
      label: (r) => r,
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

        // 🔢 valor principal
        final String valueFormatted =
            NumberFormat.decimalPattern('pt_BR').format(value);

        // 🔢 subtítulo formatado
        final String? subtitleFormatted = hasSubtitle
            ? 'de ${NumberFormat.decimalPattern('pt_BR').format(
                int.tryParse(
                      subtitle!.replaceAll(RegExp(r'[^0-9]'), ''),
                    ) ??
                    0,
              )}'
            : null;

        return ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: isMobile ? 30 : 96, // 🔥 encolhe no mobile
          ),
          child: Container(
            padding:
                EdgeInsets.all(isMobile ? 10 : 20), // 🔥 padding adaptativo
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(
                colors: isDark
                    ? [accent.withOpacity(0.50), accent.withOpacity(0.15)]
                    : [accent.withOpacity(0.55), accent.withOpacity(0.15)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border.all(
                color: accent.withOpacity(0.25),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: accent.withOpacity(isDark ? 0.15 : 0.10),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // 🔹 ÍCONE
                Container(
                  width: isMobile ? 44 : 54,
                  height: isMobile ? 44 : 54,
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    icon,
                    color: Colors.white,
                    size: isMobile ? 20 : 28,
                  ),
                ),

                const SizedBox(width: 12),

                // 🔹 TEXTO
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min, // 🔥 evita overflow
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        valueFormatted,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: isMobile ? 18 : 22,
                          fontWeight: FontWeight.w800,
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
                              fontSize: isMobile ? 10 : 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withOpacity(0.75),
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
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withOpacity(0.95),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
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
            ? const Color.fromARGB(255, 78, 78, 78).withOpacity(0.7)
            : Colors.white.withOpacity(0.7),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            blurRadius: 8,
            color: Colors.black.withOpacity(0.05),
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
        ? const Color.fromARGB(255, 78, 78, 78).withOpacity(1.00)
        : const Color.fromARGB(255, 226, 226, 226).withOpacity(1.00);

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
          ? Colors.black.withOpacity(0.50)
          : Colors.black.withOpacity(0.50),
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
          fontSize: 14,
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
}
