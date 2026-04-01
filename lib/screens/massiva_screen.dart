import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:lottie/lottie.dart';
import 'package:nexaview/models/app_session_user.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:nexaview/models/massiva_models.dart';
import 'package:nexaview/models/splitter_model.dart';
import 'package:nexaview/services/autoisp_event_service.dart';
import 'package:nexaview/services/massiva_gateway_service.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:nexaview/utils/web_utils.dart';

class _ResolvedAutoIspRoute {
  final String ap;
  final int slot;
  final int port;
  final String? splitterCode;
  final String? username;

  const _ResolvedAutoIspRoute({
    required this.ap,
    required this.slot,
    required this.port,
    required this.splitterCode,
    required this.username,
  });
}

class _LocalMassivaPreview {
  final int totalAffected;
  final int totalPppoes;

  const _LocalMassivaPreview({
    required this.totalAffected,
    required this.totalPppoes,
  });
}

enum _StepperDialogAction { apply, back }

class _StepperDialogResult<T> {
  final _StepperDialogAction action;
  final Set<T> values;

  const _StepperDialogResult({
    required this.action,
    required this.values,
  });
}

/// Tela operacional de massivas.
///
/// Esta tela concentra a maior parte da regra de negocio manual do app:
/// selecao de rota de rede, sugestao de descricao, abertura/encerramento de
/// protocolos e apoio com eventos do AutoISP.
class MassivaPage extends StatefulWidget {
  final MassivaGatewayService gatewayService;
  final AutoIspEventService autoIspService;
  final AppSessionUser sessionUser;
  final List<SplitterModel> splitters;
  final List<String> cachedSplitterCodes;
  final List<ClienteModel> Function(String splitterCode) getClientesForSplitter;
  final int? Function(String oltCode) getOltIdByCode;
  final String cookieString;

  const MassivaPage({
    super.key,
    required this.gatewayService,
    required this.autoIspService,
    required this.sessionUser,
    required this.splitters,
    required this.cachedSplitterCodes,
    required this.getClientesForSplitter,
    required this.getOltIdByCode,
    required this.cookieString,
  });

  @override
  State<MassivaPage> createState() => _MassivaPageState();
}

class _MassivaPageState extends State<MassivaPage> {
  static const _headerYellow = Color.fromARGB(255, 255, 174, 0);
  static const String _incidentHeaderLottieAsset =
      'assets/animations/warning.json';
  static const double _incidentLottieScaleDesktop = 0.35;
  static const double _incidentLottieScaleMobile = 0.30;
  static const double _incidentHeaderLottieOffsetDesktop = 28;
  static const int _companyPlaceId = 1;
  static const int _apiIncidentStatusId = 1;
  static const int _apiIncidentTypeId = 1257;
  static const String _fixedIncidentTypeLabel = 'Registro Massivas';
  static const int _apiCatalogServiceId = 1173;
  static const int _apiServiceLevelAgreementId = 99;
  static const int _apiMatrixType = 2;
  static const String _apiTeamCode = '8.0';
  static const String _apiSolicitationServiceCategory1 = 'MASSIVAS - 001';
  final _formKey = GlobalKey<FormState>();
  final _apController = TextEditingController();
  final _slotController = TextEditingController();
  final _portController = TextEditingController();
  final _splitterController = TextEditingController();
  final _openedDateController = TextEditingController();
  final _openedTimeController = TextEditingController();
  final _closedDateController = TextEditingController();
  final _closedTimeController = TextEditingController();
  final _incidentTypeController = TextEditingController(
    text: _fixedIncidentTypeLabel,
  );
  final _massivaSearchController = TextEditingController();
  final _technicalReasonController = TextEditingController();
  final _descriptionController = TextEditingController();

  bool _loadingPreview = false;
  bool _loadingSubmit = false;
  bool _loadingMassivas = false;
  bool _closingMassiva = false;
  bool _loadedMassivas = false;
  bool _loadingAutoIsp = false;
  bool _loadedAutoIsp = false;
  bool _buildingRouteCatalog = false;
  bool _routeCatalogReady = false;
  bool _requestedByFieldTechnician = false;
  List<MassivaTicket> _massivas = const [];
  List<AutoIspEvent> _autoIspEvents = const [];
  MassivaStatus? _statusFilter;
  String? _massivaApFilter;
  int? _massivaImpactFilter;
  _LocalMassivaPreview? _lastPreview;
  String? _error;
  Timer? _autoRefreshTimer;
  DateTime? _openedAt;
  DateTime? _closedAt;
  DateTime? _identifiedAt;
  List<String> _splitterOptions = const [];
  final Map<String, String> _splitterNameByCode = {};
  final Map<String, SplitterModel> _splitterByCode = {};
  final Map<String, String> _apTitleByCode = {};
  final Set<String> _selectedAps = {};
  final Set<int> _selectedSlots = {};
  final Set<int> _selectedPorts = {};
  final Set<String> _selectedSplitters = {};
  final Map<String, Set<int>> _selectedSlotsByAp = {};
  final Map<String, Map<int, Set<int>>> _selectedPortsByApSlot = {};
  final Map<String, Map<int, Map<int, Set<String>>>> _selectedSplittersByRoute =
      {};
  final Map<String, Map<int, Map<int, Set<String>>>> _routeCatalog = {};
  final Map<String, _ResolvedAutoIspRoute> _routeByUsername = {};
  bool _descriptionEditedManually = false;
  bool _syncingDescription = false;

