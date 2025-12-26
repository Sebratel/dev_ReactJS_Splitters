import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:nexaview/models/address_model.dart';
import 'package:nexaview/models/olt_model.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:nexaview/services/geocoding_service.dart';
import 'package:nexaview/widgets/cliente_card.dart';
import 'package:lottie/lottie.dart';
import 'package:flutter_map/flutter_map.dart' as osm;
import 'package:latlong2/latlong.dart';
import 'package:nexaview/services/splitter_service.dart';
import 'package:nexaview/services/olt_service.dart';
import 'package:flutter_svg/flutter_svg.dart';

class SplitterDetailPage extends StatefulWidget {
  final SplitterModel splitter;
  final List<ClienteModel> clientes;
  final OltModel? olt; // 👈 ESTE CAMPO TEM QUE EXISTIR
  final List<SplitterModel> allSplitters;
  final SplitterService splitterService;
  final OltService oltService;
  final Map<String, int> ocupacaoSnapshot;

  const SplitterDetailPage({
    super.key,
    required this.splitter,
    required this.clientes,
    this.olt, // 👈 ESTE PARÂMETRO TEM QUE EXISTIR
    required this.allSplitters, // 👈 NOVO
    required this.splitterService, // 👈 NOVO
    required this.oltService, // 👈 NOVO
    required this.ocupacaoSnapshot, // 👈 AQUI
  });

  @override
  State<SplitterDetailPage> createState() => _SplitterDetailPageState();
}

class _SplitterDetailPageState extends State<SplitterDetailPage> {
  late final double? lat;
  late final double? lng;
  late final bool hasValidLocation;
  late final osm.MapController _mapController;
  late final GeocodingService _geoService;
  AddressModel? _address;
  bool _loadingAddress = true;

  @override
  void initState() {
    super.initState();
    _mapController = osm.MapController();
    _geoService = GeocodingService();
    _loadAddress();

    lat = double.tryParse(widget.splitter.latitude);
    lng = double.tryParse(widget.splitter.longitude);
    hasValidLocation = lat != null && lng != null;

    debugPrint('LAT: "$lat" | LNG: "$lng"');
  }

  final Distance _distance = const Distance();

  bool _isWithinRadius({
    required double lat1,
    required double lng1,
    required double lat2,
    required double lng2,
    required double radiusInMeters,
  }) {
    final meters = _distance(
      LatLng(lat1, lng1),
      LatLng(lat2, lng2),
    );
    return meters <= radiusInMeters;
  }

