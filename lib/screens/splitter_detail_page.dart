import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:nexaview/widgets/cliente_card.dart';
import 'package:lottie/lottie.dart';
import 'package:flutter_map/flutter_map.dart' as osm;
import 'package:latlong2/latlong.dart';

class SplitterDetailPage extends StatefulWidget {
  final SplitterModel splitter;
  final List<ClienteModel> clientes;

  const SplitterDetailPage({
    super.key,
    required this.splitter,
    required this.clientes,
  });

  @override
  State<SplitterDetailPage> createState() => _SplitterDetailPageState();
}

class _SplitterDetailPageState extends State<SplitterDetailPage> {
  late final double? lat;
  late final double? lng;
  late final bool hasValidLocation;

  @override
  void initState() {
    super.initState();

    lat = double.tryParse(widget.splitter.latitude);
    lng = double.tryParse(widget.splitter.longitude);
    hasValidLocation = lat != null && lng != null;

    debugPrint('LAT: "$lat" | LNG: "$lng"');
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
        toolbarHeight: 92,
        backgroundColor: Colors.transparent,
        foregroundColor: headerText,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            color: headerBg,
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(22),
              bottomRight: Radius.circular(22),
            ),
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
                fontWeight: FontWeight.w600,
                color:
                    const Color.fromARGB(255, 253, 253, 253).withOpacity(0.8),
              ),
            ),
            const SizedBox(height: 4),

            // 🔹 NOME DO SPLITTER + OLT
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  widget.splitter.title.isNotEmpty
                      ? widget.splitter.title
                      : widget.splitter.code,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: const Color.fromARGB(255, 255, 255, 255)
                        .withOpacity(0.8),
                  ),
                ),
                if (widget.splitter.oltDescription != null &&
                    widget.splitter.oltDescription!.isNotEmpty)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color.fromARGB(255, 95, 95, 95),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      widget.splitter.oltDescription!,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: const Color.fromARGB(255, 255, 255, 255),
                      ),
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

  Widget _mapCardOSM({
    required bool isDark,
    required double lat,
    required double lng,
  }) {
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
                  interactionOptions: const osm.InteractionOptions(
                    flags: osm.InteractiveFlag.all,
                  ),
                ),
                children: [
                  osm.TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.appsera.splitters',
                  ),
                  osm.MarkerLayer(
                    markers: [
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
                    ],
                  ),
                ],
              ),
            ),
          ),
          // 🗺️ OpenStreetMa      p
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
