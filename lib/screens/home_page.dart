import 'package:flutter/material.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/services/splitter_service.dart';
import 'package:nexaview/widgets/splitter_card.dart';
import 'package:nexaview/screens/splitter_detail_page.dart';
import 'package:nexaview/screens/qr_scanner_page.dart';
import 'package:intl/intl.dart';
import 'package:lottie/lottie.dart';
import 'package:nexaview/widgets/responsive_container.dart';

class HomePage extends StatefulWidget {
  final VoidCallback onThemeToggle;
  final SplitterService splitterService;

  const HomePage({
    super.key,
    required this.onThemeToggle,
    required this.splitterService,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final SplitterService _service;
  final TextEditingController _searchController = TextEditingController();
  Map<String, int> _ocupacaoSnapshot = {};

  List<SplitterModel> _splitters = [];
  List<SplitterModel> _filtered = [];
  bool _loadingSplitters = true;
  int _chunksLoaded = 0;
  int _chunksTotal = 0;
  int _totalOcupacaoFiltrada = 0;
  bool _cacheReady = false;
  int _totalClientesSnapshot = 0;

  @override
  void initState() {
    super.initState();
    _service = widget.splitterService;
    _loadInitialData();
  }

  void _recalcularOcupacaoFiltrada() {
    if (!_cacheReady) return;

    int total = 0;
    for (final splitter in _filtered) {
      total += _ocupacaoSnapshot[splitter.code] ?? 0;
    }

    setState(() {
      _totalOcupacaoFiltrada = total;
    });
  }

  Future<void> _loadInitialData() async {
    try {
      // 1️⃣ Splitters
      final splitters = await _service.fetchSplitters();
      if (!mounted) return;

      setState(() {
        _splitters = splitters;
        _filtered = splitters;
        _loadingSplitters = false;
      });

      // 2️⃣ Progresso inicial
      final totalChunks =
          SplitterService.boxClientesIndex.get("chunks") as int? ?? 0;

      setState(() {
        _chunksLoaded = totalChunks;
        _chunksTotal = totalChunks;
      });

      // 3️⃣ Atualiza cache de clientes
      await _service.refreshClientesCache(
        onProgress: (loaded, total) {
          if (!mounted) return;
          setState(() {
            _chunksLoaded = loaded;
            _chunksTotal = total;
          });
        },
      );

      if (!mounted) return;

      // 🔥🔥🔥 ESTE setState É O QUE FALTAVA 🔥🔥🔥
      setState(() {
        _ocupacaoSnapshot = _service.getOcupacaoSnapshot();
        _totalClientesSnapshot =
            _ocupacaoSnapshot.values.fold(0, (a, b) => a + b);
        _cacheReady = true;
        _recalcularOcupacaoFiltrada();
      });
    } catch (e, s) {
      debugPrint("Erro inicial: $e\n$s");
      if (!mounted) return;

      setState(() {
        _cacheReady = true;
        _loadingSplitters = false;
      });
    }
  }

  void _filter(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      setState(() => _filtered = _splitters);
      _recalcularOcupacaoFiltrada(); // 🔥
      return;
    }
    final byText = _splitters.where((s) =>
        s.code.toLowerCase().contains(q) || s.title.toLowerCase().contains(q));
    setState(() => _filtered = byText.toList());
    _recalcularOcupacaoFiltrada(); // 🔥
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
        child: RefreshIndicator(
          onRefresh: _loadInitialData,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;

              // 🔹 BREAKPOINTS (AGORA columns EXISTE)
              int columns = 1;
              if (width >= 1200) {
                columns = 3;
              } else if (width >= 800) {
                columns = 2;
              }

              // 🔹 TAMANHO DO CARD (mesma lógica anterior)
              const double gridHorizontalPadding = 22 * 2;
              const double gridSpacing = 10;
              const double aspectRatio = 2.9;

              final cardWidth = (width -
                      gridHorizontalPadding -
                      (gridSpacing * (columns - 1))) /
                  columns;

              final cardHeight = cardWidth / aspectRatio;

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
                        const SizedBox(height: 24),
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
                          return Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 620),
                              child: Padding(
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
                                    if (!mounted) return;
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => SplitterDetailPage(
                                          splitter: splitter,
                                          clientes: clientes,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
                          );
                        },
                        childCount: _filtered.length,
                      ),
                    ),

