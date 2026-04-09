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
import 'package:nexaview/models/porta_geogrid_model.dart';
import 'package:nexaview/services/geogrid_service.dart';
import 'package:nexaview/widgets/geogrid_refresh_button.dart';
import 'package:nexaview/widgets/reserva_lock_badge.dart';

/// Tela de detalhe de um splitter especifico.
///
/// Ela combina dados estruturais do splitter com:
/// - clientes conectados
/// - endereco resolvido por geocoding
/// - reservas vindas do GeoGrid
/// - mapa com OLT e splitters proximos
class SplitterDetailPage extends StatefulWidget {
  final SplitterModel splitter;
  final List<ClienteModel> clientes;
  final OltModel? olt; // Este campo tem que existir
  final List<SplitterModel> allSplitters;
  final SplitterService splitterService;
  final OltService oltService;
  final Map<String, int> ocupacaoSnapshot;
  final GeoGridService geoGridService;
  final String token;

  const SplitterDetailPage({
    super.key,
    required this.splitter,
    required this.clientes,
    this.olt, // Este parametro tem que existir
    required this.allSplitters, // Novo
    required this.splitterService, // Novo
    required this.oltService, // Novo
    required this.ocupacaoSnapshot, // Aqui
    required this.geoGridService,
    required this.token,
  });

  @override
  State<SplitterDetailPage> createState() => _SplitterDetailPageState();
}

class _SplitterDetailPageState extends State<SplitterDetailPage> {
  late final double? lat;
  late final double? lng;
  late final bool hasValidLocation;
  late final GeocodingService _geoService;
  late final ValueNotifier<List<ClienteModel>> _clientesNotifier;

  bool _refreshing = false;
  bool _atualizouSplitter = false;
  bool _reservasLoading = false;

  AddressModel? _address;
  bool _loadingAddress = true;
  Map<int, PortaGeoGrid> _reservasGeoGrid = {};
  Map<String, String> _nomesClientesReservaGeoGrid = {};

  bool get _temAlgumaReservaGeoGrid {
    return _reservasGeoGrid.values.any((p) => p.hasReservaComCadeado);
  }

  @override
  void initState() {
    super.initState();

    _geoService = GeocodingService();

    // Endereco e reservas sao carregados separadamente porque dependem de
    // servicos externos e podem falhar sem impedir a tela de abrir.
    _loadAddress();
    if (widget.splitter.integrationCode.isNotEmpty) {
      _loadReservasGeoGrid();
    }

    // O notifier permite refletir refreshes pontuais do splitter sem recarregar
    // a tela inteira.
    _clientesNotifier =
        widget.splitterService.watchClientes(widget.splitter.code);

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

  ({int? slot, int? porta}) _extractSlotAndPort(String title) {
    try {
      // Ex: SLE-C-1971-4-9-13/3 -> slot=4, porta=13
      // Regra: penultimo e ultimo numero antes da barra.
      final beforeSlash = title.split('/').first;
      final dashParts = beforeSlash.split('-');

      if (dashParts.length < 2) {
        return (slot: null, porta: null);
      }

      final slot = int.tryParse(dashParts[dashParts.length - 2]);
      final porta = int.tryParse(dashParts.last);

      return (slot: slot, porta: porta);
    } catch (_) {
      return (slot: null, porta: null);
    }
  }

  // Resolve o endereco textual a partir da latitude/longitude do splitter.
  Future<void> _loadAddress() async {
    if (!widget.splitter.hasLocation) {
      setState(() => _loadingAddress = false);
      return;
    }

    try {
      final result = await _geoService.resolveAddress(
        splitterCode: widget.splitter.code,
        lat: widget.splitter.lat!,
        lng: widget.splitter.lng!,
      );

      if (!mounted) return;

      setState(() {
        _address = result;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _address = null;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingAddress = false;
        });
      }
    }
  }

  Color _getSplitterColor(SplitterModel splitter) {
    final ocupacao =
        widget.splitterService.getClientesCountFromCache(splitter.code);

    final totalPortas = splitter.outPorts;

    if (totalPortas == 0) {
      return Colors.grey;
    }

    final percentual = (ocupacao / totalPortas) * 100;

    if (percentual >= 90) {
      return Colors.redAccent; // critico
    }
    if (percentual >= 70) {
      return Colors.orangeAccent; // atencao
    }

    return Colors.green; // ok
  }