  @override
  void initState() {
    super.initState();
    _technicalReasonController.addListener(_handleTechnicalReasonChanged);
    _descriptionController.addListener(_handleDescriptionChanged);
    for (final splitter in widget.splitters) {
      final code = splitter.code.trim();
      if (code.isEmpty) continue;
      _splitterNameByCode[code] = splitter.title.trim();
      _splitterByCode[code] = splitter;
    }
    _splitterOptions = {
      ...widget.splitters
          .map((s) => s.code.trim())
          .where((it) => it.isNotEmpty),
      ...widget.cachedSplitterCodes
          .map((it) => it.trim())
          .where((it) => it.isNotEmpty),
    }.toList()
      ..sort();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_ensureRouteCatalog());
      Future<void>.delayed(const Duration(milliseconds: 300), () async {
        if (!mounted) return;
        await _runAutoRefresh();
      });
    });
    _startAutoRefresh();
  }

  void _handleDescriptionChanged() {
    if (_syncingDescription) return;
    _descriptionEditedManually = true;
  }

  void _handleTechnicalReasonChanged() {
    if (!mounted) return;
    setState(() {
      _syncAutoDescription();
    });
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _apController.dispose();
    _slotController.dispose();
    _portController.dispose();
    _splitterController.dispose();
    _openedDateController.dispose();
    _openedTimeController.dispose();
    _closedDateController.dispose();
    _closedTimeController.dispose();
    _incidentTypeController.dispose();
    _massivaSearchController.dispose();
    _technicalReasonController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  void _startAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = Timer.periodic(const Duration(minutes: 5), (_) async {
      if (!mounted) return;
      await _runAutoRefresh();
    });
  }

  Future<void> _runAutoRefresh() async {
    if (!mounted) return;

    try {
      if (!_loadingMassivas) {
        await _loadMassivas();
      }
      if (!_loadingAutoIsp) {
        await _loadAutoIspEvents();
      }
    } catch (_) {
      // erros já são tratados nos loaders
    }
  }

  Future<void> _ensureRouteCatalog() async {
    if (_routeCatalogReady || _buildingRouteCatalog) return;
    if (!mounted) return;

    setState(() => _buildingRouteCatalog = true);

    try {
      // Monta um catalogo em memoria no formato AP -> slot -> porta ->
      // splitter. O mesmo catalogo tambem gera um indice por username para
      // aproximar eventos AutoISP da topologia conhecida.
      _routeByUsername.clear();
      _apTitleByCode.clear();
      for (var i = 0; i < _splitterOptions.length; i++) {
        final fallbackSplitterCode = _splitterOptions[i];
        final clientes = widget.getClientesForSplitter(fallbackSplitterCode);

        for (final cliente in clientes) {
          final access = cliente.accessPoint;
          if (access == null) continue;

          final apCode = access.code.trim();
          final apTitle = access.title.trim();
          if (apCode.isEmpty || apTitle.isEmpty) continue;

          final slot = access.slotOlt;
          final port = access.portOlt;
          final splitter = cliente.splitterCode?.trim().isNotEmpty == true
              ? cliente.splitterCode!.trim()
              : fallbackSplitterCode;

          _routeCatalog
              .putIfAbsent(apCode, () => {})
              .putIfAbsent(slot, () => {})
              .putIfAbsent(port, () => <String>{})
              .add(splitter);
          _apTitleByCode.putIfAbsent(apCode, () => apTitle);

          final normalizedUser = _normalizeAutoIspUsername(cliente.user);
          if (normalizedUser.isNotEmpty) {
            _routeByUsername.putIfAbsent(
              normalizedUser,
              () => _ResolvedAutoIspRoute(
                ap: apCode,
                slot: slot,
                port: port,
                splitterCode: splitter,
                username:
                    cliente.user.trim().isEmpty ? null : cliente.user.trim(),
              ),
            );
          }
        }

        if (i % 20 == 0) {
          await Future<void>.delayed(Duration.zero);
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _buildingRouteCatalog = false;
          _routeCatalogReady = true;
        });
      }
    }
  }

  List<String> get _apOptions {
    final list = _routeCatalog.keys.toList()..sort();
    return list;
  }

  List<int> _slotOptionsForAp(String ap) {
    final list = (_routeCatalog[ap]?.keys.toList() ?? <int>[])..sort();
    return list;
  }

  List<int> _portOptionsForApSlot(String ap, int slot) {
    final list = (_routeCatalog[ap]?[slot]?.keys.toList() ?? <int>[])..sort();
    return list;
  }

  List<String> _splitterOptionsForRoute(String ap, int slot, int port) {
    final list =
        List<String>.from(_routeCatalog[ap]?[slot]?[port] ?? const <String>{})
          ..sort();
    return list;
  }

  String _apDisplayLabel(String apCode) {
    final title = (_apTitleByCode[apCode] ?? '').trim();
    if (title.isEmpty) return apCode;
    return title;
  }

  String _normalizeAutoIspUsername(String value) {
    return value.trim().toLowerCase();
  }

  _ResolvedAutoIspRoute? _resolveRouteByAutoIspUsername(AutoIspEvent event) {
    for (final resource in event.resources) {
      final normalized =
          _normalizeAutoIspUsername(resource.pppoeUsername ?? '');
      if (normalized.isEmpty) continue;
      final match = _routeByUsername[normalized];
      if (match != null) {
        return match;
      }
    }
    return null;
  }

  _ResolvedAutoIspRoute? _resolveRouteByPonlink(AutoIspEvent event) {
    final firstPon = event.resources
        .map((r) => r.ponlink?.trim() ?? '')
        .firstWhere((it) => it.isNotEmpty, orElse: () => '');

    if (firstPon.isEmpty) {
      return null;
    }

    final parts = firstPon.split('/');
    if (parts.length != 3) {
      return null;
    }

    final slot = int.tryParse(parts[1]);
    final port = int.tryParse(parts[2]);
    if (slot == null || port == null) {
      return null;
    }

    final apCandidates = _routeCatalog.entries
        .where((entry) => entry.value[slot]?[port]?.isNotEmpty == true)
        .map((entry) => entry.key)
        .toList()
      ..sort();

    final ap = _selectedAps.length == 1
        ? _selectedAps.first
        : (apCandidates.isNotEmpty ? apCandidates.first : null);

    if (ap == null || ap.isEmpty) {
      return null;
    }

    final splitters = _splitterOptionsForRoute(ap, slot, port);
    return _ResolvedAutoIspRoute(
      ap: ap,
      slot: slot,
      port: port,
      splitterCode: splitters.length == 1 ? splitters.first : null,
      username: null,
    );
  }

  void _applyResolvedAutoIspRoute(_ResolvedAutoIspRoute route) {
    _selectedAps
      ..clear()
      ..add(route.ap);

    _selectedSlotsByAp
      ..clear()
      ..addAll({
        route.ap: {route.slot},
      });

    _selectedPortsByApSlot
      ..clear()
      ..addAll({
        route.ap: {
          route.slot: {route.port},
        },
      });

    _selectedSplittersByRoute.clear();
    final routeSplitters =
        route.splitterCode != null && route.splitterCode!.trim().isNotEmpty
            ? {route.splitterCode!.trim()}
            : const <String>{};
    if (routeSplitters.isNotEmpty) {
      _selectedSplittersByRoute[route.ap] = {
        route.slot: {
          route.port: routeSplitters,
        },
      };
    }

    _rebuildSelectionSummaries();
    _refreshControllerLabels();
    _syncAutoDescription();
  }

  List<int> get _slotOptions {
    final set = <int>{};
    for (final ap in _selectedAps) {
      set.addAll(_slotOptionsForAp(ap));
    }
    return set.toList()..sort();
  }

  List<int> get _portOptions {
    final set = <int>{};
    for (final entry in _selectedSlotsByAp.entries) {
      final ap = entry.key;
      for (final slot in entry.value) {
        set.addAll(_portOptionsForApSlot(ap, slot));
      }
    }
    return set.toList()..sort();
  }

  List<String> get _routeSplitterOptions {
    final set = <String>{};
    for (final apEntry in _selectedPortsByApSlot.entries) {
      final ap = apEntry.key;
      for (final slotEntry in apEntry.value.entries) {
        final slot = slotEntry.key;
        for (final port in slotEntry.value) {
          set.addAll(_splitterOptionsForRoute(ap, slot, port));
        }
      }
    }
    return set.toList()..sort();
  }

  String _splitterLabel(String code) {
    final name = (_splitterNameByCode[code] ?? '').trim();
    return name;
  }

  void _rebuildSelectionSummaries() {
    _selectedSlots
      ..clear()
      ..addAll(_selectedSlotsByAp.values.expand((slots) => slots));

    _selectedPorts.clear();
    for (final apEntry in _selectedPortsByApSlot.values) {
      for (final ports in apEntry.values) {
        _selectedPorts.addAll(ports);
      }
    }

    _selectedSplitters.clear();
    for (final apEntry in _selectedSplittersByRoute.values) {
      for (final slotEntry in apEntry.values) {
        for (final splitters in slotEntry.values) {
          _selectedSplitters.addAll(splitters);
        }
      }
    }
  }

  String _configuredApCountLabel(int count, String singular, String plural) {
    if (count == 0) return '';
    return count == 1
        ? '1 $singular configurado'
        : '$count $plural configurados';
  }

  void _refreshControllerLabels() {
    final apTotal = _apOptions.length;

    _apController.text = _selectedAps.isEmpty
        ? ''
        : _selectedAps.length == 1
            ? _apDisplayLabel(_selectedAps.first)
            : _selectedAps.length == apTotal && apTotal > 0
                ? 'Todos APs'
                : '${_selectedAps.length} APs selecionados';

    _slotController.text = _configuredApCountLabel(
      _selectedSlotsByAp.length,
      'AP',
      'APs',
    );

    _portController.text = _selectedPortsByApSlot.isEmpty
        ? ''
        : '${_selectedPortsByApSlot.values.fold<int>(0, (sum, slots) => sum + slots.length)} rota(s) com portas';

    _splitterController.text = _selectedSplittersByRoute.isEmpty
        ? ''
        : '${_selectedSplittersByRoute.values.fold<int>(0, (sum, slots) => sum + slots.values.fold<int>(0, (inner, ports) => inner + ports.length))} rota(s) com splitters';
  }

  void _captureOpenedAtFromApSelection({required bool hasApSelection}) {
    if (!hasApSelection) {
      _openedAt = null;
      _identifiedAt = null;
      _openedDateController.clear();
      _openedTimeController.clear();
      return;
    }

    final now = DateTime.now();
    _openedAt = now;
    _openedDateController.text = DateFormat('dd/MM/yyyy').format(now);
    _openedTimeController.text = DateFormat('HH:mm:ss').format(now);
    _identifiedAt ??= now;
  }

  bool _isClosingBeforeOpening(DateTime closing) {
    if (_openedAt == null) return false;
    return closing.isBefore(_openedAt!);
  }

  Future<void> _pickOpeningDate() async {
    final now = DateTime.now();
    final current = _openedAt ?? now;
    final picked = await showDatePicker(
      context: context,
      locale: const Locale('pt', 'BR'),
      initialDate: current,
      firstDate: now.subtract(const Duration(days: 3650)),
      lastDate: now.add(const Duration(days: 3650)),
      builder: (context, child) {
        return _buildPickerTheme(
          context: context,
          child: Localizations.override(
            context: context,
            locale: const Locale('pt', 'BR'),
            child: child,
          ),
        );
      },
    );
    if (picked == null || !mounted) return;

    final previous = _openedAt ?? now;
    final candidate = DateTime(
      picked.year,
      picked.month,
      picked.day,
      previous.hour,
      previous.minute,
      previous.second,
    );

    if (_closedAt != null && _isClosingBeforeOpening(_closedAt!)) {
      setState(() {
        _error = 'Data/hora de previsão nao pode ser menor que a abertura.';
      });
      return;
    }

    setState(() {
      _openedAt = candidate;
      _openedDateController.text = DateFormat('dd/MM/yyyy').format(candidate);
      _openedTimeController.text = DateFormat('HH:mm:ss').format(candidate);
      _identifiedAt ??= candidate;
      _syncAutoDescription();
    });
  }

  Future<void> _pickOpeningTime() async {
    final now = DateTime.now();
    final current = _openedAt ?? now;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: current.hour, minute: current.minute),
      builder: (context, child) {
        return _buildPickerTheme(
          context: context,
          child: MediaQuery(
            data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
            child: Localizations.override(
              context: context,
              locale: const Locale('pt', 'BR'),
              child: child,
            ),
          ),
        );
      },
    );
    if (picked == null || !mounted) return;

    final base = _openedAt ?? now;
    final candidate = DateTime(
      base.year,
      base.month,
      base.day,
      picked.hour,
      picked.minute,
      base.second,
    );

    if (_closedAt != null && _closedAt!.isBefore(candidate)) {
      setState(() {
        _error = 'Data/hora de previsão nao pode ser menor que a abertura.';
      });
      return;
    }

    setState(() {
      _openedAt = candidate;
      _openedDateController.text = DateFormat('dd/MM/yyyy').format(candidate);
      _openedTimeController.text = DateFormat('HH:mm:ss').format(candidate);
      _identifiedAt ??= candidate;
      _syncAutoDescription();
    });
  }

  Future<void> _pickClosingDate() async {
    if (_openedAt == null) {
      setState(() {
        _error =
            'Preencha primeiro a data e hora de abertura (selecione Ponto de acesso).';
      });
      return;
    }

    final now = DateTime.now();
    final minDate = _openedAt != null
        ? DateTime(_openedAt!.year, _openedAt!.month, _openedAt!.day)
        : now.subtract(const Duration(days: 365));
    final initialCandidate = _closedAt ?? _openedAt ?? now;
    final initial =
        initialCandidate.isBefore(minDate) ? minDate : initialCandidate;
    final picked = await showDatePicker(
      context: context,
      locale: const Locale('pt', 'BR'),
      initialDate: initial,
      firstDate: minDate,
      lastDate: now.add(const Duration(days: 3650)),
      builder: (context, child) {
        return _buildPickerTheme(
          context: context,
          child: Localizations.override(
            context: context,
            locale: const Locale('pt', 'BR'),
            child: child,
          ),
        );
      },
    );
    if (picked == null || !mounted) return;

    final previous = _closedAt ?? _openedAt ?? now;
    final candidate = DateTime(
      picked.year,
      picked.month,
      picked.day,
      previous.hour,
      previous.minute,
    );
    if (_isClosingBeforeOpening(candidate)) {
      setState(() {
        _error = 'Data/hora de previsão nao pode ser menor que a abertura.';
      });
      return;
    }

    setState(() {
      _closedAt = candidate;
      _closedDateController.text = DateFormat('dd/MM/yyyy').format(_closedAt!);
      _closedTimeController.text = DateFormat('HH:mm:ss').format(_closedAt!);
      _syncAutoDescription();
    });
  }

  Future<void> _pickClosingTime() async {
    if (_openedAt == null) {
      setState(() {
        _error =
            'Preencha primeiro a data e hora de abertura (selecione Ponto de acesso).';
      });
      return;
    }

    final now = DateTime.now();
    final base = _closedAt ?? _openedAt ?? now;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: base.hour, minute: base.minute),
      builder: (context, child) {
        return _buildPickerTheme(
          context: context,
          child: MediaQuery(
            data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
            child: Localizations.override(
              context: context,
              locale: const Locale('pt', 'BR'),
              child: child,
            ),
          ),
        );
      },
    );
    if (picked == null || !mounted) return;

    final current = _closedAt ?? _openedAt ?? now;
    final candidate = DateTime(
      current.year,
      current.month,
      current.day,
      picked.hour,
      picked.minute,
    );
    if (_isClosingBeforeOpening(candidate)) {
      setState(() {
        _error = 'Data/hora de previsão nao pode ser menor que a abertura.';
      });
      return;
    }

    setState(() {
      _closedAt = candidate;
      _closedDateController.text = DateFormat('dd/MM/yyyy').format(_closedAt!);
      _closedTimeController.text = DateFormat('HH:mm:ss').format(_closedAt!);
      _syncAutoDescription();
    });
  }

  void _clearSplitterSelection() {
    _selectedSplittersByRoute.clear();
    _selectedSplitters.clear();
    _splitterController.clear();
  }

  void _clearPortSelection() {
    _selectedPortsByApSlot.clear();
    _selectedPorts.clear();
    _portController.clear();
    _clearSplitterSelection();
  }

  void _clearSlotSelectionAndBelow() {
    _selectedSlotsByAp.clear();
    _selectedSlots.clear();
    _slotController.clear();
    _clearPortSelection();
  }

  void _onApsChanged(Set<String> values) {
    _selectedAps
      ..clear()
      ..addAll(values);
    _clearSlotSelectionAndBelow();
    _captureOpenedAtFromApSelection(hasApSelection: _selectedAps.isNotEmpty);
    _refreshControllerLabels();
    _syncAutoDescription();
  }

  List<String> _selectedSplitterCodesForDescription() {
    final splitters = List<String>.from(
      _selectedSplitters.isNotEmpty
          ? _selectedSplitters
          : _routeSplitterOptions,
    );
    splitters.sort();
    return splitters;
  }

  int _estimatedAffectedClients() {
    final seenAuthenticationIds = <int>{};

    for (final splitterCode in _selectedSplitterCodesForDescription()) {
      final clientes = widget.getClientesForSplitter(splitterCode);
      for (final cliente in clientes) {
        if (cliente.authenticationId > 0) {
          seenAuthenticationIds.add(cliente.authenticationId);
        }
      }
    }

    return seenAuthenticationIds.length;
  }

  Set<String> _effectiveSplittersForRoute(String ap, int slot, int port) {
    final explicit = _selectedSplittersByRoute[ap]?[slot]?[port];
    if (explicit != null && explicit.isNotEmpty) {
      return explicit;
    }

    return _splitterOptionsForRoute(ap, slot, port).toSet();
  }

  List<ClienteModel> _collectClientesForAp({
    required String apCode,
  }) {
    final seenClientKeys = <String>{};
    final clientes = <ClienteModel>[];
    final routes = _selectedPortsByApSlot[apCode] ?? const <int, Set<int>>{};

    for (final slotEntry in routes.entries) {
      final slot = slotEntry.key;
      final ports = slotEntry.value.toList()..sort();

      for (final port in ports) {
        final splitters = _effectiveSplittersForRoute(apCode, slot, port);
        for (final splitterCode in splitters) {
          final splitterClientes = widget.getClientesForSplitter(splitterCode);
          for (final cliente in splitterClientes) {
            final accessPoint = cliente.accessPoint;
            if (accessPoint == null) continue;
            if (accessPoint.code.trim() != apCode.trim() &&
                accessPoint.title.trim() != apCode.trim()) {
              continue;
            }
            if (accessPoint.slotOlt != slot || accessPoint.portOlt != port) {
              continue;
            }

            final clientKey = cliente.authenticationId > 0
                ? 'auth:${cliente.authenticationId}'
                : 'user:${cliente.user.trim().toLowerCase()}';
            if (seenClientKeys.add(clientKey)) {
              clientes.add(cliente);
            }
          }
        }
      }
    }

    return clientes;
  }

  String _affectedUsersReason() {
    final technicalReason = _technicalReasonController.text.trim();
    if (technicalReason.isNotEmpty) {
      return technicalReason;
    }

    final description = _descriptionController.text.trim();
    if (description.isNotEmpty) {
      return description;
    }

    return 'Massiva aberta pelo app';
  }

  String _affectedUsersCreatedBy() {
    final email = widget.sessionUser.email.trim().toLowerCase();
    if (email.isNotEmpty) {
      return email.split('@').first.replaceAll(RegExp(r'[^a-z0-9._-]'), '_');
    }

    final name = (widget.sessionUser.name ?? '').trim().toLowerCase();
    if (name.isNotEmpty) {
      return name.replaceAll(RegExp(r'[^a-z0-9._-]'), '_');
    }

    return 'app_splitters';
  }

  _LocalMassivaPreview _buildLocalPreview() {
    final seenClientKeys = <String>{};
    final seenPppoes = <String>{};

    for (final apCode in _selectedAps) {
      for (final cliente in _collectClientesForAp(apCode: apCode)) {
        final clientKey = cliente.authenticationId > 0
            ? 'auth:${cliente.authenticationId}'
            : 'user:${cliente.user.trim().toLowerCase()}';
        seenClientKeys.add(clientKey);

        final pppoe = cliente.user.trim().toLowerCase();
        if (pppoe.isNotEmpty) {
          seenPppoes.add(pppoe);
        }
      }
    }

    return _LocalMassivaPreview(
      totalAffected: seenClientKeys.length,
      totalPppoes: seenPppoes.length,
    );
  }

  List<AffectedUserRequest> _buildAffectedUserRequests({
    required String apCode,
    required int protocol,
  }) {
    final finishDate = (_closedAt ?? DateTime.now()).toUtc().toIso8601String();
    final createdAt = DateTime.now().toUtc().toIso8601String();
    final reason = _affectedUsersReason();
    final createdBy = _affectedUsersCreatedBy();
    final seenPppoes = <String>{};

    return _collectClientesForAp(
      apCode: apCode,
    ).where((cliente) {
      final pppoe = cliente.user.trim();
      if (pppoe.isEmpty) return false;
      return seenPppoes.add(pppoe.toLowerCase());
    }).map((cliente) {
      return AffectedUserRequest(
        pppoe: cliente.user.trim(),
        protocol: protocol,
        reason: reason,
        finishDate: finishDate,
        created: createdAt,
        createdBy: createdBy,
        contractId: (cliente.contract?.id ?? 0),
      );
    }).toList();
  }

  int get _currentOpeningClients =>
      _lastPreview?.totalAffected ?? _estimatedAffectedClients();

  bool _didSelectAllSplittersForDescription() {
    return _selectedSplitters.isNotEmpty &&
        _routeSplitterOptions.isNotEmpty &&
        _selectedSplitters.length == _routeSplitterOptions.length;
  }

  List<String> _selectedSplitterDisplayNames() {
    final names = _selectedSplitterCodesForDescription().map((code) {
      final label = _splitterLabel(code).trim();
      return label.isNotEmpty ? label : code;
    }).toList()
      ..sort();

    return names;
  }

  String _formatSplitterDisplayGrid(List<String> names) {
    if (names.isEmpty) return '';

    final width = names.fold<int>(
        0, (max, item) => item.length > max ? item.length : max);
    final rows = <String>[];

    for (var i = 0; i < names.length; i += 2) {
      final left = names[i];
      final right = i + 1 < names.length ? names[i + 1] : '';
      if (right.isEmpty) {
        rows.add(left);
        continue;
      }

      rows.add('${left.padRight(width)} | $right');
    }

    return rows.join('\n');
  }

  String _buildMotivoText() {
    final splitterNames = _selectedSplitterDisplayNames();

    if (_didSelectAllSplittersForDescription()) {
      return 'Todas as CTO selecionadas';
    }

    if (splitterNames.isNotEmpty) {
      return _formatSplitterDisplayGrid(splitterNames);
    }

    return 'aguardando definicao da topologia afetada';
  }

  String _requesterName() {
    final name = (widget.sessionUser.name ?? '').trim();
    if (name.isNotEmpty) return name;

    final email = widget.sessionUser.email.trim();
    return email.isNotEmpty ? email : '-';
  }

  String _buildTopologiaText() {
    final lines = <String>[];

    final aps = _selectedAps.toList()..sort();
    for (final ap in aps) {
      final slots = (_selectedSlotsByAp[ap]?.toList() ?? <int>[])..sort();
      final ports = <int>{};
      final portsBySlot = _selectedPortsByApSlot[ap] ?? const <int, Set<int>>{};
      for (final values in portsBySlot.values) {
        ports.addAll(values);
      }
      final portsList = ports.toList()..sort();

      lines.add('AP: ${_apDisplayLabel(ap)}');
      if (slots.isNotEmpty) {
        lines.add('Slot(s): ${slots.join(", ")}');
      }
      if (portsList.isNotEmpty) {
        lines.add('Porta(s): ${portsList.join(", ")}');
      }
      if (ap != aps.last) {
        lines.add('');
      }
    }

    return lines.isEmpty ? 'Nao informada' : lines.join('\n');
  }

  String _buildOpeningContextText() {
    return _requestedByFieldTechnician
        ? 't\u00e9cnico em campo pedindo abertura de massiva'
        : 'evento de rompimento';
  }

  String _buildProtocolDescription() {
    final startedAt = _openedAt;
    final identifiedAt = _identifiedAt ?? DateTime.now();
    final normalizationAt = _closedAt;
    final affectedClients =
        _lastPreview?.totalAffected ?? _estimatedAffectedClients();
    final technicalReason = _technicalReasonController.text.trim().isEmpty
        ? 'N\u00e3o informado'
        : _technicalReasonController.text.trim();

    return [
      '\ud83d\udccb INFORMA\u00c7\u00d5ES OBRIGAT\u00d3RIAS - ABERTURA',
      '',
      '\ud83d\udc64 Nome do solicitante: ${_requesterName()}',
      '',
      '\ud83d\udee0\ufe0f Relato inicial: $technicalReason',
      '',
      '\ud83d\udce1 Origem massiva: ${_buildOpeningContextText()}',
      '',
      '\ud83d\udccd CTOs afetadas:',
      _buildMotivoText(),
      '',
      '\ud83d\uddfa\ufe0f Topologia:',
      _buildTopologiaText(),
      '',
      '\ud83d\udc65 Clientes afetados: $affectedClients',
      '',
      '\u23f0 Hor\u00e1rio que iniciou o evento: '
          '${startedAt != null ? DateFormat("HH:mm").format(startedAt) : "-"}',
      '',
      '\ud83d\udd0e Hor\u00e1rio que o evento foi identificado: '
          '${DateFormat("HH:mm").format(identifiedAt)}',
      '',
      '\ud83d\uddd3\ufe0f Prazo de normaliza\u00e7\u00e3o: '
          '${normalizationAt != null ? DateFormat("dd/MM/yyyy HH:mm").format(normalizationAt) : "aguardando infra"}',
    ].join('\n');
  }

  void _syncAutoDescription({bool force = false}) {
    // A descricao eh sugerida automaticamente enquanto o usuario preenche a
    // tela. Se ele editar manualmente, deixamos de sobrescrever, exceto quando
    // algum fluxo explicito pede sincronizacao forcada.
    if (!force &&
        _descriptionEditedManually &&
        _descriptionController.text.trim().isNotEmpty) {
      return;
    }

    _identifiedAt ??= DateTime.now();
    _syncingDescription = true;
    _descriptionController.text = _buildProtocolDescription();
    _descriptionController.selection = TextSelection.collapsed(
      offset: _descriptionController.text.length,
    );
    _syncingDescription = false;
    _descriptionEditedManually = false;
  }

  Future<void> _pickAp() async {
    await _ensureRouteCatalog();
    if (!mounted || _apOptions.isEmpty) return;

    final selected = await _selectMultiStringDialog(
      title: 'Selecione o Ponto de Acesso',
      hintText: 'Buscar Ponto de Acesso',
      source: _apOptions,
      initial: _selectedAps,
      itemLabel: _apDisplayLabel,
    );
    if (!mounted || selected == null) return;
    setState(() {
      _onApsChanged(selected);
    });
  }

  Future<void> _pickSlot() async {
    await _ensureRouteCatalog();
    if (!mounted) return;

    if (_selectedAps.isEmpty) {
      setState(() {
        _error = 'Selecione o Ponto de Acesso antes do Slot.';
      });
      return;
    }

    if (_slotOptions.isEmpty) {
      setState(() {
        _error = 'Nenhum Slot encontrado para o Ponto de Acesso selecionado.';
      });
      return;
    }

    final selectedByAp = <String, Set<int>>{};
    final aps = _selectedAps.toList()..sort();

    var i = 0;
    while (i < aps.length) {
      final ap = aps[i];
      final options = _slotOptionsForAp(ap);
      if (options.isEmpty) {
        i++;
        continue;
      }

      final selected = await _selectMultiIntDialog(
        title: '➡️ Slots do AP ${_apDisplayLabel(ap)} ⬅️',
        values: options,
        valueLabel: (v) => 'Slot $v',
        initial: selectedByAp[ap] ?? _selectedSlotsByAp[ap] ?? const <int>{},
        applyLabel: i == aps.length - 1 ? 'Aplicar' : 'Próximo',
        showBackButton: i > 0,
      );
      if (!mounted || selected == null) return;
      if (selected.action == _StepperDialogAction.back) {
        i--;
        continue;
      }

      selectedByAp[ap] = selected.values;
      i++;
    }

    setState(() {
      _clearPortSelection();
      _selectedSlotsByAp
        ..clear()
        ..addAll(selectedByAp);
      _rebuildSelectionSummaries();
      _refreshControllerLabels();
      _syncAutoDescription();
    });
  }

  Future<void> _pickPort() async {
    await _ensureRouteCatalog();
    if (!mounted) return;

    if (_selectedAps.isEmpty || _selectedSlotsByAp.isEmpty) {
      setState(() {
        _error = 'Selecione o Ponto de Acesso e Slot antes da Porta.';
      });
      return;
    }

    if (_portOptions.isEmpty) {
      setState(() {
        _error = 'Nenhuma Porta encontrada para o filtro atual.';
      });
      return;
    }

    final steps = <(String ap, int slot)>[];
    for (final apEntry in _selectedSlotsByAp.entries) {
      final slots = apEntry.value.toList()..sort();
      for (final slot in slots) {
        steps.add((apEntry.key, slot));
      }
    }

    final selectedByRoute = <String, Map<int, Set<int>>>{};

    var i = 0;
    while (i < steps.length) {
      final step = steps[i];
      final options = _portOptionsForApSlot(step.$1, step.$2);
      if (options.isEmpty) {
        i++;
        continue;
      }

      final selected = await _selectMultiIntDialog(
        title:
            'Portas do Ponto de Acesso ${_apDisplayLabel(step.$1)} ➡️ SLOT ${step.$2} ⬅️',
        values: options,
        valueLabel: (v) => 'Porta $v',
        initial: selectedByRoute[step.$1]?[step.$2] ??
            _selectedPortsByApSlot[step.$1]?[step.$2] ??
            const <int>{},
        applyLabel: i == steps.length - 1 ? 'Aplicar' : 'Próximo',
        showBackButton: i > 0,
      );
      if (!mounted || selected == null) return;
      if (selected.action == _StepperDialogAction.back) {
        i--;
        continue;
      }

      selectedByRoute.putIfAbsent(step.$1, () => {})[step.$2] = selected.values;
      i++;
    }

    setState(() {
      _clearSplitterSelection();
      _selectedPortsByApSlot
        ..clear()
        ..addAll(selectedByRoute);
      _rebuildSelectionSummaries();
      _refreshControllerLabels();
      _syncAutoDescription();
    });
  }

  Future<void> _pickSplitter() async {
    if (_selectedAps.isEmpty || _selectedPortsByApSlot.isEmpty) {
      setState(() {
        _error =
            'Selecione o Ponto de Acesso, Slot e Porta antes de escolher splitter.';
      });
      return;
    }

    if (_routeSplitterOptions.isEmpty) {
      setState(() {
        _error = 'Nenhum splitter encontrado para essa rota.';
      });
      return;
    }

    final steps = <(String ap, int slot, int port)>[];
    for (final apEntry in _selectedPortsByApSlot.entries) {
      final slotEntries = apEntry.value.entries.toList()
        ..sort((a, b) => a.key.compareTo(b.key));
      for (final slotEntry in slotEntries) {
        final ports = slotEntry.value.toList()..sort();
        for (final port in ports) {
          steps.add((apEntry.key, slotEntry.key, port));
        }
      }
    }

    final selectedByRoute = <String, Map<int, Map<int, Set<String>>>>{};

    var i = 0;
    while (i < steps.length) {
      final step = steps[i];
      final options = _splitterOptionsForRoute(step.$1, step.$2, step.$3);
      if (options.isEmpty) {
        i++;
        continue;
      }

      final selected = await _selectMultiSplittersDialog(
        title:
            'Splitters do Ponto de Acesso ${_apDisplayLabel(step.$1)} SLOT ${step.$2} ➡️ PORTA ${step.$3} ⬅️',
        sourceCodes: options,
        initial: selectedByRoute[step.$1]?[step.$2]?[step.$3] ??
            _selectedSplittersByRoute[step.$1]?[step.$2]?[step.$3] ??
            const <String>{},
        applyLabel: i == steps.length - 1 ? 'Aplicar' : 'Próximo',
        showBackButton: i > 0,
      );
      if (!mounted || selected == null) return;
      if (selected.action == _StepperDialogAction.back) {
        i--;
        continue;
      }

      selectedByRoute
          .putIfAbsent(step.$1, () => {})
          .putIfAbsent(step.$2, () => {})[step.$3] = selected.values;
      i++;
    }

    setState(() {
      _selectedSplittersByRoute
        ..clear()
        ..addAll(selectedByRoute);
      _rebuildSelectionSummaries();
      _refreshControllerLabels();
      _syncAutoDescription();
    });
  }

  Future<_StepperDialogResult<String>?> _selectMultiSplittersDialog({
    required List<String> sourceCodes,
    required Set<String> initial,
    String title = 'Selecione o splitter',
    String applyLabel = 'Aplicar',
    bool showBackButton = false,
  }) {
    final searchController = TextEditingController();
    var filtered = List<String>.from(sourceCodes);
    final selected = Set<String>.from(initial);
    String? validationMessage;

    return showDialog<_StepperDialogResult<String>>(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              backgroundColor:
                  isDark ? const Color(0xFF2F2F2F) : const Color(0xFFF7F7F7),
              surfaceTintColor: Colors.transparent,
              titleTextStyle: _dialogTitleStyle(isDark: isDark),
              title: Text(title),
              content: SizedBox(
                width: 520,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      style: _dialogFieldTextStyle(isDark: isDark),
                      decoration: _dialogSearchDecoration(
                        hintText: 'Buscar splitter',
                        isDark: isDark,
                      ),
                      onChanged: (value) {
                        final term = value.trim().toLowerCase();
                        setStateDialog(() {
                          validationMessage = null;
                          if (term.isEmpty) {
                            filtered = List<String>.from(sourceCodes);
                          } else {
                            filtered = sourceCodes.where((code) {
                              final label = _splitterLabel(code).toLowerCase();
                              return label.contains(term) ||
                                  code.toLowerCase().contains(term);
                            }).toList();
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    if (validationMessage != null) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          validationMessage!,
                          style: const TextStyle(
                            color: Color(0xFFC62828),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Flexible(
                      child: Container(
                        decoration: BoxDecoration(
                          color:
                              isDark ? const Color(0xFF3E3E3E) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.08)
                                : Colors.black.withValues(alpha: 0.06),
                          ),
                        ),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final code = filtered[index];
                            return ListTile(
                              dense: true,
                              textColor: isDark ? Colors.white : Colors.black87,
                              leading: Checkbox(
                                value: selected.contains(code),
                                activeColor: _headerYellow,
                                checkColor: const Color(0xFF1F1F1F),
                                side: BorderSide(
                                  color: isDark
                                      ? Colors.white54
                                      : const Color(0xFF6B6B6B),
                                  width: 1.6,
                                ),
                                onChanged: (_) {
                                  setStateDialog(() {
                                    validationMessage = null;
                                    if (selected.contains(code)) {
                                      selected.remove(code);
                                    } else {
                                      selected.add(code);
                                    }
                                  });
                                },
                              ),
                              title: Text(
                                _splitterLabel(code),
                                style: TextStyle(
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              onTap: () {
                                setStateDialog(() {
                                  validationMessage = null;
                                  if (selected.contains(code)) {
                                    selected.remove(code);
                                  } else {
                                    selected.add(code);
                                  }
                                });
                              },
                            );
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => setStateDialog(() => selected.clear()),
                  child: const Text('Limpar'),
                ),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => setStateDialog(() {
                    selected
                      ..clear()
                      ..addAll(sourceCodes);
                  }),
                  child: const Text('Selecionar tudo'),
                ),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
                if (showBackButton)
                  TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: _headerYellow,
                    ),
                    onPressed: () => Navigator.pop(
                      context,
                      _StepperDialogResult<String>(
                        action: _StepperDialogAction.back,
                        values: Set<String>.from(selected),
                      ),
                    ),
                    child: const Text('Voltar'),
                  ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _headerYellow,
                    foregroundColor: const Color(0xFF1F1F1F),
                  ),
                  onPressed: () {
                    if (selected.isEmpty) {
                      setStateDialog(() {
                        validationMessage =
                            'Selecione ao menos uma opção para continuar.';
                      });
                      return;
                    }
                    Navigator.pop(
                      context,
                      _StepperDialogResult<String>(
                        action: _StepperDialogAction.apply,
                        values: Set<String>.from(selected),
                      ),
                    );
                  },
                  child: Text(applyLabel),
                ),
              ],
            );
          },
        );
      },
    ).whenComplete(searchController.dispose);
  }

  Future<Set<String>?> _selectMultiStringDialog({
    required String title,
    required String hintText,
    required List<String> source,
    required Set<String> initial,
    String applyLabel = 'Aplicar',
    String Function(String value)? itemLabel,
  }) {
    final searchController = TextEditingController();
    var filtered = List<String>.from(source);
    final selected = Set<String>.from(initial);
    final labelOf = itemLabel ?? (String value) => value;
    String? validationMessage;

    return showDialog<Set<String>>(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              backgroundColor:
                  isDark ? const Color(0xFF2F2F2F) : const Color(0xFFF7F7F7),
              surfaceTintColor: Colors.transparent,
              titleTextStyle: _dialogTitleStyle(isDark: isDark),
              title: Text(title),
              content: SizedBox(
                width: 520,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      style: _dialogFieldTextStyle(isDark: isDark),
                      decoration: _dialogSearchDecoration(
                        hintText: hintText,
                        isDark: isDark,
                      ),
                      onChanged: (value) {
                        final term = value.trim().toLowerCase();
                        setStateDialog(() {
                          validationMessage = null;
                          if (term.isEmpty) {
                            filtered = List<String>.from(source);
                          } else {
                            filtered = source
                                .where(
                                  (s) =>
                                      labelOf(s).toLowerCase().contains(term),
                                )
                                .toList();
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    if (validationMessage != null) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          validationMessage!,
                          style: const TextStyle(
                            color: Color(0xFFC62828),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Flexible(
                      child: Container(
                        decoration: BoxDecoration(
                          color:
                              isDark ? const Color(0xFF3E3E3E) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.08)
                                : Colors.black.withValues(alpha: 0.06),
                          ),
                        ),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final item = filtered[index];
                            final itemText = labelOf(item);
                            return ListTile(
                              dense: true,
                              textColor: isDark ? Colors.white : Colors.black87,
                              leading: Checkbox(
                                value: selected.contains(item),
                                activeColor: _headerYellow,
                                checkColor: const Color(0xFF1F1F1F),
                                side: BorderSide(
                                  color: isDark
                                      ? Colors.white54
                                      : const Color(0xFF6B6B6B),
                                  width: 1.6,
                                ),
                                onChanged: (_) {
                                  setStateDialog(() {
                                    validationMessage = null;
                                    if (selected.contains(item)) {
                                      selected.remove(item);
                                    } else {
                                      selected.add(item);
                                    }
                                  });
                                },
                              ),
                              title: Text(
                                itemText,
                                style: TextStyle(
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              onTap: () {
                                setStateDialog(() {
                                  validationMessage = null;
                                  if (selected.contains(item)) {
                                    selected.remove(item);
                                  } else {
                                    selected.add(item);
                                  }
                                });
                              },
                            );
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => setStateDialog(() => selected.clear()),
                  child: const Text('Limpar'),
                ),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => setStateDialog(() {
                    selected
                      ..clear()
                      ..addAll(source);
                  }),
                  child: const Text('Selecionar tudo'),
                ),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _headerYellow,
                    foregroundColor: const Color(0xFF1F1F1F),
                  ),
                  onPressed: () {
                    if (selected.isEmpty) {
                      setStateDialog(() {
                        validationMessage =
                            'Selecione ao menos uma opcao para continuar.';
                      });
                      return;
                    }
                    Navigator.pop(context, selected);
                  },
                  child: Text(applyLabel),
                ),
              ],
            );
          },
        );
      },
    ).whenComplete(searchController.dispose);
  }

  Future<_StepperDialogResult<int>?> _selectMultiIntDialog({
    required String title,
    required List<int> values,
    required String Function(int value) valueLabel,
    required Set<int> initial,
    String applyLabel = 'Aplicar',
    bool showBackButton = false,
  }) {
    final selected = Set<int>.from(initial);
    String? validationMessage;
    return showDialog<_StepperDialogResult<int>>(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              backgroundColor:
                  isDark ? const Color(0xFF2F2F2F) : const Color(0xFFF7F7F7),
              surfaceTintColor: Colors.transparent,
              titleTextStyle: _dialogTitleStyle(isDark: isDark),
              title: Text(title),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (validationMessage != null) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          validationMessage!,
                          style: const TextStyle(
                            color: Color(0xFFC62828),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Flexible(
                      child: Container(
                        decoration: BoxDecoration(
                          color:
                              isDark ? const Color(0xFF3E3E3E) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.08)
                                : Colors.black.withValues(alpha: 0.06),
                          ),
                        ),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: values.length,
                          itemBuilder: (context, index) {
                            final value = values[index];
                            return ListTile(
                              dense: true,
                              textColor: isDark ? Colors.white : Colors.black87,
                              leading: Checkbox(
                                value: selected.contains(value),
                                activeColor: _headerYellow,
                                checkColor: const Color(0xFF1F1F1F),
                                side: BorderSide(
                                  color: isDark
                                      ? Colors.white54
                                      : const Color(0xFF6B6B6B),
                                  width: 1.6,
                                ),
                                onChanged: (_) {
                                  setStateDialog(() {
                                    validationMessage = null;
                                    if (selected.contains(value)) {
                                      selected.remove(value);
                                    } else {
                                      selected.add(value);
                                    }
                                  });
                                },
                              ),
                              title: Text(
                                valueLabel(value),
                                style: TextStyle(
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              onTap: () {
                                setStateDialog(() {
                                  validationMessage = null;
                                  if (selected.contains(value)) {
                                    selected.remove(value);
                                  } else {
                                    selected.add(value);
                                  }
                                });
                              },
                            );
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => setStateDialog(() => selected.clear()),
                  child: const Text('Limpar'),
                ),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => setStateDialog(() {
                    selected
                      ..clear()
                      ..addAll(values);
                  }),
                  child: const Text('Selecionar tudo'),
                ),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: _headerYellow),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
                if (showBackButton)
                  TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: _headerYellow,
                    ),
                    onPressed: () => Navigator.pop(
                      context,
                      _StepperDialogResult<int>(
                        action: _StepperDialogAction.back,
                        values: Set<int>.from(selected),
                      ),
                    ),
                    child: const Text('Voltar'),
                  ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _headerYellow,
                    foregroundColor: const Color(0xFF1F1F1F),
                  ),
                  onPressed: () {
                    if (selected.isEmpty) {
                      setStateDialog(() {
                        validationMessage =
                            'Selecione ao menos uma opcao para continuar.';
                      });
                      return;
                    }
                    Navigator.pop(
                      context,
                      _StepperDialogResult<int>(
                        action: _StepperDialogAction.apply,
                        values: Set<int>.from(selected),
                      ),
                    );
                  },
                  child: Text(applyLabel),
                ),
              ],
            );
          },
        );
      },
    );
  }

  List<int> _resolveAccessPointIds() {
    final splitterCodes = _selectedSplitters.isNotEmpty
        ? _selectedSplitters.toList()
        : _routeSplitterOptions;

    final ids = <int>{};
    for (final splitterCode in splitterCodes) {
      final splitter = _splitterByCode[splitterCode];
      final oltCode = splitter?.oltCode?.trim() ?? '';
      if (oltCode.isEmpty) continue;
      final oltId = widget.getOltIdByCode(oltCode);
      if (oltId != null && oltId > 0) {
        ids.add(oltId);
      }
    }

    return ids.toList()..sort();
  }

  String _buildApiGatewayTitle(String apCode) {
    final apTitle = (_apTitleByCode[apCode] ?? '').trim();
    return apTitle.isNotEmpty ? apTitle : apCode.trim();
  }

  Future<int?> getPersonEllevenId(String emailenviado, String token) async {
    final url = Uri.parse(
            'https://api-gateway-bff.sebratel.net.br/api/v1/employee/get-person-id-by-email')
        .replace(queryParameters: {
      'email': emailenviado,
    });

    final Map<String, String> headers = {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
    };

    try {
      final response = await http.get(url, headers: headers);

      if (response.statusCode == 200) {
        // 1. Decodifica a String JSON para um Map ou List
        final dynamic decodedResponse = jsonDecode(response.body);

        // 2. Extrai o ID (ajuste o caminho 'data' conforme a estrutura real do seu JSON)
        // Se o JSON for direto { "data": 123 }, use:
        final personId = decodedResponse['data'];

        return personId is int ? personId : int.tryParse(personId.toString());
      }

      if (response.statusCode == 401) {
        debugPrint('401 ao buscar personId, token pode estar expirado');
        final authBox = await Hive.openBox('auth_cache');
        await authBox.delete('googleIdToken');
        WebUtils.redirect("https://sebratel-hub.web.app");
        return null;
      }

      print('Erro na requisição: ${response.statusCode}');
      return null;
    } catch (e) {
      print('Erro de conexão: $e');
      return null; // Ou throw Exception se quiser travar o login
    }
  }

  Future<List<ApiGatewayMassivaRequest>> _buildApiGatewayRequests() async {
    final closedAt = _closedAt ?? DateTime.now();
    final description = _descriptionController.text.trim();
    final personId = await getPersonEllevenId(
        widget.sessionUser.email, widget.sessionUser.sessionToken ?? '');
    final aps = _selectedAps.toList()..sort();

    if (personId == null || personId <= 0) {
      throw Exception(
        'O token do HUB nao trouxe o personId do usuario logado. Nao foi possivel abrir a massiva automaticamente com o usuario atual.',
      );
    }

    return aps
        .map(
          (apCode) => ApiGatewayMassivaRequest(
            incidentStatusId: _apiIncidentStatusId,
            personId: personId,
            incidentTypeId: _apiIncidentTypeId,
            catalogServiceId: _apiCatalogServiceId,
            serviceLevelAgreementId: _apiServiceLevelAgreementId,
            matrixType: _apiMatrixType,
            teamCode: _apiTeamCode,
            solicitationServiceCategory1: _apiSolicitationServiceCategory1,
            solicitationServiceCategory2: '',
            solicitationServiceCategory3: '',
            solicitationServiceCategory4: '',
            solicitationServiceCategory5: '',
            authenticationAccessPointCode: apCode,
            affectedUsers: _buildAffectedUserRequests(
              apCode: apCode,
              protocol: 1, // O protocolo real ainda não existe, mas é necessário passar algum valor para construir a lista de afetados. O ideal seria retornar os protocolos abertos e construir a lista de afetados dentro do loop de abertura.
            ),
            assignment: ApiGatewayMassivaAssignment(
              title: _buildApiGatewayTitle(apCode),
              description: description,
              finalDate: closedAt.toUtc().toIso8601String(),
              companyPlaceId: _companyPlaceId,
            ),
          ),
        )
        .toList();
  }

  Future<void> _preview() async {
    if (!_formKey.currentState!.validate() || !_validateNetworkSelection()) {
      return;
    }

    setState(() {
      _loadingPreview = true;
      _error = null;
    });

    try {
      final filtered = _buildLocalPreview();

      if (!mounted) return;
      setState(() {
        _lastPreview = filtered;
        _syncAutoDescription();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loadingPreview = false);
      }
    }
  }

  Future<void> _openMassiva() async {
    if (!widget.sessionUser.canOpenMassiva) {
      setState(() {
        _error =
            'Sua sessão permite apenas acompanhamento de massivas. A abertura exige permissões adicionais.';
      });
      return;
    }

    if (!_validateOpenMassivaSelection()) {
      return;
    }

    // O fluxo atual abre uma ou mais massivas, uma por AP selecionado.
    // Em seguida, se configurado, envia a lista de PPPoEs afetados.
    if (!widget.gatewayService.isConfigured) {
      setState(() {
        _error = 'Configure MASSIVA_API_GATEWAY_ENDPOINT.';
      });
      return;
    }

    setState(() {
      _loadingSubmit = true;
      _error = null;
    });

    try {
      final requests = await _buildApiGatewayRequests();
      final openedProtocols = <String>[];
      final failureMessages = <String>[];
      final backendMessages = <String>[];
      final affectedMessages = <String>[];
      final affectedFailureMessages = <String>[];

      for (final request in requests) {
        final apLabel = _apDisplayLabel(request.authenticationAccessPointCode);
        try {
          final response = await widget.gatewayService.openMassivaViaApiGateway(
              request: request,
              affectedUsersQuantity: _estimatedAffectedClients(),
              affectedUsers: _buildAffectedUserRequests(
              apCode: request.authenticationAccessPointCode,
              protocol: 1, // O protocolo real ainda não existe, mas é necessário passar algum valor para construir a lista de afetados. O ideal seria retornar os protocolos abertos e construir a lista de afetados dentro do loop de abertura.
            ));

          final details = <String>[];
          if (response.protocol != null) {
            details.add('protocolo ${response.protocol}');
          }
          if (response.assignmentId != null) {
            details.add('assignment ${response.assignmentId}');
          }
          if (details.isEmpty) {
            details.add('sem identificadores retornados');
          }

          if (response.protocol != null &&
              widget.gatewayService.isAffectedUsersConfigured) {
            final affectedUsers = _buildAffectedUserRequests(
              apCode: request.authenticationAccessPointCode,
              protocol: response.protocol!,
            );

            if (affectedUsers.isNotEmpty) {
              try {
                final notifiedCount =
                    await widget.gatewayService.notifyAffectedUsers(
                  users: affectedUsers,
                );
                details.add('$notifiedCount PPPoEs enviados');
                affectedMessages.add('$apLabel: $notifiedCount PPPoEs');
              } catch (e) {
                affectedFailureMessages.add('$apLabel: ${e.toString()}');
              }
            } else {
              details.add('sem PPPoEs elegiveis');
            }
          }

          openedProtocols.add(
            '$apLabel: ${details.join(' | ')}',
          );
          if (response.message.trim().isNotEmpty) {
            backendMessages.add('$apLabel: ${response.message.trim()}');
          }
        } catch (e) {
          failureMessages.add(
            '$apLabel: ${e.toString()}',
          );
        }
      }

      if (!mounted) return;

      String? refreshError;
      if (openedProtocols.isNotEmpty) {
        refreshError = await _refreshMassivasAfterOpen();
        if (!mounted) return;
      }

      if (openedProtocols.isNotEmpty) {
        final extraMessage = backendMessages.isNotEmpty
            ? '\n💬 ${backendMessages.join(' | ')}'
            : '';
        final affectedExtra = affectedMessages.isNotEmpty
            ? '\n👥 ${affectedMessages.join(' | ')}'
            : '';
        final successText = requests.length == 1
            ? '✅ Massiva aberta com sucesso para ${_apDisplayLabel(requests.first.authenticationAccessPointCode)}.\n📌 ${openedProtocols.first.split(': ').last}$extraMessage$affectedExtra'
            : '✅ ${openedProtocols.length} massivas abertas com sucesso.\n📌 ${openedProtocols.join(' | ')}$extraMessage$affectedExtra';
        _showFeedbackSnackBar(
          successText,
          duration: const Duration(seconds: 5),
        );
      }

      if (failureMessages.isNotEmpty) {
        final refreshSuffix = refreshError == null
            ? ''
            : '\n⚠️ A listagem nao foi atualizada automaticamente.\n$refreshError';
        setState(() {
          _error =
              '⚠️ Não foi possível abrir a massiva.\n${failureMessages.join('\n')}$refreshSuffix';
        });
      } else if (affectedFailureMessages.isNotEmpty) {
        final refreshSuffix = refreshError == null
            ? ''
            : '\n⚠️ A listagem nao foi atualizada automaticamente.\n$refreshError';
        setState(() {
          _error =
              '⚠️ Massiva aberta, mas houve falha ao enviar PPPoEs afetados.\n${affectedFailureMessages.join('\n')}$refreshSuffix';
          _lastPreview = null;
        });
      } else if (refreshError != null) {
        setState(() {
          _error =
              '⚠️ Massiva aberta, mas nao foi possivel atualizar a listagem automaticamente.\n$refreshError';
          _lastPreview = null;
        });
      } else {
        setState(() {
          _error = null;
          _lastPreview = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loadingSubmit = false);
      }
    }
  }

  Future<String?> _refreshMassivasAfterOpen() async {
    if (!widget.gatewayService.isListConfigured) {
      return null;
    }

    if (mounted) {
      setState(() => _loadingMassivas = true);
    }

    try {
      // Recarrega a listagem assim que a abertura termina para que o usuario
      // consiga acompanhar imediatamente o protocolo que acabou de criar.
      final rows = await widget.gatewayService.fetchMassivas();
      if (!mounted) return null;
      setState(() {
        _massivas = rows;
        _loadedMassivas = true;
      });
      return null;
    } catch (e) {
      if (!mounted) return e.toString();
      setState(() => _loadedMassivas = true);
      return e.toString();
    } finally {
      if (mounted) {
        setState(() => _loadingMassivas = false);
      }
    }
  }

  bool _validateNetworkSelection() {
    if (_selectedAps.isEmpty ||
        _selectedSlots.isEmpty ||
        _selectedPorts.isEmpty) {
      setState(() {
        _error =
            'Selecione o Ponto de Acesso, Slot e Porta antes de continuar.';
      });
      return false;
    }

    if (_resolveAccessPointIds().isEmpty) {
      setState(() {
        _error =
            'Nao foi possivel mapear IDs de OLT para os APs/rotas selecionados.';
      });
      return false;
    }

    if (_closedDateController.text.trim().isEmpty ||
        _closedTimeController.text.trim().isEmpty) {
      setState(() {
        _error = 'Informe data e hora de previsão (prazo).';
      });
      return false;
    }

    if (widget.cookieString.trim().isEmpty) {
      setState(() {
        _error = 'Configure MASSIVA_COOKIE_STRING para abrir protocolos.';
      });
      return false;
    }

    if (_closedAt == null) {
      setState(() {
        _error = 'Informe data e hora de previsão (prazo).';
      });
      return false;
    }

    if (_isClosingBeforeOpening(_closedAt!)) {
      setState(() {
        _error = 'Data/hora de previsão nao pode ser menor que a abertura.';
      });
      return false;
    }

    return true;
  }

  bool _validateOpenMassivaSelection() {
    if (_selectedAps.isEmpty ||
        _selectedSlots.isEmpty ||
        _selectedPorts.isEmpty) {
      setState(() {
        _error =
            'Selecione o Ponto de Acesso, Slot e Porta antes de continuar.';
      });
      return false;
    }

    if (_closedDateController.text.trim().isEmpty ||
        _closedTimeController.text.trim().isEmpty ||
        _closedAt == null) {
      setState(() {
        _error = 'Informe data e hora de previsão (prazo).';
      });
      return false;
    }

    if (_descriptionController.text.trim().isEmpty) {
      setState(() {
        _error = 'Informe a descrição técnica antes de abrir a massiva.';
      });
      return false;
    }

    if (_isClosingBeforeOpening(_closedAt!)) {
      setState(() {
        _error = 'Data/hora de previsão não pode ser menor que a abertura.';
      });
      return false;
    }

    return true;
  }

  Future<void> _loadMassivas() async {
    if (!widget.gatewayService.isListConfigured) {
      if (mounted) {
        setState(() {
          _loadedMassivas = true;
        });
      }
      return;
    }

    setState(() {
      _loadingMassivas = true;
      _error = null;
    });

    try {
      // Alimenta a area de monitoramento com a visao consolidada devolvida
      // pelo backend.
      final rows = await widget.gatewayService.fetchMassivas();
      if (!mounted) return;
      setState(() {
        _massivas = rows;
        _loadedMassivas = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadedMassivas = true;
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _loadingMassivas = false);
      }
    }
  }

  Future<String?> _promptCloseMassivaDescription({
    required MassivaTicket item,
  }) async {
    final controller = TextEditingController();
    try {
      return await showDialog<String>(
        context: context,
        builder: (context) {
          final isDark = Theme.of(context).brightness == Brightness.dark;
          return AlertDialog(
            backgroundColor:
                isDark ? const Color(0xFF2F2F2F) : const Color(0xFFF7F7F7),
            surfaceTintColor: Colors.transparent,
            titleTextStyle: _dialogTitleStyle(isDark: isDark),
            title: Text('Encerrar massiva #${item.protocol}'),
            content: SizedBox(
              width: 520,
              child: TextField(
                controller: controller,
                autofocus: true,
                maxLines: 4,
                style: _dialogFieldTextStyle(isDark: isDark),
                decoration: _dialogSearchDecoration(
                  hintText: 'Informe a descricao do encerramento',
                  isDark: isDark,
                ),
              ),
            ),
            actions: [
              TextButton(
                style: TextButton.styleFrom(foregroundColor: _headerYellow),
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: _headerYellow,
                  foregroundColor: const Color(0xFF1F1F1F),
                ),
                onPressed: () {
                  final value = controller.text.trim();
                  if (value.isEmpty) {
                    return;
                  }
                  Navigator.pop(context, value);
                },
                child: const Text('Encerrar'),
              ),
            ],
          );
        },
      );
    } finally {
      controller.dispose();
    }
  }

  Future<void> _closeMassiva(MassivaTicket item) async {
    if (_closingMassiva) return;
    if (item.assignmentId == null || item.assignmentId! <= 0) {
      setState(() {
        _error =
            'Nao foi possivel encerrar a massiva #${item.protocol}: assignmentId nao encontrado.';
      });
      return;
    }

    final description = await _promptCloseMassivaDescription(item: item);
    if (!mounted || description == null) return;

    setState(() {
      _closingMassiva = true;
      _error = null;
    });

    try {
      // O encerramento depende do assignmentId retornado pelo backend.
      final closeMessage = await widget.gatewayService.closeMassiva(
        assignmentId: item.assignmentId!,
        description: description,
      );
      final cleanupMessage = await widget.gatewayService
          .deleteAffectedUsersByProtocol(item.protocol);

      if (!mounted) return;

      _showFeedbackSnackBar(
        'Massiva #${item.protocol} encerrada. $closeMessage | $cleanupMessage',
      );

      await _loadMassivas();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _closingMassiva = false);
      }
    }
  }

  Future<void> _loadAutoIspEvents() async {
    if (!widget.autoIspService.isConfigured) {
      if (mounted) {
        setState(() => _loadedAutoIsp = true);
      }
      return;
    }

    setState(() => _loadingAutoIsp = true);

    try {
      // Eventos AutoISP servem como apoio operacional. Eles nao substituem a
      // abertura da massiva, mas ajudam a sugerir rota e impacto.
      final rows = await widget.autoIspService.fetchEvents(
        page: 1,
        perPage: 100,
        adminStatuses: const ['new', 'acknowledged'],
      );
      if (!mounted) return;
      setState(() {
        _autoIspEvents = rows;
        _loadedAutoIsp = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadedAutoIsp = true;
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _loadingAutoIsp = false);
      }
    }
  }

  Future<void> _useAutoIspEvent(AutoIspEvent event) async {
    await _ensureRouteCatalog();
    while (_buildingRouteCatalog && mounted) {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }
    if (!mounted) return;

    final eventStart = event.startAt?.toLocal();

    final resolvedRoute =
        _resolveRouteByAutoIspUsername(event) ?? _resolveRouteByPonlink(event);

    setState(() {
      if (eventStart != null) {
        _openedAt = eventStart;
        _openedDateController.text =
            DateFormat('dd/MM/yyyy').format(eventStart);
        _openedTimeController.text = DateFormat('HH:mm:ss').format(eventStart);
      } else if (_openedAt == null && resolvedRoute != null) {
        _captureOpenedAtFromApSelection(hasApSelection: true);
      }

      _identifiedAt ??= DateTime.now();

      if (resolvedRoute != null) {
        _applyResolvedAutoIspRoute(resolvedRoute);
      }
    });

    if (_technicalReasonController.text.trim().isEmpty) {
      _technicalReasonController.text = event.eventType.trim().isEmpty
          ? 'AutoISP detectou degradacao'
          : event.eventType;
    }
    if (_descriptionController.text.trim().isEmpty) {
      _identifiedAt ??= DateTime.now();
      _syncAutoDescription(force: true);
    }

    _showFeedbackSnackBar(
      resolvedRoute?.username != null
          ? 'Evento aplicado com topologia resolvida pelo PPPoE.'
          : resolvedRoute != null
              ? 'Evento aplicado com topologia resolvida pelo PON.'
              : 'Dados base do evento aplicados no formulário.',
    );
  }

  List<MassivaTicket> get _filteredMassivas {
    final query = _massivaSearchController.text.trim().toLowerCase();

    return _massivas.where((m) {
      if (_statusFilter != null && m.status != _statusFilter) {
        return false;
      }

      if (_massivaApFilter != null &&
          _massivaApFilter!.trim().isNotEmpty &&
          m.apCode.trim() != _massivaApFilter!.trim()) {
        return false;
      }

      if (_massivaImpactFilter != null) {
        final affected = m.affectedClients;
        switch (_massivaImpactFilter) {
          case 1:
            if (affected < 1 || affected > 50) return false;
            break;
          case 2:
            if (affected < 51 || affected > 200) return false;
            break;
          case 3:
            if (affected < 201) return false;
            break;
        }
      }

      if (query.isEmpty) {
        return true;
      }

      final haystack = [
        m.protocol.toString(),
        m.title,
        m.apCode,
        m.createdBy,
        m.responsible,
        m.team,
      ].join(' ').toLowerCase();

      return haystack.contains(query);
    }).toList();
  }

  List<String> get _massivaApOptions {
    final options = _massivas
        .map((m) => m.apCode.trim())
        .where((it) => it.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    return options;
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '-';
    return DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal());
  }

  Future<void> _exportCsv() async {
    final rows = _filteredMassivas;
    if (rows.isEmpty) {
      _showFeedbackSnackBar('Sem dados para exportar.');
      return;
    }

    final buffer = StringBuffer();
    buffer.writeln(
      'protocol,title,status,ap,affected_clients,opened_at,expected_close_at,closed_at,fallback',
    );

    for (final item in rows) {
      final status = item.isOpen
          ? 'aberta'
          : item.isClosed
              ? 'encerrada'
              : 'desconhecida';
      buffer.writeln(
        '${item.protocol},"${item.title.replaceAll('"', "'")}",$status,'
        '"${item.apCode}",${item.affectedClients},'
        '"${item.openedAt?.toIso8601String() ?? ''}",'
        '"${item.expectedCloseAt?.toIso8601String() ?? ''}",'
        '"${item.closedAt?.toIso8601String() ?? ''}",${item.usedFallback}',
      );
    }

    await Clipboard.setData(ClipboardData(text: buffer.toString()));
    if (!mounted) return;
    _showFeedbackSnackBar('CSV copiado para a área de transferência.');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // A interface foi organizada como um dashboard operacional em tela unica:
    // formulario de abertura, preview do impacto e monitoramento.
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isDark
                      ? const [
                          Color.fromARGB(255, 36, 36, 36),
                          Color.fromARGB(255, 58, 58, 58),
                        ]
                      : const [
                          Color.fromARGB(255, 244, 244, 244),
                          Color.fromARGB(255, 228, 228, 228),
                        ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
          Column(
            children: [
              _buildHeader(isDark),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 32),
                  child: SelectionArea(
                    child: Center(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final isDesktop = constraints.maxWidth >= 1180;
                          final maxWidth = isDesktop ? 1480.0 : 1180.0;

                          return ConstrainedBox(
                            constraints: BoxConstraints(maxWidth: maxWidth),
                            child: Container(
                              padding: const EdgeInsets.all(18),
                              decoration: _panelDecoration(isDark: isDark),
                              child: RepaintBoundary(
                                child: Form(
                                  key: _formKey,
                                  child: isDesktop
                                      ? _buildDesktopMassivaLayout(
                                          isDark,
                                          viewportWidth: constraints.maxWidth,
                                        )
                                      : _buildMobileMassivaLayout(isDark),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMobileMassivaLayout(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildOpeningWorkspace(
          isDark: isDark,
          denseDesktop: false,
          includeHeader: true,
        ),
        const SizedBox(height: 22),
        RepaintBoundary(
          child: _buildAutoIspSection(isDark),
        ),
        const SizedBox(height: 22),
        RepaintBoundary(
          child: _buildMassivasMonitoringSection(isDark),
        ),
      ],
    );
  }

  Widget _buildDesktopMassivaLayout(
    bool isDark, {
    required double viewportWidth,
  }) {
    final isNotebook = viewportWidth < 1460;
    final isTightNotebook = viewportWidth < 1320;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildDesktopHeroSummary(
          isDark: isDark,
          compactDesktop: isNotebook,
        ),
        const SizedBox(height: 18),
        if (isNotebook)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildDesktopPane(
                isDark: isDark,
                title: 'Abertura da Massiva',
                subtitle:
                    'Comando principal para selecionar a topologia, validar o impacto e abrir o protocolo.',
                icon: Icons.edit_note_outlined,
                accent: _headerYellow,
                minHeight: isTightNotebook ? null : 920,
                compactDesktop: true,
                child: _buildOpeningWorkspace(
                  isDark: isDark,
                  denseDesktop: true,
                  includeHeader: false,
                ),
              ),
              const SizedBox(height: 18),
              _buildDesktopPane(
                isDark: isDark,
                title: 'Eventos AutoISP',
                subtitle:
                    'Eventos recentes para apoiar a decisão operacional e acelerar o preenchimento.',
                icon: Icons.sensors_outlined,
                accent: const Color(0xFFE0A100),
                minHeight: null,
                compactDesktop: true,
                child: _buildAutoIspSection(isDark, embedded: true),
              ),
            ],
          )
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 5,
                child: _buildDesktopPane(
                  isDark: isDark,
                  title: 'Abertura da Massiva',
                  subtitle:
                      'Comando principal para selecionar a topologia, validar o impacto e abrir o protocolo.',
                  icon: Icons.edit_note_outlined,
                  accent: _headerYellow,
                  minHeight: 1040,
                  child: _buildOpeningWorkspace(
                    isDark: isDark,
                    denseDesktop: true,
                    includeHeader: false,
                  ),
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                flex: 5,
                child: _buildDesktopPane(
                  isDark: isDark,
                  title: 'Eventos AutoISP',
                  subtitle:
                      'Eventos recentes para apoiar a decisão operacional e acelerar o preenchimento.',
                  icon: Icons.sensors_outlined,
                  accent: const Color(0xFFE0A100),
                  minHeight: 1040,
                  child: _buildAutoIspSection(isDark, embedded: true),
                ),
              ),
            ],
          ),
        const SizedBox(height: 18),
        _buildDesktopPane(
          isDark: isDark,
          title: 'Monitoramento e Controle',
          subtitle:
              'Acompanhe as massivas abertas, filtre rapidamente e exporte quando necessário.',
          icon: Icons.table_rows_outlined,
          accent: const Color.fromARGB(255, 192, 31, 31),
          compactDesktop: isNotebook,
          child: _buildMassivasMonitoringSection(
            isDark,
            embedded: true,
            desktopColumns: isTightNotebook
                ? 1
                : isNotebook
                    ? 2
                    : 3,
          ),
        ),
      ],
    );
  }

  Widget _buildOpeningWorkspace({
    required bool isDark,
    required bool denseDesktop,
    required bool includeHeader,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final openCloseWidth = denseDesktop ? 230.0 : constraints.maxWidth;
        final selectorWidth = denseDesktop ? 320.0 : constraints.maxWidth;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (includeHeader) _buildIncidentSectionHeader(isDark: isDark),
            if (includeHeader) const SizedBox(height: 18),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _buildPickerField(
                  controller: _openedDateController,
                  label: 'Data de abertura',
                  isDark: isDark,
                  width: openCloseWidth,
                  onTap: _pickOpeningDate,
                ),
                _buildPickerField(
                  controller: _openedTimeController,
                  label: 'Hora de abertura',
                  isDark: isDark,
                  width: openCloseWidth,
                  onTap: _pickOpeningTime,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 14,
              children: [
                _buildApPickerField(isDark: isDark, width: selectorWidth),
                _buildSlotPickerField(isDark: isDark, width: selectorWidth),
                _buildPortPickerField(isDark: isDark, width: selectorWidth),
                _buildSplitterPickerField(isDark: isDark, width: selectorWidth),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _buildReadOnlyField(
                  controller: _incidentTypeController,
                  label: 'Tipo de solicitação',
                  isDark: isDark,
                  width: selectorWidth,
                  locked: true,
                ),
                _buildPickerField(
                  controller: _closedDateController,
                  label: 'Previsão de finalização',
                  isDark: isDark,
                  width: selectorWidth,
                  onTap: _pickClosingDate,
                ),
                _buildPickerField(
                  controller: _closedTimeController,
                  label: 'Hora de previsão de finalização',
                  isDark: isDark,
                  width: selectorWidth,
                  onTap: _pickClosingTime,
                ),
                _buildTextField(
                  controller: _technicalReasonController,
                  label: 'Relato inicial',
                  isDark: isDark,
                  requiredField: false,
                  width: selectorWidth,
                ),
              ],
            ),
            const SizedBox(height: 26),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.04)
                    : Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : Colors.black.withValues(alpha: 0.05),
                ),
              ),
              child: CheckboxListTile(
                value: _requestedByFieldTechnician,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: const Color.fromARGB(255, 192, 31, 31),
                checkboxShape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
                title: Text(
                  'Técnico em campo solicitando abertura',
                  style: TextStyle(
                    color: isDark
                        ? Colors.white
                        : const Color.fromARGB(255, 24, 23, 23),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  'Alterna a origem da massiva entre técnico em campo e evento de rompimento.',
                  style: TextStyle(
                    color: isDark ? Colors.white70 : const Color(0xFF5A5A5A),
                  ),
                ),
                onChanged: (value) {
                  setState(() {
                    _requestedByFieldTechnician = value ?? false;
                    _syncAutoDescription();
                  });
                },
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () {
                  setState(() {
                    _syncAutoDescription(force: true);
                  });
                },
                icon: const Icon(Icons.auto_fix_high),
                label: const Text('Gerar descricao automatica'),
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descriptionController,
              maxLines: denseDesktop ? 14 : 10,
              validator: _requiredValidator,
              style: TextStyle(
                color: isDark
                    ? Colors.white
                    : const Color.fromARGB(255, 24, 23, 23),
              ),
              decoration: _fieldDecoration(
                label: 'Descrição técnica',
                isDark: isDark,
              ),
            ),
            const SizedBox(height: 12),
            _buildLiveImpactCard(isDark: isDark),
            if (!widget.sessionUser.canOpenMassiva) ...[
              const SizedBox(height: 12),
              _buildMessageCard(
                isDark: isDark,
                icon: Icons.visibility_outlined,
                accent: const Color(0xFFE0A100),
                backgroundLight: const Color(0xFFFFF8E1),
                backgroundDark: const Color(0xFF332A14),
                text:
                    'Sua sessão permite acompanhar as massivas abertas, mas não autoriza criar novas massivas.',
              ),
            ],
            const SizedBox(height: 12),
            if (denseDesktop)
              Wrap(
                spacing: 10,
                runSpacing: 12,
                children: [
                  ElevatedButton.icon(
                    style: _secondaryButtonStyle(),
                    onPressed: _loadingPreview ? null : _preview,
                    icon: _loadingPreview
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.fact_check_outlined),
                    label: const Text('Gerar Previa Local'),
                  ),
                  ElevatedButton.icon(
                    style: _primaryButtonStyle(),
                    onPressed:
                        widget.sessionUser.canOpenMassiva && !_loadingSubmit
                            ? _openMassiva
                            : null,
                    icon: _loadingSubmit
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.campaign),
                    label: const Text('Abrir Massiva'),
                  ),
                ],
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ElevatedButton.icon(
                    style: _secondaryButtonStyle(),
                    onPressed: _loadingPreview ? null : _preview,
                    icon: _loadingPreview
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.fact_check_outlined),
                    label: const Text('Gerar Previa Local'),
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    style: _primaryButtonStyle(),
                    onPressed:
                        widget.sessionUser.canOpenMassiva && !_loadingSubmit
                            ? _openMassiva
                            : null,
                    icon: _loadingSubmit
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.campaign),
                    label: const Text('Abrir Massiva'),
                  ),
                ],
              ),
            if (_lastPreview != null) ...[
              const SizedBox(height: 16),
              _buildMessageCard(
                isDark: isDark,
                icon: Icons.verified_outlined,
                accent: const Color(0xFF2E7D32),
                backgroundLight: const Color(0xFFE8F5E9),
                backgroundDark: const Color(0xFF1F2A1F),
                text:
                    'Previa local: ${_lastPreview!.totalAffected} clientes | ${_lastPreview!.totalPppoes} PPPoEs',
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              _buildMessageCard(
                isDark: isDark,
                icon: Icons.error_outline,
                accent: const Color(0xFFC62828),
                backgroundLight: const Color(0xFFFFEBEE),
                backgroundDark: const Color(0xFF341C1C),
                text: _error!,
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _buildDesktopHeroSummary({
    required bool isDark,
    bool compactDesktop = false,
  }) {
    final openCount =
        _massivas.where((m) => m.status == MassivaStatus.aberta).length;
    final impactedNow = _massivas
        .where((m) => m.status == MassivaStatus.aberta)
        .fold<int>(0, (sum, item) => sum + item.affectedClients);
    final autoIspOpen = _autoIspEvents.where((event) => event.isOpen).length;
    final selectedRoutes = _selectedPortsByApSlot.values
        .fold<int>(0, (sum, portsBySlot) => sum + portsBySlot.length);

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compactDesktop ? 16 : 18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(
          colors: isDark
              ? const [Color(0xFF393939), Color(0xFF2D2D2D)]
              : const [Color(0xFFFFFCF2), Color(0xFFF2EEE1)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: _headerYellow.withValues(alpha: isDark ? 0.20 : 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color:
                const Color(0xFFFFB300).withValues(alpha: isDark ? 0.10 : 0.14),
            blurRadius: 26,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (compactDesktop)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMiniBadge(
                  icon: Icons.space_dashboard_outlined,
                  label: 'Desktop Control Center',
                  accent: _headerYellow,
                  isDark: isDark,
                ),
                const SizedBox(height: 8),
                Text(
                  'Painel expandido para operar abertura, contexto e monitoramento ao mesmo tempo.',
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF2A2A2A),
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'No notebook a tela prioriza leitura e quebra os blocos mais cedo para evitar compressão.',
                  style: TextStyle(
                    color: isDark ? Colors.white70 : const Color(0xFF666666),
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.06)
                        : Colors.white.withValues(alpha: 0.68),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : Colors.black.withValues(alpha: 0.06),
                    ),
                  ),
                  child: Text(
                    'Seleções ativas: ${_selectedAps.length} APs | $selectedRoutes rotas',
                    style: TextStyle(
                      color: isDark ? Colors.white : const Color(0xFF333333),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    SizedBox(
                      width: 220,
                      child: _buildDesktopMetricCard(
                        isDark: isDark,
                        label: 'Massivas abertas',
                        value: openCount.toString(),
                        icon: Icons.campaign_outlined,
                        compactDesktop: true,
                      ),
                    ),
                    SizedBox(
                      width: 220,
                      child: _buildDesktopMetricCard(
                        isDark: isDark,
                        label: 'Impactados agora',
                        value: impactedNow.toString(),
                        icon: Icons.groups_2_outlined,
                        compactDesktop: true,
                      ),
                    ),
                    SizedBox(
                      width: 220,
                      child: _buildDesktopMetricCard(
                        isDark: isDark,
                        label: 'Eventos AutoISP',
                        value: autoIspOpen.toString(),
                        icon: Icons.sensors_outlined,
                        compactDesktop: true,
                      ),
                    ),
                  ],
                ),
              ],
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildMiniBadge(
                        icon: Icons.space_dashboard_outlined,
                        label: 'Desktop Control Center',
                        accent: _headerYellow,
                        isDark: isDark,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Painel expandido para operar abertura, contexto e monitoramento ao mesmo tempo.',
                        style: TextStyle(
                          color:
                              isDark ? Colors.white : const Color(0xFF2A2A2A),
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'No desktop a tela distribui o fluxo em áreas simultâneas para reduzir rolagem e dar mais leitura operacional.',
                        style: TextStyle(
                          color:
                              isDark ? Colors.white70 : const Color(0xFF666666),
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 18),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.06)
                        : Colors.white.withValues(alpha: 0.68),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : Colors.black.withValues(alpha: 0.06),
                    ),
                  ),
                  child: Text(
                    'Seleções ativas: ${_selectedAps.length} APs | $selectedRoutes rotas',
                    style: TextStyle(
                      color: isDark ? Colors.white : const Color(0xFF333333),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: _buildDesktopMetricCard(
                    isDark: isDark,
                    label: 'Massivas abertas',
                    value: openCount.toString(),
                    icon: Icons.campaign_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDesktopMetricCard(
                    isDark: isDark,
                    label: 'Impactados agora',
                    value: impactedNow.toString(),
                    icon: Icons.groups_2_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDesktopMetricCard(
                    isDark: isDark,
                    label: 'Eventos AutoISP',
                    value: autoIspOpen.toString(),
                    icon: Icons.sensors_outlined,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDesktopMetricCard({
    required bool isDark,
    required String label,
    required String value,
    required IconData icon,
    bool compactDesktop = false,
  }) {
    return Container(
      padding: EdgeInsets.all(compactDesktop ? 14 : 16),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _headerYellow.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: _headerYellow),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF1F1F1F),
                    fontWeight: FontWeight.w900,
                    fontSize: compactDesktop ? 22 : 24,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    color: isDark ? Colors.white70 : const Color(0xFF666666),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopPane({
    required bool isDark,
    required String title,
    required String subtitle,
    required IconData icon,
    required Color accent,
    required Widget child,
    double? minHeight,
    bool compactDesktop = false,
  }) {
    return Container(
      width: double.infinity,
      constraints:
          minHeight != null ? BoxConstraints(minHeight: minHeight) : null,
      padding: EdgeInsets.all(compactDesktop ? 16 : 18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? const [Color(0xFF373737), Color(0xFF313131)]
              : const [
                  Color.fromARGB(255, 252, 250, 246),
                  Color.fromARGB(255, 245, 241, 234),
                ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: accent.withValues(alpha: isDark ? 0.28 : 0.22),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.07),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: accent.withValues(alpha: isDark ? 0.08 : 0.06),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: compactDesktop ? 42 : 46,
                height: compactDesktop ? 42 : 46,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: isDark ? Colors.white : const Color(0xFF1F1F1F),
                        fontSize: compactDesktop ? 18 : 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color:
                            isDark ? Colors.white70 : const Color(0xFF666666),
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }

  Widget _buildMassivasMonitoringSection(
    bool isDark, {
    bool embedded = false,
    int? desktopColumns,
  }) {
    final massivasView = _filteredMassivas;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (!embedded)
              Expanded(
                child: Text(
                  'Acompanhamento de Massivas',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: isDark
                            ? Colors.white
                            : const Color.fromARGB(255, 24, 23, 23),
                      ),
                ),
              )
            else
              const Spacer(),
            IconButton(
              tooltip: 'Atualizar',
              onPressed: _loadingMassivas ? null : _loadMassivas,
              icon: _loadingMassivas
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      Icons.refresh,
                      color: isDark
                          ? Colors.white
                          : const Color.fromARGB(255, 24, 23, 23),
                    ),
            ),
            const SizedBox(width: 6),
            ElevatedButton.icon(
              onPressed: _exportCsv,
              style: _primaryButtonStyle(),
              icon: const Icon(Icons.download_outlined),
              label: const Text('Exportar CSV'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 280,
              child: TextField(
                controller: _massivaSearchController,
                onChanged: (_) => setState(() {}),
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF161616),
                ),
                decoration: _dialogSearchDecoration(
                  hintText: 'Buscar protocolo, título, Ponto de Acesso...',
                  isDark: isDark,
                ),
              ),
            ),
            if (_massivaApOptions.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.06)
                      : Colors.white.withValues(alpha: 0.82),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.10)
                        : Colors.black.withValues(alpha: 0.08),
                  ),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String?>(
                    value: _massivaApFilter,
                    hint: const Text('Filtrar Ponto de Acesso'),
                    dropdownColor:
                        isDark ? const Color(0xFF2B2B2B) : Colors.white,
                    style: TextStyle(
                      color: isDark ? Colors.white : const Color(0xFF161616),
                      fontWeight: FontWeight.w600,
                    ),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Todos APs'),
                      ),
                      ..._massivaApOptions.map(
                        (ap) => DropdownMenuItem<String?>(
                          value: ap,
                          child: Text(ap),
                        ),
                      ),
                    ],
                    onChanged: (value) {
                      setState(() => _massivaApFilter = value);
                    },
                  ),
                ),
              ),
            _filterChip(
              label: 'Todas',
              isDark: isDark,
              selected: _statusFilter == null,
              onTap: () => setState(() => _statusFilter = null),
            ),
            _filterChip(
              label: 'Abertas',
              isDark: isDark,
              selected: _statusFilter == MassivaStatus.aberta,
              onTap: () => setState(() {
                _statusFilter = _statusFilter == MassivaStatus.aberta
                    ? null
                    : MassivaStatus.aberta;
              }),
            ),
            _filterChip(
              label: '1-50 impactados',
              isDark: isDark,
              selected: _massivaImpactFilter == 1,
              onTap: () => setState(() {
                _massivaImpactFilter = _massivaImpactFilter == 1 ? null : 1;
              }),
            ),
            _filterChip(
              label: '51-200 impactados',
              isDark: isDark,
              selected: _massivaImpactFilter == 2,
              onTap: () => setState(() {
                _massivaImpactFilter = _massivaImpactFilter == 2 ? null : 2;
              }),
            ),
            _filterChip(
              label: '200+ impactados',
              isDark: isDark,
              selected: _massivaImpactFilter == 3,
              onTap: () => setState(() {
                _massivaImpactFilter = _massivaImpactFilter == 3 ? null : 3;
              }),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (!widget.gatewayService.isListConfigured)
          _buildMessageCard(
            isDark: isDark,
            icon: Icons.settings_ethernet_outlined,
            accent: const Color(0xFFEF6C00),
            backgroundLight: const Color(0xFFFFF8E1),
            backgroundDark: const Color(0xFF2E2E2E),
            text:
                'Configure MASSIVA_API_GATEWAY_LIST_ENDPOINT para habilitar monitoramento.',
          )
        else if (_loadingMassivas && !_loadedMassivas)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (massivasView.isEmpty)
          _buildMessageCard(
            isDark: isDark,
            icon: Icons.inbox_outlined,
            accent: const Color(0xFF757575),
            backgroundLight: const Color.fromARGB(255, 236, 236, 236),
            backgroundDark: const Color(0xFF2E2E2E),
            text: 'Nenhuma massiva encontrada.',
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final isSingleColumn = constraints.maxWidth < 900;
              final crossAxisCount = desktopColumns ??
                  (isSingleColumn
                      ? 1
                      : constraints.maxWidth >= 1320
                          ? 3
                          : 2);
              final visibleItems = massivasView.take(24).toList();
              final childAspectRatio = crossAxisCount == 1
                  ? 0.90
                  : crossAxisCount == 2
                      ? 1.22
                      : 1.15;

              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: visibleItems.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: crossAxisCount,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: childAspectRatio,
                ),
                itemBuilder: (context, index) {
                  return _massivaRow(
                    item: visibleItems[index],
                    isDark: isDark,
                  );
                },
              );
            },
          ),
      ],
    );

    if (embedded) return content;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _sectionDecoration(isDark: isDark),
      child: content,
    );
  }

  Widget _buildAutoIspSection(
    bool isDark, {
    bool embedded = false,
  }) {
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (!embedded)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildMiniBadge(
                      icon: Icons.sensors_outlined,
                      label: 'AutoISP',
                      accent: _headerYellow,
                      isDark: isDark,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Eventos AutoISP (apoio a decisao)',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: isDark
                                ? Colors.white
                                : const Color.fromARGB(255, 24, 23, 23),
                          ),
                    ),
                  ],
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildMiniBadge(
                    icon: Icons.sensors_outlined,
                    label: '${_autoIspEvents.length} eventos',
                    accent: _headerYellow,
                    isDark: isDark,
                  ),
                ],
              ),
            const Spacer(),
            IconButton(
              tooltip: 'Atualizar eventos',
              onPressed: _loadingAutoIsp ? null : _loadAutoIspEvents,
              icon: _loadingAutoIsp
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      Icons.refresh,
                      color: isDark
                          ? Colors.white
                          : const Color.fromARGB(255, 24, 23, 23),
                    ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (!widget.autoIspService.isConfigured)
          _buildMessageCard(
            isDark: isDark,
            icon: Icons.settings_input_antenna_outlined,
            accent: const Color(0xFFEF6C00),
            backgroundLight: const Color(0xFFFFF8E1),
            backgroundDark: const Color(0xFF2E2E2E),
            text:
                'Configure AUTOISP_EVENTS_ENDPOINT e as credenciais AUTOISP_AUTH_ENDPOINT/AUTOISP_USERNAME/AUTOISP_PASSWORD para habilitar os eventos detectados.',
          )
        else if (_loadingAutoIsp && !_loadedAutoIsp)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_autoIspEvents.isEmpty)
          _buildMessageCard(
            isDark: isDark,
            icon: Icons.wifi_tethering_off_outlined,
            accent: const Color(0xFF757575),
            backgroundLight: const Color.fromARGB(255, 236, 236, 236),
            backgroundDark: const Color(0xFF2E2E2E),
            text: 'Nenhum evento recente retornado pelo AutoISP.',
          )
        else
          ..._autoIspEvents.take(10).map((e) => _autoIspRow(e, isDark)),
      ],
    );

    if (embedded) return content;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _sectionDecoration(isDark: isDark),
      child: content,
    );
  }

  Widget _autoIspRow(AutoIspEvent event, bool isDark) {
    final badgeColor =
        event.isOpen ? const Color(0xFFE53935) : const Color(0xFF43A047);
    final ponlinks = event.resources
        .map((r) => r.ponlink?.trim() ?? '')
        .where((it) => it.isNotEmpty)
        .toSet()
        .toList();
    final ponText = ponlinks.isEmpty ? '-' : ponlinks.take(3).join(', ');

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: _subsectionCardDecoration(isDark: isDark),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  event.isOpen ? 'NOVO/ABERTO' : 'ENCERRADO',
                  style: TextStyle(
                    color: badgeColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Evento #${event.id} - ${event.eventType}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () => _useAutoIspEvent(event),
                style: TextButton.styleFrom(
                  foregroundColor: const Color.fromARGB(255, 192, 31, 31),
                  textStyle: const TextStyle(fontWeight: FontWeight.w700),
                ),
                icon: const Icon(Icons.input_outlined, size: 16),
                label: const Text('Usar'),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Inicio: ${_formatDate(event.startAt)} | ONUs: ${event.countOnus} | Circuitos: ${event.countCircuits}',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white70 : const Color(0xFF595959),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'PONs: $ponText',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white60 : const Color(0xFF595959),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniBadge({
    required IconData icon,
    required String label,
    required Color accent,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: isDark ? 0.16 : 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: accent),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: isDark ? accent : accent.withValues(alpha: 0.95),
              fontWeight: FontWeight.w800,
              fontSize: 11,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip({
    required String label,
    required bool isDark,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: const Color.fromARGB(255, 192, 31, 31),
      backgroundColor: isDark
          ? Colors.white.withValues(alpha: 0.08)
          : Colors.white.withValues(alpha: 0.72),
      side: BorderSide(
        color: selected
            ? const Color.fromARGB(255, 192, 31, 31)
            : isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.08),
      ),
      labelStyle: TextStyle(
        color: selected
            ? Colors.white
            : isDark
                ? Colors.white70
                : const Color(0xFF333333),
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _massivaRow({
    required MassivaTicket item,
    required bool isDark,
  }) {
    final statusColor = item.isOpen
        ? const Color(0xFFE53935)
        : item.isClosed
            ? const Color(0xFF43A047)
            : const Color(0xFF757575);
    final cardBackground =
        isDark ? const Color(0xFF1B1B1B) : const Color(0xFFFFFEFA);
    final titleColor = isDark ? Colors.white : const Color(0xFF161616);
    final subtitleColor = isDark ? Colors.white70 : const Color(0xFF4E4E4E);
    final borderColor = statusColor.withValues(alpha: isDark ? 0.28 : 0.20);

    Widget infoChip({
      required IconData icon,
      required String label,
      Color? accent,
    }) {
      final chipAccent = accent ?? statusColor;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: chipAccent.withValues(alpha: isDark ? 0.16 : 0.10),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: chipAccent.withValues(alpha: isDark ? 0.28 : 0.18),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: chipAccent),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: titleColor,
              ),
            ),
          ],
        ),
      );
    }

    Widget impactedHighlight() {
      const accent = Color.fromARGB(255, 233, 159, 1);
      final shellColor =
          isDark ? const Color(0xFF2F2610) : const Color(0xFFFFF9E8);
      return LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 420;
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  accent.withValues(alpha: isDark ? 0.28 : 0.20),
                  shellColor,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: accent.withValues(alpha: isDark ? 0.40 : 0.22),
              ),
              boxShadow: [
                BoxShadow(
                  color: accent.withValues(alpha: isDark ? 0.16 : 0.10),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: isDark ? 0.18 : 0.14),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: accent.withValues(alpha: isDark ? 0.32 : 0.20),
                    ),
                  ),
                  child: const Icon(
                    Icons.people_alt_rounded,
                    color: accent,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Clientes afetados',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                          color: subtitleColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.affectedClients.toString(),
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          height: 1,
                          color: titleColor,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!compact)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color:
                          Colors.white.withValues(alpha: isDark ? 0.06 : 0.55),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: accent.withValues(alpha: isDark ? 0.24 : 0.14),
                      ),
                    ),
                    child: Text(
                      'Impactados',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: accent.withValues(alpha: isDark ? 0.95 : 1),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      );
    }

    Widget metaLine({
      required IconData icon,
      required String label,
      required String value,
    }) {
      return Row(
        children: [
          Icon(icon, size: 15, color: subtitleColor),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: subtitleColor,
            ),
          ),
          Expanded(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                color: titleColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final compactCard = constraints.maxWidth < 560;

        Widget statusBadge() {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: statusColor.withValues(alpha: 0.26),
              ),
            ),
            child: Text(
              item.isOpen
                  ? 'ABERTA'
                  : item.isClosed
                      ? 'ENCERRADA'
                      : 'N/D',
              style: TextStyle(
                color: statusColor,
                fontWeight: FontWeight.w800,
                fontSize: 11,
                letterSpacing: 0.4,
              ),
            ),
          );
        }

        Widget closeButton() {
          return SelectionContainer.disabled(
            child: FilledButton.icon(
              onPressed: _closingMassiva ? null : () => _closeMassiva(item),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE53935),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                ),
              ),
              icon: _closingMassiva
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.check_circle_outline, size: 16),
              label: const Text('Encerrar'),
            ),
          );
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          child: Container(
            padding: EdgeInsets.all(compactCard ? 12 : 14),
            decoration: BoxDecoration(
              color: cardBackground,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: borderColor),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.24 : 0.08),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (compactCard) ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              statusColor.withValues(alpha: 0.95),
                              statusColor.withValues(alpha: 0.65),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: statusColor.withValues(alpha: 0.28),
                              blurRadius: 12,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.campaign_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '#${item.protocol}',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.2,
                                color: titleColor,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                height: 1.25,
                                color: titleColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      statusBadge(),
                      if (item.usedFallback)
                        const Tooltip(
                          message: 'Aberta com fallback individual',
                          child: Icon(
                            Icons.alt_route,
                            color: Color.fromARGB(255, 192, 31, 31),
                          ),
                        ),
                      if (item.isOpen) closeButton(),
                    ],
                  ),
                ] else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              statusColor.withValues(alpha: 0.95),
                              statusColor.withValues(alpha: 0.65),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: statusColor.withValues(alpha: 0.28),
                              blurRadius: 12,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.campaign_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '#${item.protocol}',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.2,
                                      color: titleColor,
                                    ),
                                  ),
                                ),
                                statusBadge(),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                height: 1.25,
                                color: titleColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (item.usedFallback)
                        const Padding(
                          padding: EdgeInsets.only(left: 10, top: 2),
                          child: Tooltip(
                            message: 'Aberta com fallback individual',
                            child: Icon(
                              Icons.alt_route,
                              color: Color.fromARGB(255, 192, 31, 31),
                            ),
                          ),
                        ),
                      if (item.isOpen)
                        Padding(
                          padding: const EdgeInsets.only(left: 10, top: 2),
                          child: closeButton(),
                        ),
                    ],
                  ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    infoChip(
                      icon: Icons.account_tree_outlined,
                      label: item.apCode.isEmpty
                          ? 'Ponto de acesso não informado'
                          : item.apCode,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                impactedHighlight(),
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.04)
                        : Colors.black.withValues(alpha: 0.025),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      metaLine(
                        icon: Icons.schedule_outlined,
                        label: 'Abertura',
                        value: _formatDate(item.openedAt),
                      ),
                      if (item.expectedCloseAt != null) ...[
                        const SizedBox(height: 6),
                        metaLine(
                          icon: Icons.event_note_outlined,
                          label: 'Previsão de encerramento',
                          value: _formatDate(item.expectedCloseAt),
                        ),
                      ],
                      if (item.isClosed && item.closedAt != null) ...[
                        const SizedBox(height: 6),
                        metaLine(
                          icon: Icons.event_available_outlined,
                          label: 'Fechamento',
                          value: _formatDate(item.closedAt),
                        ),
                      ],
                      if (item.team.trim().isNotEmpty) ...[
                        const SizedBox(height: 6),
                        metaLine(
                          icon: Icons.groups_2_outlined,
                          label: 'Equipe',
                          value: item.team.trim(),
                        ),
                      ],
                      if (item.createdBy.trim().isNotEmpty) ...[
                        const SizedBox(height: 6),
                        metaLine(
                          icon: Icons.person_add_alt_1_outlined,
                          label: 'Solicitado por',
                          value: item.createdBy.trim(),
                        ),
                      ],
                      if (item.responsible.trim().isNotEmpty) ...[
                        const SizedBox(height: 6),
                        metaLine(
                          icon: Icons.badge_outlined,
                          label: 'Responsável',
                          value: item.responsible.trim(),
                        ),
                      ],
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

  Widget _buildHeader(bool isDark) {
    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(32),
        bottomRight: Radius.circular(32),
      ),
      child: SizedBox(
        height: 130,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              'assets/images/sebratelimagem.jpg',
              fit: BoxFit.cover,
            ),
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
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
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
                            onPressed: () => Navigator.pop(context),
                            icon: const Icon(
                              Icons.arrow_back,
                              color: Colors.white,
                              size: 30,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Image.asset(
                          'assets/icons/logo-circular-sebratel.png',
                          width: 42,
                          height: 42,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'ABERTURA MASSIVAS',
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(
                              fontWeight: FontWeight.w900,
                              fontSize: 33,
                              letterSpacing: 0.9,
                              color: Colors.white,
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
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Selecione o componente afetado e execute o fluxo granular.',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.95),
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
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

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required bool isDark,
    bool isNumeric = false,
    bool requiredField = true,
    double width = 200,
  }) {
    return SizedBox(
      width: width,
      child: TextFormField(
        controller: controller,
        keyboardType: isNumeric ? TextInputType.number : TextInputType.text,
        validator: requiredField ? _requiredValidator : null,
        decoration: _fieldDecoration(label: label, isDark: isDark),
        style: TextStyle(
          color: isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23),
        ),
      ),
    );
  }

  Widget _buildReadOnlyField({
    required TextEditingController controller,
    required String label,
    required bool isDark,
    double width = 200,
    bool locked = false,
  }) {
    final fillColor = locked
        ? (isDark
            ? const Color.fromARGB(255, 46, 46, 46)
            : const Color.fromARGB(255, 230, 230, 230))
        : (isDark ? const Color.fromARGB(255, 58, 58, 58) : Colors.white);
    final textColor = locked
        ? (isDark ? Colors.white70 : const Color.fromARGB(255, 80, 80, 80))
        : (isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23));
    final borderColor = locked
        ? (isDark ? Colors.white24 : const Color.fromARGB(255, 170, 170, 170))
        : null;

    return SizedBox(
      width: width,
      child: AbsorbPointer(
        absorbing: locked,
        child: TextFormField(
          controller: controller,
          readOnly: true,
          canRequestFocus: !locked,
          enableInteractiveSelection: !locked,
          showCursor: !locked,
          decoration: _fieldDecoration(
            label: label,
            isDark: isDark,
            fillColorOverride: fillColor,
            enabledBorderColor: borderColor,
            suffixIcon: locked
                ? Icon(
                    Icons.lock_outline,
                    size: 18,
                    color: isDark ? Colors.white54 : Colors.black45,
                  )
                : null,
          ),
          style: TextStyle(color: textColor),
        ),
      ),
    );
  }

  Widget _buildPickerField({
    required TextEditingController controller,
    required String label,
    required bool isDark,
    required VoidCallback onTap,
    double width = 200,
  }) {
    return SizedBox(
      width: width,
      child: TextFormField(
        controller: controller,
        readOnly: true,
        onTap: onTap,
        validator: _requiredValidator,
        decoration: _fieldDecoration(
          label: label,
          isDark: isDark,
          suffixIcon: Icon(
            Icons.event_outlined,
            color: isDark ? Colors.white70 : const Color(0xFF666666),
          ),
        ),
        style: TextStyle(
          color: isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23),
        ),
      ),
    );
  }

  Widget _buildApPickerField({
    required bool isDark,
    double width = 200,
  }) {
    final isSelected = _selectedAps.isNotEmpty;
    return SizedBox(
      width: width,
      child: TextFormField(
        controller: _apController,
        readOnly: true,
        onTap: _pickAp,
        validator: _requiredValidator,
        decoration: _fieldDecoration(
          label: 'Ponto de acesso',
          isDark: isDark,
          suffixIcon: _buildFieldSuffix(
            isDark: isDark,
            selected: isSelected,
            onTap: _pickAp,
            actionTooltip: 'Buscar Ponto de acesso',
            selectedTooltip: isSelected
                ? _selectedAps.length == _apOptions.length
                    ? 'Todos selecionados'
                    : '${_selectedAps.length} selecionado(s)'
                : 'Nao selecionado',
          ),
        ),
        style: TextStyle(
          color: isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23),
        ),
      ),
    );
  }

  Widget _buildSlotPickerField({
    required bool isDark,
    double width = 200,
  }) {
    final isSelected = _selectedSlots.isNotEmpty;
    return SizedBox(
      width: width,
      child: TextFormField(
        controller: _slotController,
        readOnly: true,
        onTap: _pickSlot,
        validator: _requiredValidator,
        decoration: _fieldDecoration(
          label: 'Slot',
          isDark: isDark,
          suffixIcon: _buildFieldSuffix(
            isDark: isDark,
            selected: isSelected,
            onTap: _pickSlot,
            actionTooltip: 'Buscar Slot',
            selectedTooltip: isSelected
                ? _selectedSlots.length == _slotOptions.length
                    ? 'Todos selecionados'
                    : '${_selectedSlots.length} selecionado(s)'
                : 'Nao selecionado',
          ),
        ),
        style: TextStyle(
          color: isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23),
        ),
      ),
    );
  }

  Widget _buildPortPickerField({
    required bool isDark,
    double width = 200,
  }) {
    final isSelected = _selectedPorts.isNotEmpty;
    return SizedBox(
      width: width,
      child: TextFormField(
        controller: _portController,
        readOnly: true,
        onTap: _pickPort,
        validator: _requiredValidator,
        decoration: _fieldDecoration(
          label: 'Pon',
          isDark: isDark,
          suffixIcon: _buildFieldSuffix(
            isDark: isDark,
            selected: isSelected,
            onTap: _pickPort,
            actionTooltip: 'Buscar Porta',
            selectedTooltip: isSelected
                ? _selectedPorts.length == _portOptions.length
                    ? 'Todos selecionados'
                    : '${_selectedPorts.length} selecionado(s)'
                : 'Nao selecionado',
          ),
        ),
        style: TextStyle(
          color: isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23),
        ),
      ),
    );
  }

  Widget _buildSplitterPickerField({
    required bool isDark,
    double width = 200,
  }) {
    final isSelected = _selectedSplitters.isNotEmpty;
    return SizedBox(
      width: width,
      child: TextFormField(
        controller: _splitterController,
        readOnly: true,
        onTap: _pickSplitter,
        decoration: _fieldDecoration(
          label: 'Splitter',
          isDark: isDark,
          hintText: 'Opcional (todos por padrão)',
          suffixIcon: _buildFieldSuffix(
            isDark: isDark,
            selected: isSelected,
            onTap: _pickSplitter,
            actionTooltip: 'Escolher splitter',
            selectedTooltip: isSelected
                ? _selectedSplitters.length == _routeSplitterOptions.length
                    ? 'Todos selecionados'
                    : '${_selectedSplitters.length} selecionado(s)'
                : 'Nao selecionado',
          ),
        ),
        style: TextStyle(
          color: isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23),
        ),
      ),
    );
  }

  Widget _buildFieldSuffix({
    required bool isDark,
    required bool selected,
    required VoidCallback onTap,
    required String actionTooltip,
    required String selectedTooltip,
  }) {
    return SizedBox(
      width: 72,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          Tooltip(
            message: selectedTooltip,
            child: Icon(
              selected ? Icons.check_circle : Icons.radio_button_unchecked,
              color: selected
                  ? const Color.fromARGB(255, 67, 160, 71)
                  : (isDark ? Colors.white54 : Colors.black38),
              size: 20,
            ),
          ),
          IconButton(
            tooltip: actionTooltip,
            onPressed: onTap,
            icon: Icon(
              Icons.search,
              color:
                  isDark ? Colors.white : const Color.fromARGB(255, 24, 23, 23),
            ),
          ),
        ],
      ),
    );
  }

  BoxDecoration _panelDecoration({required bool isDark}) {
    return BoxDecoration(
      gradient: LinearGradient(
        colors: isDark
            ? const [
                Color(0xFF565656),
                Color(0xFF474747),
              ]
            : const [
                Color(0xFFF7F7F7),
                Color(0xFFEAEAEA),
              ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(24),
      border: Border.all(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.white.withValues(alpha: 0.72),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.32 : 0.12),
          blurRadius: 24,
          offset: const Offset(0, 14),
        ),
      ],
    );
  }

  BoxDecoration _sectionDecoration({required bool isDark}) {
    return BoxDecoration(
      gradient: LinearGradient(
        colors: isDark
            ? const [Color(0xFF4A4A4A), Color(0xFF404040)]
            : const [Color(0xFFF8F8F8), Color(0xFFEFEFEF)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.white.withValues(alpha: 0.85),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.22 : 0.08),
          blurRadius: 18,
          offset: const Offset(0, 10),
        ),
      ],
    );
  }

  BoxDecoration _subsectionCardDecoration({
    required bool isDark,
    Color? accent,
  }) {
    final borderAccent =
        accent ?? Colors.white.withValues(alpha: isDark ? 0.08 : 0.32);
    return BoxDecoration(
      color: isDark ? const Color(0xFF3B3B3B) : Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(
          color: borderAccent.withValues(alpha: accent != null ? 0.7 : 1)),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.16 : 0.05),
          blurRadius: 12,
          offset: const Offset(0, 6),
        ),
      ],
    );
  }

  InputDecoration _fieldDecoration({
    required String label,
    required bool isDark,
    String? hintText,
    Widget? suffixIcon,
    Color? fillColorOverride,
    Color? enabledBorderColor,
  }) {
    final fillColor = fillColorOverride ??
        (isDark ? const Color(0xFF3A3A3A) : const Color(0xFFFFFEFB));
    final borderColor = enabledBorderColor ??
        (isDark
            ? Colors.white.withValues(alpha: 0.10)
            : const Color.fromARGB(255, 214, 214, 214));

    return InputDecoration(
      labelText: label,
      hintText: hintText,
      labelStyle: TextStyle(
        color: isDark
            ? Colors.white.withValues(alpha: 0.72)
            : const Color(0xFF535353),
        fontWeight: FontWeight.w600,
      ),
      hintStyle: TextStyle(
        color: isDark
            ? Colors.white.withValues(alpha: 0.36)
            : const Color(0xFF8E8E8E),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      filled: true,
      fillColor: fillColor,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: borderColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: borderColor),
      ),
      focusedBorder: _yellowFocusedBorder(),
      suffixIcon: suffixIcon,
    );
  }

  ButtonStyle _primaryButtonStyle() {
    return ElevatedButton.styleFrom(
      backgroundColor: const Color.fromARGB(255, 192, 31, 31),
      foregroundColor: Colors.white,
      elevation: 8,
      shadowColor:
          const Color.fromARGB(255, 192, 31, 31).withValues(alpha: 0.32),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      textStyle: const TextStyle(fontWeight: FontWeight.w800),
    );
  }

  ButtonStyle _secondaryButtonStyle() {
    return ElevatedButton.styleFrom(
      backgroundColor: const Color(0xFF2F2F2F),
      foregroundColor: Colors.white,
      elevation: 0,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: _headerYellow.withValues(alpha: 0.42)),
      ),
      textStyle: const TextStyle(fontWeight: FontWeight.w700),
    );
  }

  Widget _buildMessageCard({
    required bool isDark,
    required IconData icon,
    required Color accent,
    required Color backgroundLight,
    required Color backgroundDark,
    required String text,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? backgroundDark : backgroundLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: accent, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                height: 1.3,
                color: isDark ? Colors.white : const Color(0xFF222222),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLiveImpactCard({required bool isDark}) {
    final currentOpeningClients = _currentOpeningClients;
    final hasCount = currentOpeningClients > 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: _subsectionCardDecoration(
        isDark: isDark,
        accent: const Color.fromARGB(255, 192, 31, 31),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color.fromARGB(255, 192, 31, 31)
                  .withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.groups_2_outlined,
              color: Color.fromARGB(255, 192, 31, 31),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMiniBadge(
                  icon: Icons.monitor_heart_outlined,
                  label: 'Impacto da abertura atual',
                  accent: const Color.fromARGB(255, 192, 31, 31),
                  isDark: isDark,
                ),
                const SizedBox(height: 8),
                Text(
                  hasCount
                      ? '$currentOpeningClients clientes nesta massiva'
                      : 'Nenhum cliente contabilizado ainda',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  hasCount
                      ? 'O total usa a lista limpa quando disponível e, antes disso, uma estimativa local.'
                      : 'Selecione a topologia e valide a lista limpa para acompanhar o impacto desta abertura.',
                  style: TextStyle(
                    color: isDark ? Colors.white70 : const Color(0xFF595959),
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showFeedbackSnackBar(
    String message, {
    Duration duration = const Duration(seconds: 4),
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF1F1F1F),
            fontWeight: FontWeight.w700,
          ),
        ),
        backgroundColor:
            isDark ? const Color(0xFF2F2F2F) : const Color(0xFFFFF3CD),
        behavior: SnackBarBehavior.floating,
        duration: duration,
      ),
    );
  }

  TextStyle _dialogTitleStyle({required bool isDark}) {
    return TextStyle(
      color: isDark ? Colors.white : const Color(0xFF1F1F1F),
      fontWeight: FontWeight.w800,
      fontSize: 24,
    );
  }

  TextStyle _dialogFieldTextStyle({required bool isDark}) {
    return TextStyle(
      color: isDark ? Colors.white : const Color(0xFF1F1F1F),
    );
  }

  InputDecoration _dialogSearchDecoration({
    required String hintText,
    required bool isDark,
  }) {
    return InputDecoration(
      prefixIcon: Icon(
        Icons.search,
        color: isDark ? Colors.white70 : const Color(0xFF666666),
      ),
      hintText: hintText,
      hintStyle: TextStyle(
        color: isDark ? Colors.white54 : const Color(0xFF8C8C8C),
      ),
      filled: true,
      fillColor: isDark ? const Color(0xFF3A3A3A) : Colors.white,
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.08),
        ),
      ),
      focusedBorder: _yellowFocusedBorder(),
    );
  }

  bool get _hasIncidentHeaderLottie =>
      _incidentHeaderLottieAsset.trim().isNotEmpty;

  Widget _buildIncidentSectionHeader({required bool isDark}) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile = constraints.maxWidth < 700;
        final titleBlock = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _headerYellow.withValues(alpha: isDark ? 0.18 : 0.22),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: _headerYellow.withValues(alpha: isDark ? 0.42 : 0.55),
                ),
              ),
              child: Text(
                'CENTRO DE CONTROLE',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isDark ? _headerYellow : const Color(0xFF7A5200),
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.2,
                    ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Abertura de Massiva',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.6,
                    color: isDark
                        ? Colors.white
                        : const Color.fromARGB(255, 24, 23, 23),
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              'Configure a topologia afetada e gere o protocolo com contexto operacional.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    height: 1.25,
                    color: isDark
                        ? Colors.white70
                        : const Color.fromARGB(255, 92, 92, 92),
                  ),
            ),
          ],
        );

        if (!_hasIncidentHeaderLottie) return titleBlock;

        if (isMobile) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              titleBlock,
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.center,
                child: _buildIncidentHeaderLottie(isMobile: true),
              ),
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _buildIncidentHeaderLottie(isMobile: false),
            const SizedBox(width: _incidentHeaderLottieOffsetDesktop),
            Expanded(child: titleBlock),
          ],
        );
      },
    );
  }

  Widget _buildIncidentHeaderLottie({required bool isMobile}) {
    if (!_hasIncidentHeaderLottie) return const SizedBox.shrink();
    final boxSize = isMobile ? 96.0 : 110.0;
    final scale =
        isMobile ? _incidentLottieScaleMobile : _incidentLottieScaleDesktop;
    return SizedBox(
      width: boxSize + 28,
      height: boxSize + 28,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: boxSize + 18,
            height: boxSize + 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  _headerYellow.withValues(alpha: 0.42),
                  _headerYellow.withValues(alpha: 0.10),
                  Colors.transparent,
                ],
              ),
            ),
          ),
          RepaintBoundary(
            child: Container(
              width: boxSize,
              height: boxSize,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFFFF3A1),
                    Color(0xFFFFD54F),
                    Color(0xFFFFB300),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(
                  color: const Color(0xFFFFC107),
                  width: 2.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFC107).withValues(alpha: 0.38),
                    blurRadius: 22,
                    spreadRadius: 3,
                    offset: const Offset(0, 10),
                  ),
                  BoxShadow(
                    color: Colors.white.withValues(alpha: 0.55),
                    blurRadius: 10,
                    spreadRadius: -2,
                    offset: const Offset(-2, -2),
                  ),
                ],
              ),
              child: Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.42),
                    width: 1.2,
                  ),
                ),
                child: ClipOval(
                  child: OverflowBox(
                    maxWidth: boxSize * 3,
                    maxHeight: boxSize * 3,
                    child: Transform.scale(
                      scale: scale,
                      child: Lottie.asset(
                        _incidentHeaderLottieAsset,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  OutlineInputBorder _yellowFocusedBorder() {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(
        color: _headerYellow,
        width: 1.9,
      ),
    );
  }

  Widget _buildPickerTheme({
    required BuildContext context,
    required Widget? child,
  }) {
    final base = Theme.of(context);
    final isDark = base.brightness == Brightness.dark;
    final colorScheme = base.colorScheme.copyWith(
      primary: _headerYellow,
      onPrimary: const Color(0xFF1F1F1F),
      primaryContainer: _headerYellow,
      onPrimaryContainer: const Color(0xFF1F1F1F),
      secondary: _headerYellow,
      tertiary: _headerYellow,
      surface: isDark ? const Color(0xFF2F2F2F) : const Color(0xFFFFFCF5),
      onSurface: isDark ? Colors.white : const Color(0xFF1F1F1F),
      onSurfaceVariant: isDark ? Colors.white70 : const Color(0xFF4F4F4F),
    );
    return Theme(
      data: base.copyWith(
        colorScheme: colorScheme,
        datePickerTheme: DatePickerThemeData(
          backgroundColor:
              isDark ? const Color(0xFF2F2F2F) : const Color(0xFFFFFCF5),
          surfaceTintColor: Colors.transparent,
          headerBackgroundColor:
              isDark ? const Color(0xFF3A300F) : const Color(0xFFFFE7A6),
          headerForegroundColor:
              isDark ? Colors.white : const Color(0xFF1F1F1F),
          weekdayStyle: TextStyle(
            color: isDark ? Colors.white70 : const Color(0xFF5A5A5A),
            fontWeight: FontWeight.w700,
          ),
          dayStyle: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF202020),
            fontWeight: FontWeight.w600,
          ),
          yearStyle: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF202020),
            fontWeight: FontWeight.w700,
          ),
          rangePickerBackgroundColor:
              isDark ? const Color(0xFF2F2F2F) : const Color(0xFFFFFCF5),
          cancelButtonStyle: TextButton.styleFrom(
            foregroundColor: isDark ? Colors.white70 : const Color(0xFF5A5A5A),
          ),
          confirmButtonStyle: TextButton.styleFrom(
            foregroundColor: const Color(0xFF8A5A00),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        timePickerTheme: TimePickerThemeData(
          backgroundColor:
              isDark ? const Color(0xFF2F2F2F) : const Color(0xFFFFFCF5),
          hourMinuteTextColor: isDark ? Colors.white : const Color(0xFF1F1F1F),
          hourMinuteColor:
              isDark ? _headerYellow.withValues(alpha: 0.92) : _headerYellow,
          dialHandColor: _headerYellow,
          dialTextColor: isDark ? Colors.white : const Color(0xFF1F1F1F),
          dialBackgroundColor:
              isDark ? const Color(0xFF424242) : const Color(0xFFFFF1C7),
          dayPeriodTextColor: isDark ? Colors.white : const Color(0xFF1F1F1F),
          dayPeriodColor:
              isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white,
          dayPeriodBorderSide: BorderSide(
            color: _headerYellow.withValues(alpha: isDark ? 0.28 : 0.45),
          ),
          entryModeIconColor: isDark ? Colors.white70 : const Color(0xFF5A5A5A),
          helpTextStyle: TextStyle(
            color: isDark ? Colors.white70 : const Color(0xFF5A5A5A),
            fontWeight: FontWeight.w700,
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(foregroundColor: _headerYellow),
        ),
      ),
      child: child ?? const SizedBox.shrink(),
    );
  }

  String? _requiredValidator(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Campo obrigatório';
    }
    return null;
  }
}