  void _fitMapBounds(double splitterLat, double splitterLng, OltModel? olt) {
    if (olt?.lat == null || olt?.lng == null) return;

    final bounds = osm.LatLngBounds(
      LatLng(splitterLat, splitterLng),
      LatLng(olt!.lat!, olt.lng!),
    );

    _mapController.fitCamera(
      osm.CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.all(60),
        maxZoom: 17,
        minZoom: 12,
      ),
    );
  }

  Future<void> _loadAddress() async {
    if (!widget.splitter.hasLocation) {
      setState(() => _loadingAddress = false);
      return;
    }

    final result = await _geoService.resolveAddress(
      splitterCode: widget.splitter.code,
      lat: widget.splitter.lat!,
      lng: widget.splitter.lng!,
    );

    if (!mounted) return;

    setState(() {
      _address = result;
      _loadingAddress = false;
    });
  }

  Color _getSplitterColor(SplitterModel splitter) {
    final ocupacao = widget.ocupacaoSnapshot[splitter.code] ?? 0;
    final totalPortas = splitter.outPorts;

    if (totalPortas == 0) {
      return Colors.grey;
    }

    final percentual = (ocupacao / totalPortas) * 100;

    if (percentual >= 90) {
      return Colors.redAccent; // 🔴 crítico
    }
    if (percentual >= 70) {
      return Colors.orangeAccent; // 🟠 atenção
    }

    return Colors.green; // 🟢 ok
  }

  Widget _portaVazia(int porta, bool isDark) {
    return Opacity(
      opacity: 0.6,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    "Vazia",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.grey,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  "Porta $porta",
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.grey.shade500 : Colors.grey.shade600,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                "Sem cliente conectado",
                textAlign: TextAlign.right,
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Icon(
              Icons.radio_button_unchecked,
              color: Colors.grey,
              size: 30,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final OltModel? olt = widget.olt;
    final hasOltLocation = olt?.lat != null && olt?.lng != null;

    // 🔹 CORES DO HEADER
    final headerBg = const Color.fromARGB(255, 255, 174, 0);
    final headerText = isDark ? Colors.white : const Color(0xFF1F1F1F);

    final badgeBg = isDark
        ? Colors.black.withOpacity(0.35)
        : Colors.black.withOpacity(0.08);

    final badgeText = isDark ? Colors.white : const Color(0xFF1F1F1F);

    // ================= DADOS DO SPLITTER =================
    final totalPortas = widget.splitter.outPorts;

// ordena apenas para visual
    final sortedClientes = [...widget.clientes]
      ..sort((a, b) => (a.port ?? 0).compareTo(b.port ?? 0));

// ✅ clientes com porta válida dentro da capacidade
    final clientesComPortaValida = sortedClientes
        .where((c) => c.port != null && c.port! > 0 && c.port! <= totalPortas)
        .toList();

// ⚠️ clientes sem porta (problema de cadastro)
    final clientesSemPorta =
        sortedClientes.where((c) => c.port == null || c.port! <= 0).toList();

// 🔴 excedentes reais (porta maior que a capacidade)
    final clientesExcedentes = sortedClientes
        .where((c) => c.port != null && c.port! > totalPortas)
        .toList();

// 📊 métricas corretas
    final ocupadasReal = clientesComPortaValida.length +
        clientesExcedentes.length +
        clientesSemPorta.length;

    final percentualReal =
        totalPortas == 0 ? 0 : (ocupadasReal / totalPortas) * 100;

// usado SOMENTE para a barra
    final percentualVisual = (percentualReal / 100).clamp(0.0, 1.0);

    Color getStatusColor() {
      if (percentualReal >= 100)
        return const Color(0xFFB91C1C); // 🔴 overbooking crítico
      if (percentualReal >= 90) return const Color(0xFFEF4444);
      if (percentualReal >= 70) return const Color(0xFFF97316);
      return const Color(0xFF10B981);
    }

    // ⬇️ continua o Scaffold normalmente

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,

      // ================= HEADER =================
      appBar: AppBar(
        elevation: 0,
        toolbarHeight: 120,
        backgroundColor: Colors.transparent,
        foregroundColor: headerText,
        automaticallyImplyLeading: true,
        flexibleSpace: ClipRRect(
          borderRadius: const BorderRadius.only(
            bottomLeft: Radius.circular(22),
            bottomRight: Radius.circular(22),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 🖼️ IMAGEM DE FUNDO
              Image.asset(
                'assets/images/sebratelimagem.jpg', // 👈 troque se quiser
                fit: BoxFit.cover,
              ),

              // 🎨 OVERLAY TRANSLÚCIDO (COR DO HEADER)
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
                ),
              ),
            ],
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              "Splitter",
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: Colors.white.withOpacity(0.95),
                shadows: [
                  Shadow(
                    offset: const Offset(0, 2), // posição da sombra
                    blurRadius: 4, // suavidade
                    color: Colors.black.withOpacity(0.65),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 4),

            // 🔹 NOME DO SPLITTER + OLT
            Wrap(
              spacing: 10,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SelectableText(
                  widget.splitter.title.isNotEmpty
                      ? widget.splitter.title
                      : widget.splitter.code,
                  maxLines: 1,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Colors.white.withOpacity(0.95),
                    shadows: [
                      Shadow(
                        offset: const Offset(0, 2), // posição da sombra
                        blurRadius: 4, // suavidade
                        color: Colors.black.withOpacity(0.65),
                      ),
                    ],
                  ),
                ),
                if (olt != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.45),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        SelectableText(
                          olt.title,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                        ),
                        _dot(),
                        SelectableText(
                          "Slot ${olt.slotsNumber}",
                          style: const TextStyle(
                              fontSize: 12, color: Colors.white),
                        ),
                        _dot(),
                        SelectableText(
                          "Porta ${olt.portsFirstNumber}",
                          style: const TextStyle(
                              fontSize: 12, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),

      // 🔥 TUDO ROLA JUNTO
      body: LayoutBuilder(
        builder: (context, constraints) {
          final bool isWide = constraints.maxWidth > 900;
          final nearbySplitters = widget.allSplitters.where((s) {
            if (s.code == widget.splitter.code) return false;

            final sLat = double.tryParse(s.latitude);
            final sLng = double.tryParse(s.longitude);

            if (sLat == null || sLng == null) return false;

            return _isWithinRadius(
              lat1: lat!,
              lng1: lng!,
              lat2: sLat,
              lng2: sLng,
              radiusInMeters: 200,
            );
          }).toList();

          return SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: isWide ? 1200 : double.infinity,
                ),
                child: Column(
                  children: [
                    // ================= INFO =================
                    Container(
                      margin: const EdgeInsets.all(16),
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1C1C1C) : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Informações do Splitter",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? Colors.grey.shade300
                                  : Colors.grey.shade800,
                            ),
                          ),
                          const SizedBox(height: 12),

                          // 📍 ENDEREÇO (resolvido por geocoding)
                          if (_loadingAddress)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(
                                children: [
                                  const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    "Carregando endereço…",
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: isDark
                                          ? Colors.grey.shade400
                                          : Colors.grey.shade600,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else if (_address?.street != null)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    size: 18,
                                    color: Colors.orange,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      _address!.street!,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                        color: isDark
                                            ? Colors.grey.shade300
                                            : Colors.grey.shade700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                          const SizedBox(height: 12),

                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _infoBox("Portas", totalPortas.toString(),
                                  Colors.blue),
                              _infoBox("Ocupadas", ocupadasReal.toString(),
                                  Colors.orange),
                              _infoBox(
                                "Uso",
                                "${percentualReal.toStringAsFixed(1)}%",
                                percentualReal > 100
                                    ? const Color(0xFFDC2626) // 🔴 overbooking
                                    : getStatusColor(),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          LinearProgressIndicator(
                            value: percentualVisual, // 👈 agora só visual
                            color: getStatusColor(),
                            minHeight: 6,
                          ),
                        ],
                      ),
                    ),

                    // ================= LOCALIZAÇÃO =================
                    if (hasValidLocation)
                      _mapCardOSM(
                        isDark: isDark,
                        lat: lat!,
                        lng: lng!,
                        olt: olt,
                        nearbySplitters: nearbySplitters,
                        // 👈 NOVO
                      )
                    else
                      _locationFallback(isDark),

                    // ================= PORTAS / CLIENTES =================
                    Padding(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: totalPortas == 0
                          ? Column(
                              children: [
                                Lottie.asset(
                                  'assets/animations/notClients.json',
                                  width: 200,
                                ),
                                const SizedBox(height: 24),
                                Text(
                                  "Nenhuma porta configurada",
                                  style: TextStyle(
                                    color: isDark
                                        ? Colors.grey.shade300
                                        : Colors.grey.shade700,
                                    fontSize: 18,
                                  ),
                                ),
                              ],
                            )
                          : ListView(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              children: [
                                // ================= PORTAS NORMAIS (1 até capacidade)
                                for (int porta = 1;
                                    porta <= totalPortas;
                                    porta++) ...[
                                  () {
                                    final cliente =
                                        clientesComPortaValida.firstWhere(
                                      (c) => c.port == porta,
                                      orElse: () => ClienteModel(
                                        id: -porta,
                                        name: "Porta $porta vazia",
                                        user: "-",
                                        port: porta,
                                        status: 0,
                                        splitterCode: widget.splitter.code,
                                      ),
                                    );

                                    if (!cliente.name.contains("vazia")) {
                                      return ClienteCard(cliente: cliente);
                                    }

                                    return _portaVazia(porta, isDark);
                                  }(),
                                ],

                                // ================= CLIENTES SEM PORTA
                                if (clientesSemPorta.isNotEmpty) ...[
                                  const SizedBox(height: 20),
                                  const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 8),
                                    child: Text(
                                      "Clientes sem porta atribuída",
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.orange,
                                      ),
                                    ),
                                  ),
                                  for (final cliente in clientesSemPorta)
                                    ClienteCard(
                                      cliente: cliente,
                                      isNoPort: true,
                                    ),
                                ],

                                // ================= EXCEDENTES (OVERBOOKING REAL)
                                if (clientesExcedentes.isNotEmpty) ...[
                                  const SizedBox(height: 20),
                                  const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 8),
                                    child: Text(
                                      "Clientes excedentes (overbooking)",
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.redAccent,
                                      ),
                                    ),
                                  ),
                                  for (final cliente in clientesExcedentes)
                                    ClienteCard(
                                      cliente: cliente,
                                      isOverflow: true,
                                    ),
                                ],
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _dot() {
    return const Text(
      "•",
      style: TextStyle(
        color: Colors.white70,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  Widget _mapCardOSM({
    required bool isDark,
    required double lat,
    required double lng,
    OltModel? olt,
    required List<SplitterModel> nearbySplitters,
  }) {
    final hasOltLocation = olt?.lat != null && olt?.lng != null;

    final cameraFit = hasOltLocation
        ? osm.CameraFit.bounds(
            bounds: osm.LatLngBounds(
              LatLng(lat, lng),
              LatLng(olt!.lat!, olt.lng!),
            ),
            padding: const EdgeInsets.all(60),
            maxZoom: 17,
            minZoom: 12,
          )
        : null;

    return Container(
      width: double.infinity,
      height: 220,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1C) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Localização",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey.shade300 : Colors.grey.shade800,
            ),
          ),
          const SizedBox(height: 10),

          // 🗺️ OpenStreetMap
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: osm.FlutterMap(
                options: osm.MapOptions(
                  initialCenter: LatLng(lat, lng),
                  initialZoom: 16,
                  initialCameraFit: cameraFit,
                  interactionOptions: const osm.InteractionOptions(
                    flags: osm.InteractiveFlag.all,
                  ),
                ),
                children: [
                  // 🗺️ BASE MAP
                  osm.TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.appsera.splitters',
                  ),

                  // 🟢 RAIO DE 200 METROS
                  osm.CircleLayer(
                    circles: [
                      osm.CircleMarker(
                        point: LatLng(lat, lng),
                        radius: 200, // metros
                        color: Colors.green.withOpacity(0.15),
                        borderStrokeWidth: 2,
                        borderColor: Colors.green,
                      ),
                    ],
                  ),

                  // 🔶 LINHA OLT ↔ SPLITTER
                  if (hasOltLocation)
                    osm.PolylineLayer(
                      polylines: [
                        osm.Polyline(
                          points: [
                            LatLng(olt!.lat!, olt.lng!),
                            LatLng(lat, lng),
                          ],
                          strokeWidth: 3,
                          color: Colors.orangeAccent,
                        ),
                      ],
                    ),

                  // 📍 MARKERS
                  osm.MarkerLayer(
                    markers: [
                      // 🔴 SPLITTER ATUAL
                      osm.Marker(
                        point: LatLng(lat, lng),
                        width: 40,
                        height: 40,
                        child: const Icon(
                          Icons.location_pin,
                          color: Colors.red,
                          size: 40,
                        ),
                      ),

                      // 🟦 OLT
                      if (hasOltLocation)
                        osm.Marker(
                          point: LatLng(olt!.lat!, olt.lng!),
                          width: 36,
                          height: 36,
                          child: const Icon(
                            Icons.router,
                            color: Colors.blue,
                            size: 34,
                          ),
                        ),

                      // 🟢 SPLITTERS PRÓXIMOS (200m)
                      for (final s in nearbySplitters)
                        osm.Marker(
                          point: LatLng(
                            double.parse(s.latitude),
                            double.parse(s.longitude),
                          ),
                          width: 34,
                          height: 34,
                          child: Tooltip(
                            message: s.title.isNotEmpty
                                ? s.title
                                : 'Splitter ${s.code}',
                            child: GestureDetector(
                              onTap: () async {
                                // 🔥 BUSCA CLIENTES DO SPLITTER CLICADO
                                final clientes = await widget.splitterService
                                    .getClientesInstant(s.code);

                                if (!mounted) return;

                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => SplitterDetailPage(
                                      splitter: s,
                                      clientes: clientes,
                                      olt: widget.oltService
                                          .getBySplitterCode(s.oltCode),
                                      allSplitters: widget.allSplitters,
                                      ocupacaoSnapshot: widget.ocupacaoSnapshot,
                                      splitterService: widget.splitterService,
                                      oltService: widget.oltService,
                                    ),
                                  ),
                                );
                              },
                              child: SvgPicture.asset(
                                'assets/icons/splitterlogo.svg',
                                width: 26,
                                height: 26,
                                colorFilter: ColorFilter.mode(
                                  _getSplitterColor(
                                      s), // 🔥 muda conforme ocupação
                                  BlendMode.srcIn,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _locationFallback(bool isDark) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1C) : Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          const Icon(Icons.location_off, color: Colors.grey),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              kIsWeb
                  ? "Mapa disponível apenas no aplicativo móvel"
                  : "Localização não disponível para este splitter",
              style: TextStyle(
                color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoBox(String label, String value, Color color) {
    return Column(
      children: [
        Text(value,
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 13, color: Colors.grey)),
      ],
    );
  }
}