  String? _buildReservaInfo(PortaGeoGrid? reserva) {
    if (reserva == null || !reserva.hasReserva) return null;

    final nomeCliente = reserva.idCliente != null
        ? _nomesClientesReservaGeoGrid[reserva.idCliente!]
        : null;
    final buffer = StringBuffer();

    if (nomeCliente != null && nomeCliente.isNotEmpty) {
      buffer.writeln('Cliente: $nomeCliente');
    }

    if (reserva.dataReserva == null) {
      final textoBase = 'Reserva GeoGrid';
      if (buffer.isEmpty) return textoBase;
      buffer.write(textoBase);
      return buffer.toString();
    }

    final data = reserva.dataReserva!;
    final hoje = DateTime.now();
    final dias =
        hoje.difference(DateTime(data.year, data.month, data.day)).inDays;

    final tempo = dias <= 0
        ? 'hoje'
        : dias == 1
            ? 'h\u00e1 1 dia'
            : 'h\u00e1 $dias dias';

    final dataFormatada =
        '${data.day.toString().padLeft(2, '0')}/${data.month.toString().padLeft(2, '0')}/${data.year}';

    buffer.write('Reservada em $dataFormatada ($tempo)');
    return buffer.toString();
  }

  // Renderiza portas sem cliente conectado, mantendo o indicativo de reserva
  // quando o GeoGrid informa bloqueio/cadeado naquela porta.
  Widget _portaVazia(
    int porta,
    bool isDark, {
    bool temReserva = false,
    String? reservaInfo,
  }) {
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
                    color: Colors.grey.withValues(alpha: 0.15),
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
            const SizedBox(width: 20),
            Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                const Icon(
                  Icons.radio_button_unchecked,
                  color: Colors.grey,
                  size: 50,
                ),
                if (temReserva)
                  Positioned(
                    top: -6,
                    right: -6,
                    child: Tooltip(
                      message: reservaInfo ?? 'Reserva GeoGrid',
                      child: GestureDetector(
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(reservaInfo ?? 'Reserva GeoGrid'),
                              duration: Duration(seconds: 2),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        child: const ReservaLockBadge(
                          size: 28,
                          iconSize: 20,
                        ),
                      ),
                    ),
                  ),
              ],
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
    final splitterTitle = widget.splitter.title.isNotEmpty
        ? widget.splitter.title
        : widget.splitter.code;
    final oltInfo = _extractSlotAndPort(splitterTitle);

    final headerText = isDark ? Colors.white : const Color(0xFF1F1F1F);

    // ================= DADOS DO SPLITTER =================
    final totalPortas = widget.splitter.outPorts;

    // A tela foi organizada para misturar contexto operacional e visual:
    // header, informacoes gerais, mapa, splitters proximos e lista de portas.