                  // ================= GRID (TABLET / DESKTOP)
                  if (_filtered.isNotEmpty && columns > 1) ...[
                    if (_filtered.length == 1)
                      SliverToBoxAdapter(
                        child: Center(
                          child: SizedBox(
                            width: cardWidth,
                            height: cardHeight,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: SplitterCard(
                                splitter: _filtered.first,
                                ocupacao:
                                    _ocupacaoSnapshot[_filtered.first.code] ??
                                        0,
                                onTap: () async {
                                  final clientes = await _service
                                      .getClientesInstant(_filtered.first.code);
                                  if (!mounted) return;
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => SplitterDetailPage(
                                        splitter: _filtered.first,
                                        clientes: clientes,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 22),
                        sliver: SliverGrid(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final splitter = _filtered[index];
                              return SplitterCard(
                                splitter: splitter,
                                ocupacao: _ocupacaoSnapshot[splitter.code] ?? 0,
                                onTap: () async {
                                  final clientes = await _service
                                      .getClientesInstant(splitter.code);
                                  if (!mounted) return;
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => SplitterDetailPage(
                                        splitter: splitter,
                                        clientes: clientes,
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
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                            childAspectRatio: 3.3,
                          ),
                        ),
                      ),
                  ],
                ],
              );
            },
          ),
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
    final showProgress = _chunksTotal > 0 && _chunksLoaded < _chunksTotal;

    return Container(
      width: double.infinity, // 🔥 fundo sempre ocupa tudo
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color.fromARGB(255, 255, 174, 0),
            Color.fromARGB(255, 255, 174, 0),
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
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),

      // 🔹 CONTEÚDO CENTRALIZADO
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1600),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
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
                      fit: BoxFit.contain,
                    ),
                    const SizedBox(width: 15),

                    // TÍTULO
                    Expanded(
                      child: ShaderMask(
                        shaderCallback: (bounds) => const LinearGradient(
                          colors: [
                            Color.fromARGB(255, 255, 255, 247),
                            Color(0xFFE53935),
                            Color.fromARGB(255, 0, 0, 0),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ).createShader(bounds),
                        child: Text(
                          "SPLITTERS",
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(
                            fontWeight: FontWeight.w900,
                            fontSize: 35,
                            letterSpacing: 0.9,
                            color: Colors.white,
                            shadows: [
                              Shadow(
                                offset: const Offset(0, 3),
                                blurRadius: 12,
                                color: Colors.redAccent.withOpacity(0.5),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // TOGGLE TEMA
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isDark
                            ? Colors.white.withOpacity(0.1)
                            : Colors.black.withOpacity(0.05),
                      ),
                      child: IconButton(
                        onPressed: widget.onThemeToggle,
                        icon: Icon(
                          isDark ? Icons.light_mode : Icons.dark_mode,
                          size: 32,
                          color: isDark
                              ? const Color.fromARGB(255, 253, 236, 181)
                              : Colors.redAccent,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // ================= CONTADORES
                Row(
                  children: [
                    Expanded(
                      child: _statCard(
                        title: isFiltered ? "Splitters filtrados" : "Splitters",
                        value: _filtered.length,
                        subtitle: isFiltered ? "de ${_splitters.length}" : null,
                        icon: Icons.device_hub,
                        accent: const Color.fromARGB(255, 150, 40, 40),
                        isDark: isDark,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _statCard(
                        title: isFiltered ? "Clientes filtrados" : "Clientes",
                        value:
                            isFiltered ? totalClientesFiltrados : totalClientes,
                        subtitle: isFiltered ? "de $totalClientes" : null,
                        icon: Icons.people_alt_rounded,
                        accent: const Color.fromARGB(255, 150, 40, 40),
                        isDark: isDark,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // ================= BUSCA
                _searchBar(isDark),

                // ================= PROGRESSO
                if (showProgress) ...[
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value:
                        (_chunksLoaded / (_chunksTotal == 0 ? 1 : _chunksTotal))
                            .clamp(0, 1),
                    minHeight: 6,
                    color: Colors.amberAccent,
                    backgroundColor: Colors.white.withOpacity(0.3),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statCard({
    required String title,
    required int value,
    String? subtitle, // 👈 opcional (ex: "de 194")
    required IconData icon,
    required Color accent,
    required bool isDark,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: LinearGradient(
            colors: isDark
                ? [
                    accent.withOpacity(0.50),
                    accent.withOpacity(0.15),
                  ]
                : [
                    accent.withOpacity(0.55),
                    accent.withOpacity(0.15),
                  ],
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
          children: [
            // 🔹 Ícone
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withOpacity(0.25),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                icon,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 15),

            // 🔹 Texto
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        NumberFormat.decimalPattern('pt_BR').format(value),
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          height: 1,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(width: 6),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 1),
                          child: Text(
                            subtitle!,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withOpacity(0.75),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
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
  }

  Widget _searchBar(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withOpacity(0.3)
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
        onChanged: _filter,
        style: TextStyle(
          color:
              isDark ? Colors.white : Colors.black, // 🔥 cor do texto digitado
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
        decoration: InputDecoration(
          hintText: "Buscar splitter…",
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
}