    return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          Navigator.pop(context, _atualizouSplitter);
        },
        child: Scaffold(
            backgroundColor: theme.colorScheme.surface,

            // ================= HEADER =================
            appBar: AppBar(
              elevation: 0,
              toolbarHeight: 120,
              backgroundColor: Colors.transparent,
              foregroundColor: headerText,
              // Controle total do botao voltar
              automaticallyImplyLeading: false,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                color: Colors.white,
                onPressed: () {
                  Navigator.pop(context, _atualizouSplitter);
                },
              ),
              actions: [
                if (widget.splitter.integrationCode.isNotEmpty)
                  GeoGridRefreshButton(
                    loading: _reservasLoading,
                    hasReserva: _temAlgumaReservaGeoGrid,
                    onPressed: _refreshReservasGeoGrid,
                  ),
                const SizedBox(width: 8),
              ],

              flexibleSpace: ClipRRect(
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(22),
                  bottomRight: Radius.circular(22),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Imagem de fundo
                    Image.asset(
                      'assets/images/sebratelimagem.jpg', // Troque se quiser
                      fit: BoxFit.cover,
                    ),

                    // Overlay translucido (cor do header)
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
                      color: Colors.white.withValues(alpha: 0.95),
                      shadows: [
                        Shadow(
                          offset: const Offset(0, 2), // posicao da sombra
                          blurRadius: 4, // suavidade
                          color: Colors.black.withValues(alpha: 0.65),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 4),

                  // OLT
                  Wrap(
                    spacing: 10,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      SelectableText(
                        splitterTitle,
                        maxLines: 1,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Colors.white.withValues(alpha: 0.95),
                          shadows: [
                            Shadow(
                              offset: const Offset(0, 2), // posicao da sombra
                              blurRadius: 4, // suavidade
                              color: Colors.black.withValues(alpha: 0.65),
                            ),
                          ],
                        ),
                      ),
                      if (olt != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.45),
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
                                "Slot ${oltInfo.slot}",
                                style: const TextStyle(
                                    fontSize: 12, color: Colors.white),
                              ),
                              _dot(),
                              SelectableText(
                                "Porta ${oltInfo.porta}",
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

            // Tudo rola junto
            body: LayoutBuilder(builder: (context, constraints) {
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
                            color:
                                isDark ? const Color(0xFF1C1C1C) : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Informa\u00e7\u00f5es do Splitter",
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: isDark
                                      ? Colors.grey.shade300
                                      : Colors.grey.shade800,
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Endereco
                              if (_loadingAddress)
                                Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 8),
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
                                        "Carregando endere\u00e7o...",
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
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 8),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
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

                              const SizedBox(height: 16),

                              // Metricas reativas
                              ValueListenableBuilder<List<ClienteModel>>(
                                valueListenable: _clientesNotifier,
                                builder: (context, clientes, _) {
                                  final ocupadasReal = clientes.length;

                                  final percentualReal = totalPortas == 0
                                      ? 0.0
                                      : (ocupadasReal / totalPortas) * 100;

                                  final percentualVisual =
                                      (percentualReal / 100).clamp(0.0, 1.0);

                                  Color getStatusColor() {
                                    if (percentualReal >= 100) {
                                      return const Color(
                                          0xFFB91C1C); // Overbooking
                                    }
                                    if (percentualReal >= 90) {
                                      return const Color(0xFFEF4444);
                                    }
                                    if (percentualReal >= 70) {
                                      return const Color(0xFFF97316);
                                    }
                                    return const Color(0xFF10B981);
                                  }

                                  return Column(
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          _infoBox(
                                            "Portas",
                                            totalPortas.toString(),
                                            Colors.blue,
                                          ),
                                          _infoBox(
                                            "Ocupadas",
                                            ocupadasReal.toString(),
                                            Colors.orange,
                                          ),
                                          _infoBox(
                                            "Uso",
                                            "${percentualReal.toStringAsFixed(1)}%",
                                            percentualReal > 100
                                                ? const Color(0xFFDC2626)
                                                : getStatusColor(),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      LinearProgressIndicator(
                                        value: percentualVisual,
                                        color: getStatusColor(),
                                        minHeight: 6,
                                      ),
                                    ],
                                  );
                                },
                              ),
                            ],
                          ),
                        ),

                        // ================= LOCALIZACAO =================
                        if (hasValidLocation)
                          _mapCardOSM(
                            isDark: isDark,
                            lat: lat!,
                            lng: lng!,
                            olt: olt,
                            nearbySplitters: nearbySplitters,
                          )
                        else
                          _locationFallback(isDark),

// ================= PORTAS / CLIENTES =================
                        ValueListenableBuilder<List<ClienteModel>>(
                          valueListenable: _clientesNotifier,
                          builder: (context, clientes, _) {
                            // Ordena apenas para visual
                            final sortedClientes = [...clientes]..sort(
                                (a, b) => (a.port ?? 0).compareTo(b.port ?? 0));

                            // clientes com porta valida dentro da capacidade
                            final clientesComPortaValida = sortedClientes
                                .where((c) =>
                                    c.port != null &&
                                    c.port! > 0 &&
                                    c.port! <= totalPortas)
                                .toList();

                            // Clientes sem porta (problema de cadastro)
                            final clientesSemPorta = sortedClientes
                                .where((c) => c.port == null || c.port! <= 0)
                                .toList();

                            // Excedentes reais (porta maior que a capacidade)
                            final clientesExcedentes = sortedClientes
                                .where((c) =>
                                    c.port != null && c.port! > totalPortas)
                                .toList();

                            final portaCards =
                                List<Widget>.generate(totalPortas, (index) {
                              final porta = index + 1;
                              final portaGeoGrid = _reservasGeoGrid[porta];
                              final bool temReserva =
                                  portaGeoGrid?.hasReservaComCadeado == true;
                              final reservaInfo =
                                  _buildReservaInfo(portaGeoGrid);
                              final ClienteModel cliente =
                                  clientesComPortaValida.firstWhere(
                                (c) => c.port == porta,
                                orElse: () => ClienteModel(
                                  clientId: -porta, // ID negativo = porta vazia
                                  authenticationId: 0,
                                  name: "Porta $porta vazia",
                                  user: "-",
                                  port: porta,
                                  status: 0,
                                  splitterCode: widget.splitter.code,
                                ),
                              );

                              if (cliente.clientId < 0) {
                                return _portaVazia(
                                  porta,
                                  isDark,
                                  temReserva: temReserva,
                                  reservaInfo: reservaInfo,
                                );
                              }

                              return ClienteCard(
                                cliente: cliente,
                                token: widget.token,
                                temReserva: temReserva,
                                reservaInfo: reservaInfo,
                              );
                            });

                            return Padding(
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
                                      physics:
                                          const NeverScrollableScrollPhysics(),
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 16),
                                      children: [
                                        // ================= PORTAS (1 ate capacidade)
                                        if (kIsWeb)
                                          _buildPortasGrid(portaCards),
                                        if (!kIsWeb) ...portaCards,

                                        // Clientes sem porta (problema de cadastro)
                                        if (clientesSemPorta.isNotEmpty) ...[
                                          const SizedBox(height: 20),
                                          const Padding(
                                            padding: EdgeInsets.symmetric(
                                                vertical: 8),
                                            child: Text(
                                              "Clientes sem porta atribu\u00edda",
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w700,
                                                color: Colors.orange,
                                              ),
                                            ),
                                          ),
                                          for (final cliente
                                              in clientesSemPorta)
                                            ClienteCard(
                                              cliente: cliente,
                                              token: widget.token,
                                              isNoPort: true,
                                            ),
                                        ],

                                        // ================= EXCEDENTES (OVERBOOKING REAL)
                                        if (clientesExcedentes.isNotEmpty) ...[
                                          const SizedBox(height: 20),
                                          const Padding(
                                            padding: EdgeInsets.symmetric(
                                                vertical: 8),
                                            child: Text(
                                              "Clientes excedentes (overbooking)",
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w700,
                                                color: Colors.redAccent,
                                              ),
                                            ),
                                          ),
                                          for (final cliente
                                              in clientesExcedentes)
                                            ClienteCard(
                                              cliente: cliente,
                                              token: widget.token,
                                              isOverflow: true,
                                            ),
                                        ],
                                      ],
                                    ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              );
            })));
  }

  Widget _buildPortasGrid(List<Widget> portaCards) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final spacing = 16.0;
        final crossAxisCount = constraints.maxWidth >= 980 ? 2 : 1;
        final cardWidth =
            (constraints.maxWidth - (spacing * (crossAxisCount - 1))) /
                crossAxisCount;

        return Wrap(
          spacing: spacing,
          runSpacing: 4,
          children: portaCards
              .map(
                (card) => SizedBox(
                  width: cardWidth,
                  child: card,
                ),
              )
              .toList(),
        );
      },
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
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Localiza\u00e7\u00e3o",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey.shade300 : Colors.grey.shade800,
            ),
          ),
          const SizedBox(height: 10),

          // OpenStreetMap
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
                  // Base map
                  osm.TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.appsera.splitters',
                  ),

                  // Raio de 200 metros
                  osm.CircleLayer(
                    circles: [
                      osm.CircleMarker(
                        point: LatLng(lat, lng),
                        radius: 200, // metros
                        color: Colors.green.withValues(alpha: 0.15),
                        borderStrokeWidth: 2,
                        borderColor: Colors.green,
                      ),
                    ],
                  ),

                  // Linha OLT -> splitter
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

                  // Markers
                  osm.MarkerLayer(
                    markers: [
                      // Splitter atual
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

                      // OLT
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

                      // Splitters proximos (200m)
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
                                // Busca clientes do splitter clicado
                                final clientes = await widget.splitterService
                                    .getClientesInstant(s.code);

                                if (!mounted) return;

                                Navigator.pushReplacement(
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
                                      geoGridService: widget.geoGridService,
                                      token: widget.token,
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
                                      s), // Muda conforme ocupacao
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
                  ? "Mapa dispon\u00edvel apenas no aplicativo m\u00f3vel"
                  : "Localiza\u00e7\u00e3o n\u00e3o dispon\u00edvel para este splitter",
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

  // ignore: unused_element
  Future<void> _refreshClientesSplitter() async {
    if (!mounted || _refreshing) return;

    setState(() => _refreshing = true);

    try {
      await widget.splitterService
          .refreshClientesPorSplitter(widget.splitter.code);

      _atualizouSplitter = true;
    } finally {
      if (mounted) {
        setState(() => _refreshing = false);
      }
    }
  }

  // Carrega o estado atual de reservas diretamente do GeoGrid.
  Future<void> _loadReservasGeoGrid() async {
    if (widget.splitter.integrationCode.isEmpty) return;

    setState(() => _reservasLoading = true);
    try {
      final reservas = await widget.geoGridService.fetchReservasPorSplitter(
        widget.splitter.integrationCode,
      );
      if (!mounted) return;
      setState(() => _reservasGeoGrid = reservas);
      await _loadNomesClientesReservaGeoGrid(reservas);
    } catch (e) {
      debugPrint('Erro GeoGrid: $e');
    } finally {
      if (mounted) {
        setState(() => _reservasLoading = false);
      }
    }
  }

  // Forca um refresh do GeoGrid e marca o splitter como "dirty" para a camada
  // de cache de clientes revisar os dados logo em seguida.
  Future<void> _refreshReservasGeoGrid() async {
    if (_reservasLoading || widget.splitter.integrationCode.isEmpty) return;

    setState(() => _reservasLoading = true);
    try {
      widget.geoGridService.clearCache(
        splitterIntegrationCode: widget.splitter.integrationCode,
      );

      final reservas = await widget.geoGridService.fetchReservasPorSplitter(
        widget.splitter.integrationCode,
      );
      if (!mounted) return;

      setState(() {
        _reservasGeoGrid = reservas;
        _atualizouSplitter = true;
      });
      await _loadNomesClientesReservaGeoGrid(reservas);
      if (!mounted) return;

      widget.splitterService.markSplitterDirty(widget.splitter.code);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.splitterService.refreshClientesPorSplitter(widget.splitter.code);
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Atualizando portas do splitter (aguarde um minuto...)',
            style: TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.w600,
            ),
          ),
          duration: Duration(seconds: 3),
          backgroundColor: Colors.white,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Falha ao atualizar reservas GeoGrid',
            style: TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.w600,
            ),
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _reservasLoading = false);
      }
    }
  }

  Future<void> _loadNomesClientesReservaGeoGrid(
    Map<int, PortaGeoGrid> reservas,
  ) async {
    final ids = reservas.values
        .where((p) => p.hasReservaComCadeado && p.idCliente != null)
        .map((p) => p.idCliente!.trim())
        .where((id) => id.isNotEmpty)
        .toSet();

    if (ids.isEmpty) {
      if (mounted) {
        setState(() => _nomesClientesReservaGeoGrid = {});
      }
      return;
    }

    final nomes = <String, String>{};
    await Future.wait(
      ids.map((id) async {
        final nome = await widget.geoGridService.fetchClienteNomeById(id);
        if (nome != null && nome.isNotEmpty) {
          nomes[id] = nome;
        }
      }),
    );

    if (!mounted) return;
    setState(() => _nomesClientesReservaGeoGrid = nomes);
  }
}
