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
import 'package:nexaview/services/massiva_elleven_service.dart';
import 'package:nexaview/services/massiva_middleware_service.dart';
import 'package:nexaview/services/massiva_orchestrator_service.dart';

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

class MassivaPage extends StatefulWidget {
  final MassivaMiddlewareService middlewareService;
  final MassivaEllevenService ellevenService;
  final AutoIspEventService autoIspService;
  final AppSessionUser sessionUser;
  final List<SplitterModel> splitters;
  final List<String> cachedSplitterCodes;
  final List<ClienteModel> Function(String splitterCode) getClientesForSplitter;
  final int? Function(String oltCode) getOltIdByCode;

  const MassivaPage({
    super.key,
    required this.middlewareService,
    required this.ellevenService,
    required this.autoIspService,
    required this.sessionUser,
    required this.splitters,
    required this.cachedSplitterCodes,
    required this.getClientesForSplitter,
    required this.getOltIdByCode,
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
  static const List<(int, String)> _connectionStatusOptions = [
    (1, 'Normal'),
    (2, 'mk_bloqueio'),
    (3, 'Aviso_Bloqueio'),
    (4, 'Aviso_Manutencao'),
  ];
  static const List<(int, String)> _incidentTypeOptions = [
    (302, 'Massiva / PE Indisponibilidade'),
    (1176, 'TEC - Incidente Normal'),
  ];
  static const int _companyPlaceId = 1;
  static const String _cookieString =
      '***REMOVED*** rl_page_init_referrer=RudderEncrypt%3AU2FsdGVkX18shHkuyiRV7CzWZjTwSW9%2FEuiglHlvxA8%3D; rl_page_init_referring_domain=RudderEncrypt%3AU2FsdGVkX1%2Bx8pG8v8F2gb2%2ByGNKuYuXo23JxJUqeG8%3D; _delighted_web={%220pecjIDR7nNwMbiZ%22:{%22_delighted_fst%22:{%22t%22:%221770980939316%22}}}; rl_anonymous_id=RudderEncrypt%3AU2FsdGVkX1%2BaaozhyFDOzqFqxls57IURJuGXKLKYgKuzyupk4cI%2FBUBQkoEqWHllfpTSivKqAlZ0lnkKQRNofw%3D%3D; rl_user_id=RudderEncrypt%3AU2FsdGVkX1%2B%2FdKA5qXIzcPa2QEuXu67kR4vrsezM%2F3a0hNttwlnoH1JEDRspFeG%2BUMmYZuDZEYxhiHZLO2X37%2FnLIqJLQg9UaZ0GoUrRtYcxYJ6iqAL3VAKmT0VhxZI0UPcdUHMqGue9XwoCFrCkvhVIUnewaTXXulh3%2FTQnYko%3D; rl_trait=RudderEncrypt%3AU2FsdGVkX19pSOWKpjjq29LdPvV2WoTD4t1%2FwoD1tNV%2BfQ1ZPo8ejtGVBZKhC2ScjlhKOsCYRDSaZOUCulzV%2BB6w90OfAEwkmWjP9Kn4zhLyFtA0j%2Fj0vDAoOemw05EFwVt3am%2BEsdpgkZFM3qth8bsSoro%2FAMBd4VSiA%2F61efA%3D; rl_session=RudderEncrypt%3AU2FsdGVkX1%2B0CbhSS8fL1F4iINdDEUHoZ%2FCeB6UOSqAcyrblvGLJ6ySpoSVEHp5G%2B01M0fsX6p9EzvNfX045aVn%2B%2BkyEAyTwW621lUfwvRtzWHNXqjm8V2ezM26AKHAvewXmmoTZ160LGPHIkVhL3A%3D%3D; ph_phc_4URIAm1uYfJO7j8kWSe0J8lc8IqnstRLS7Jx8NcakHo_posthog=%7B%22%24device_id%22%3A%22c7bbbd1b1112e1079a14da35ad77c2adf71cf1fc4ee45768f33f3c7d2e5a8ffb%23e0538185-cb5e-45cb-9b58-710310e64ed8%22%2C%22distinct_id%22%3A%22c7bbbd1b1112e1079a14da35ad77c2adf71cf1fc4ee45768f33f3c7d2e5a8ffb%23e0538185-cb5e-45cb-9b58-710310e64ed8%22%2C%22%24sesid%22%3A%5B1772567128777%2C%22019cb53b-b1c6-7b58-846f-b59438991c58%22%2C1772567114179%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22%24direct%22%2C%22u%22%3A%22https%3A%2F%2Fn8n.sebratel.net.br%3A5678%2Fhome%2Fworkflows%22%7D%2C%22%24user_state%22%3A%22identified%22%7D; _hjSession_5073910=***REMOVED***; SYNSUITE=p6rphp73jfn8kt9a9dg0n4mfd4';

  final _formKey = GlobalKey<FormState>();
  final _apController = TextEditingController();
  final _slotController = TextEditingController();
  final _portController = TextEditingController();
  final _splitterController = TextEditingController();
  final _openedDateController = TextEditingController();
  final _openedTimeController = TextEditingController();
  final _closedDateController = TextEditingController();
  final _closedTimeController = TextEditingController();
  final _technicalReasonController = TextEditingController();
  final _descriptionController = TextEditingController();

  bool _forceFallback = false;
  bool _loadingPreview = false;
  bool _loadingSubmit = false;
  bool _loadingMassivas = false;
  bool _loadedMassivas = false;
  bool _loadingAutoIsp = false;
  bool _loadedAutoIsp = false;
  bool _buildingRouteCatalog = false;
  bool _routeCatalogReady = false;
  bool _requestedByFieldTechnician = false;
  List<MassivaTicket> _massivas = const [];
  List<AutoIspEvent> _autoIspEvents = const [];
  MassivaStatus? _statusFilter;
  MiddlewareFilterResponse? _lastPreview;
  String? _error;
  Timer? _autoRefreshTimer;
  DateTime? _lastDataRefreshAt;
  DateTime? _openedAt;
  DateTime? _closedAt;
  DateTime? _identifiedAt;
  int? _selectedConnectionStatusId;
  int? _selectedIncidentTypeId;
  List<String> _splitterOptions = const [];
  final Map<String, String> _splitterNameByCode = {};
  final Map<String, SplitterModel> _splitterByCode = {};
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
      if (mounted) {
        setState(() {
          _lastDataRefreshAt = DateTime.now();
        });
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
      _routeByUsername.clear();
      for (var i = 0; i < _splitterOptions.length; i++) {
        final fallbackSplitterCode = _splitterOptions[i];
        final clientes = widget.getClientesForSplitter(fallbackSplitterCode);

        for (final cliente in clientes) {
          final access = cliente.accessPoint;
          if (access == null) continue;

          final ap = access.title.trim();
          if (ap.isEmpty) continue;

          final slot = access.slotOlt;
          final port = access.portOlt;
          final splitter = cliente.splitterCode?.trim().isNotEmpty == true
              ? cliente.splitterCode!.trim()
              : fallbackSplitterCode;

          _routeCatalog
              .putIfAbsent(ap, () => {})
              .putIfAbsent(slot, () => {})
              .putIfAbsent(port, () => <String>{})
              .add(splitter);

          final normalizedUser = _normalizeAutoIspUsername(cliente.user);
          if (normalizedUser.isNotEmpty) {
            _routeByUsername.putIfAbsent(
              normalizedUser,
              () => _ResolvedAutoIspRoute(
                ap: ap,
                slot: slot,
                port: port,
                splitterCode: splitter,
                username: cliente.user.trim().isEmpty ? null : cliente.user.trim(),
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

  String _normalizeAutoIspUsername(String value) {
    return value.trim().toLowerCase();
  }

  _ResolvedAutoIspRoute? _resolveRouteByAutoIspUsername(AutoIspEvent event) {
    for (final resource in event.resources) {
      final normalized = _normalizeAutoIspUsername(resource.pppoeUsername ?? '');
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
    final routeSplitters = route.splitterCode != null &&
            route.splitterCode!.trim().isNotEmpty
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
            ? _selectedAps.first
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

  Future<void> _pickClosingDate() async {
    if (_openedAt == null) {
      setState(() {
        _error = 'Preencha primeiro a data e hora de abertura (selecione AP).';
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
        _error = 'Data/hora de fechamento nao pode ser menor que a abertura.';
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
        _error = 'Preencha primeiro a data e hora de abertura (selecione AP).';
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
        _error = 'Data/hora de fechamento nao pode ser menor que a abertura.';
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

  void _onSlotsChanged(Set<int> values) {
    _selectedSlotsByAp
      ..clear()
      ..addAll({
        for (final ap in _selectedAps) ap: Set<int>.from(values),
      });
    _rebuildSelectionSummaries();
    _clearPortSelection();
    _refreshControllerLabels();
    _syncAutoDescription();
  }

  void _onPortsChanged(Set<int> values) {
    _selectedPortsByApSlot
      ..clear()
      ..addAll({
        for (final apEntry in _selectedSlotsByAp.entries)
          apEntry.key: {
            for (final slot in apEntry.value) slot: Set<int>.from(values),
          },
      });
    _rebuildSelectionSummaries();
    _clearSplitterSelection();
    _refreshControllerLabels();
    _syncAutoDescription();
  }

  void _onSplittersChanged(Set<String> values) {
    _selectedSplittersByRoute
      ..clear()
      ..addAll({
        for (final apEntry in _selectedPortsByApSlot.entries)
          apEntry.key: {
            for (final slotEntry in apEntry.value.entries)
              slotEntry.key: {
                for (final port in slotEntry.value)
                  port: Set<String>.from(values),
              },
          },
      });
    _rebuildSelectionSummaries();
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

      lines.add('AP: $ap');
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
        ? 'tecnico em campo pedindo abertura de massiva'
        : 'evento de rompimento';
  }

  String _buildProtocolDescription() {
    final startedAt = _openedAt;
    final identifiedAt = _identifiedAt ?? DateTime.now();
    final normalizationAt = _closedAt;
    final affectedClients =
        _lastPreview?.totalAffected ?? _estimatedAffectedClients();
    final technicalReason = _technicalReasonController.text.trim().isEmpty
        ? 'Nao informado'
        : _technicalReasonController.text.trim();

    return [
      '🚨 INFORMACOES OBRIGATORIAS - ABERTURA',
      '',
      '👤 Nome do solicitante: ${_requesterName()}',
      '',
      '🛠️ Motivo tecnico: $technicalReason',
      '',
      '📣 Origem massiva: ${_buildOpeningContextText()}',
      '',
      '📍 CTOs afetadas:',
      _buildMotivoText(),
      '',
      '🧭 Topologia:',
      _buildTopologiaText(),
      '',
      '👥 Clientes afetados: $affectedClients',
      '',
      '🕒 Horario que iniciou o evento: ${startedAt != null ? DateFormat("HH:mm").format(startedAt) : "-"}',
      '',
      '⏰ Horario que o evento foi identificado: ${DateFormat("HH:mm").format(identifiedAt)}',
      '',
      '🚧 Prazo de normalizacao: ${normalizationAt != null ? DateFormat("dd/MM/yyyy HH:mm").format(normalizationAt) : "aguardando infra"}',
    ].join('\n');
  }

  void _syncAutoDescription({bool force = false}) {
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
      title: 'Selecione o AP',
      hintText: 'Buscar AP',
      source: _apOptions,
      initial: _selectedAps,
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
        _error = 'Selecione AP antes do Slot.';
      });
      return;
    }

    if (_slotOptions.isEmpty) {
      setState(() {
        _error = 'Nenhum Slot encontrado para o AP selecionado.';
      });
      return;
    }

    final selectedByAp = <String, Set<int>>{};
    final aps = _selectedAps.toList()..sort();

    for (var i = 0; i < aps.length; i++) {
      final ap = aps[i];
      final options = _slotOptionsForAp(ap);
      if (options.isEmpty) continue;

      final selected = await _selectMultiIntDialog(
        title: 'Selecione os slots do AP $ap',
        values: options,
        valueLabel: (v) => 'Slot $v',
        initial: _selectedSlotsByAp[ap] ?? const <int>{},
        applyLabel: i == aps.length - 1 ? 'Aplicar' : 'Próximo',
      );
      if (!mounted || selected == null) return;
      selectedByAp[ap] = selected;
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
        _error = 'Selecione AP e Slot antes da Porta.';
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

    for (var i = 0; i < steps.length; i++) {
      final step = steps[i];
      final options = _portOptionsForApSlot(step.$1, step.$2);
      if (options.isEmpty) continue;

      final selected = await _selectMultiIntDialog(
        title: 'Portas do AP ${step.$1} ➡️• SLOT ${step.$2} ⬅️',
        values: options,
        valueLabel: (v) => 'Porta $v',
        initial: _selectedPortsByApSlot[step.$1]?[step.$2] ?? const <int>{},
        applyLabel: i == steps.length - 1 ? 'Aplicar' : 'Próximo',
      );
      if (!mounted || selected == null) return;

      selectedByRoute.putIfAbsent(step.$1, () => {})[step.$2] = selected;
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
        _error = 'Selecione AP, Slot e Porta antes de escolher splitter.';
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

    for (var i = 0; i < steps.length; i++) {
      final step = steps[i];
      final options = _splitterOptionsForRoute(step.$1, step.$2, step.$3);
      if (options.isEmpty) continue;

      final selected = await _selectMultiSplittersDialog(
        title:
            'Splitters do AP ${step.$1} ➡️• SLOT ${step.$2} ⬅️ • PORTA ${step.$3}',
        sourceCodes: options,
        initial: _selectedSplittersByRoute[step.$1]?[step.$2]?[step.$3] ??
            const <String>{},
        applyLabel: i == steps.length - 1 ? 'Aplicar' : 'Próximo',
      );
      if (!mounted || selected == null) return;

      selectedByRoute
          .putIfAbsent(step.$1, () => {})
          .putIfAbsent(step.$2, () => {})[step.$3] = selected;
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

  Future<Set<String>?> _selectMultiSplittersDialog({
    required List<String> sourceCodes,
    required Set<String> initial,
    String title = 'Selecione o splitter',
    String applyLabel = 'Aplicar',
  }) {
    final searchController = TextEditingController();
    var filtered = List<String>.from(sourceCodes);
    final selected = Set<String>.from(initial);

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
                        hintText: 'Buscar splitter',
                        isDark: isDark,
                      ),
                      onChanged: (value) {
                        final term = value.trim().toLowerCase();
                        setStateDialog(() {
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
                    Flexible(
                      child: Container(
                        decoration: BoxDecoration(
                          color:
                              isDark ? const Color(0xFF3E3E3E) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark
                                ? Colors.white.withOpacity(0.08)
                                : Colors.black.withOpacity(0.06),
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
                                onChanged: (_) {
                                  setStateDialog(() {
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
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _headerYellow,
                    foregroundColor: const Color(0xFF1F1F1F),
                  ),
                  onPressed: () => Navigator.pop(context, selected),
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
  }) {
    final searchController = TextEditingController();
    var filtered = List<String>.from(source);
    final selected = Set<String>.from(initial);

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
                          if (term.isEmpty) {
                            filtered = List<String>.from(source);
                          } else {
                            filtered = source
                                .where((s) => s.toLowerCase().contains(term))
                                .toList();
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    Flexible(
                      child: Container(
                        decoration: BoxDecoration(
                          color:
                              isDark ? const Color(0xFF3E3E3E) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark
                                ? Colors.white.withOpacity(0.08)
                                : Colors.black.withOpacity(0.06),
                          ),
                        ),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final item = filtered[index];
                            return ListTile(
                              dense: true,
                              textColor: isDark ? Colors.white : Colors.black87,
                              leading: Checkbox(
                                value: selected.contains(item),
                                activeColor: _headerYellow,
                                checkColor: const Color(0xFF1F1F1F),
                                onChanged: (_) {
                                  setStateDialog(() {
                                    if (selected.contains(item)) {
                                      selected.remove(item);
                                    } else {
                                      selected.add(item);
                                    }
                                  });
                                },
                              ),
                              title: Text(
                                item,
                                style: TextStyle(
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              onTap: () {
                                setStateDialog(() {
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
                  onPressed: () => Navigator.pop(context, selected),
                  child: Text(applyLabel),
                ),
              ],
            );
          },
        );
      },
    ).whenComplete(searchController.dispose);
  }

  Future<Set<int>?> _selectMultiIntDialog({
    required String title,
    required List<int> values,
    required String Function(int value) valueLabel,
    required Set<int> initial,
    String applyLabel = 'Aplicar',
  }) {
    final selected = Set<int>.from(initial);
    return showDialog<Set<int>>(
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
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF3E3E3E) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark
                          ? Colors.white.withOpacity(0.08)
                          : Colors.black.withOpacity(0.06),
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
                          onChanged: (_) {
                            setStateDialog(() {
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
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _headerYellow,
                    foregroundColor: const Color(0xFF1F1F1F),
                  ),
                  onPressed: () => Navigator.pop(context, selected),
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

  MassivaIncidentRequest _buildRequest() {
    final startedAt = _openedAt ?? DateTime.now();
    final closedAt = _closedAt ?? startedAt;
    final slots = _selectedSlots.toList()..sort();
    final ports = _selectedPorts.toList()..sort();

    return MassivaIncidentRequest(
      startDate: DateFormat('dd/MM/yyyy').format(startedAt),
      startTime: DateFormat('HH:mm').format(startedAt),
      accessPointIds: _resolveAccessPointIds(),
      slotOlt: slots,
      portaOlt: ports,
      addressListId: [_selectedConnectionStatusId!],
      companyPlaceId: _companyPlaceId,
      assignmentTypeId: _selectedIncidentTypeId!,
      assignmentDescription: _descriptionController.text.trim(),
      maintenanceDate: DateFormat('dd/MM/yyyy').format(closedAt),
      maintenanceTime: DateFormat('HH:mm').format(closedAt),
      cookieString: _cookieString,
    );
  }

  Future<void> _preview() async {
    if (!_formKey.currentState!.validate() || !_validateNetworkSelection())
      return;

    if (!widget.middlewareService.isConfigured) {
      setState(() {
        _error =
            'Configure MIDDLEWARE_MASSIVA_BASE_URL para habilitar validação granular.';
      });
      return;
    }

    setState(() {
      _loadingPreview = true;
      _error = null;
    });

    try {
      final filtered =
          await widget.middlewareService.filterAffectedClients(_buildRequest());

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
    if (!_formKey.currentState!.validate() || !_validateNetworkSelection()) {
      return;
    }

    if (!widget.ellevenService.isConfigured) {
      setState(() {
        _error = 'Configure ELLEVEN_MASSIVA_ENDPOINT.';
      });
      return;
    }

    setState(() {
      _loadingSubmit = true;
      _error = null;
    });

    try {
      final request = _buildRequest();

      if (widget.middlewareService.isConfigured) {
        final orchestrator = MassivaOrchestratorService(
          middlewareService: widget.middlewareService,
          ellevenService: widget.ellevenService,
        );
        final result = await orchestrator.execute(
          request: request,
          forceIndividualFallback: _forceFallback,
        );

        if (!mounted) return;

        final protocolText = result.elleven.protocol != null
            ? 'Protocolo ${result.elleven.protocol}'
            : 'Sem protocolo único retornado';

        final fallbackText = result.usedFallback
            ? 'Fallback individual ativado.'
            : 'Abertura massiva padrão.';

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '$protocolText | ${result.filtered.totalAffected} clientes. $fallbackText',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );

        setState(() => _lastPreview = result.filtered);
      } else {
        final response = await widget.ellevenService.openMassiva(
          incident: request,
          authenticationIds: const [],
          individualTickets: _forceFallback,
        );

        if (!mounted) return;

        final protocolText = response.protocol != null
            ? 'Protocolo ${response.protocol}'
            : 'Massiva criada (sem protocolo no retorno)';

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(protocolText),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }

      await _loadMassivas();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loadingSubmit = false);
      }
    }
  }

  bool _validateNetworkSelection() {
    if (_selectedAps.isEmpty ||
        _selectedSlots.isEmpty ||
        _selectedPorts.isEmpty) {
      setState(() {
        _error = 'Selecione AP, Slot e Porta antes de continuar.';
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
        _error = 'Informe data e hora de fechamento (prazo).';
      });
      return false;
    }

    if (_selectedConnectionStatusId == null) {
      setState(() {
        _error = 'Selecione o Status de Conexão.';
      });
      return false;
    }

    if (_selectedIncidentTypeId == null) {
      setState(() {
        _error = 'Selecione o Tipo de solicitacao.';
      });
      return false;
    }

    if (_closedAt == null) {
      setState(() {
        _error = 'Informe data e hora de fechamento (prazo).';
      });
      return false;
    }

    if (_isClosingBeforeOpening(_closedAt!)) {
      setState(() {
        _error = 'Data/hora de fechamento nao pode ser menor que a abertura.';
      });
      return false;
    }

    return true;
  }

  Future<void> _loadMassivas() async {
    if (!widget.ellevenService.isListConfigured) {
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
      final rows = await widget.ellevenService.fetchMassivas();
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

  Future<void> _loadAutoIspEvents() async {
    if (!widget.autoIspService.isConfigured) {
      if (mounted) {
        setState(() => _loadedAutoIsp = true);
      }
      return;
    }

    setState(() => _loadingAutoIsp = true);

    try {
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
        _openedDateController.text = DateFormat('dd/MM/yyyy').format(eventStart);
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

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          resolvedRoute?.username != null
              ? 'Evento aplicado com topologia resolvida pelo PPPoE.'
              : resolvedRoute != null
                  ? 'Evento aplicado com topologia resolvida pelo PON.'
                  : 'Dados base do evento aplicados no formulário.',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  List<MassivaTicket> get _filteredMassivas {
    if (_statusFilter == null) return _massivas;
    return _massivas.where((m) => m.status == _statusFilter).toList();
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '-';
    return DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal());
  }

  String _formatDuration(Duration value) {
    final hours = value.inHours;
    final minutes = value.inMinutes.remainder(60);
    return '${hours}h ${minutes}m';
  }

  Future<void> _exportCsv() async {
    final rows = _filteredMassivas;
    if (rows.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sem dados para exportar.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final buffer = StringBuffer();
    buffer.writeln(
      'protocol,title,status,ap,splitter,affected_clients,opened_at,closed_at,fallback',
    );

    for (final item in rows) {
      final status = item.isOpen
          ? 'aberta'
          : item.isClosed
              ? 'encerrada'
              : 'desconhecida';
      buffer.writeln(
        '${item.protocol},"${item.title.replaceAll('"', "'")}",$status,'
        '"${item.apCode}","${item.splitterCode}",${item.affectedClients},'
        '"${item.openedAt?.toIso8601String() ?? ''}","${item.closedAt?.toIso8601String() ?? ''}",${item.usedFallback}',
      );
    }

    await Clipboard.setData(ClipboardData(text: buffer.toString()));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('CSV copiado para a área de transferência.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  List<int> _trendOpenedByDay({int days = 7}) {
    final now = DateTime.now();
    final counts = List<int>.filled(days, 0);

    for (final ticket in _massivas) {
      final opened = ticket.openedAt;
      if (opened == null) continue;
      final openedDay = DateTime(opened.year, opened.month, opened.day);
      final nowDay = DateTime(now.year, now.month, now.day);
      final diff = nowDay.difference(openedDay).inDays;
      if (diff >= 0 && diff < days) {
        counts[days - 1 - diff] = counts[days - 1 - diff] + 1;
      }
    }

    return counts;
  }

  int _slaBreaches({Duration sla = const Duration(hours: 4)}) {
    final now = DateTime.now();
    var count = 0;
    for (final item in _massivas.where((m) => m.isOpen)) {
      final opened = item.openedAt;
      if (opened == null) continue;
      if (now.difference(opened) > sla) count++;
    }
    return count;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1180),
                      child: Container(
                        padding: const EdgeInsets.all(18),
                        decoration: _panelDecoration(isDark: isDark),
                        child: RepaintBoundary(
                          child: Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildIncidentSectionHeader(isDark: isDark),
                                const SizedBox(height: 0),
                                LayoutBuilder(
                                  builder: (context, constraints) {
                                    final isMobile = constraints.maxWidth < 700;
                                    final openCloseWidth =
                                        isMobile ? 270.0 : 160.0;
                                    return Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Wrap(
                                          spacing: 12,
                                          runSpacing: 12,
                                          children: [
                                            _buildReadOnlyField(
                                              controller: _openedDateController,
                                              label: 'Data de abertura',
                                              isDark: isDark,
                                              width: openCloseWidth,
                                              locked: true,
                                            ),
                                            _buildReadOnlyField(
                                              controller: _openedTimeController,
                                              label: 'Hora de abertura',
                                              isDark: isDark,
                                              width: openCloseWidth,
                                              locked: true,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 16),
                                        Wrap(
                                          spacing: 12,
                                          runSpacing: 14,
                                          children: [
                                            _buildApPickerField(
                                              isDark: isDark,
                                              width: 270,
                                            ),
                                            _buildSlotPickerField(
                                              isDark: isDark,
                                              width: 270,
                                            ),
                                            _buildPortPickerField(
                                              isDark: isDark,
                                              width: 270,
                                            ),
                                            _buildSplitterPickerField(
                                              isDark: isDark,
                                              width: 290,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 16),
                                        Wrap(
                                          spacing: 12,
                                          runSpacing: 12,
                                          children: [
                                            SizedBox(
                                              width: 270,
                                              child:
                                                  DropdownButtonFormField<int>(
                                                value:
                                                    _selectedConnectionStatusId,
                                                isExpanded: true,
                                                decoration: _fieldDecoration(
                                                  label: 'Status de Conexão',
                                                  isDark: isDark,
                                                ),
                                                style: TextStyle(
                                                  color: isDark
                                                      ? Colors.white
                                                      : const Color.fromARGB(
                                                          255, 24, 23, 23),
                                                ),
                                                dropdownColor: isDark
                                                    ? const Color.fromARGB(
                                                        255, 58, 58, 58)
                                                    : Colors.white,
                                                items: _connectionStatusOptions
                                                    .map(
                                                      (item) =>
                                                          DropdownMenuItem<int>(
                                                        value: item.$1,
                                                        child: Text(item.$2),
                                                      ),
                                                    )
                                                    .toList(),
                                                onChanged: (value) {
                                                  setState(() =>
                                                      _selectedConnectionStatusId =
                                                          value);
                                                },
                                                validator: (value) {
                                                  if (value == null) {
                                                    return 'Campo obrigatório';
                                                  }
                                                  return null;
                                                },
                                              ),
                                            ),
                                            SizedBox(
                                              width: 270,
                                              child:
                                                  DropdownButtonFormField<int>(
                                                value: _selectedIncidentTypeId,
                                                isExpanded: true,
                                                decoration: _fieldDecoration(
                                                  label: 'Tipo de solicitação',
                                                  isDark: isDark,
                                                ),
                                                style: TextStyle(
                                                  color: isDark
                                                      ? Colors.white
                                                      : const Color.fromARGB(
                                                          255, 24, 23, 23),
                                                ),
                                                dropdownColor: isDark
                                                    ? const Color.fromARGB(
                                                        255, 58, 58, 58)
                                                    : Colors.white,
                                                items: _incidentTypeOptions
                                                    .map(
                                                      (item) =>
                                                          DropdownMenuItem<int>(
                                                        value: item.$1,
                                                        child: Text(item.$2),
                                                      ),
                                                    )
                                                    .toList(),
                                                onChanged: (value) {
                                                  setState(() =>
                                                      _selectedIncidentTypeId =
                                                          value);
                                                },
                                                validator: (value) {
                                                  if (value == null) {
                                                    return 'Campo obrigatório';
                                                  }
                                                  return null;
                                                },
                                              ),
                                            ),
                                            _buildPickerField(
                                              controller: _closedDateController,
                                              label: 'Data de fechamento',
                                              isDark: isDark,
                                              width: 270,
                                              onTap: _pickClosingDate,
                                            ),
                                            _buildPickerField(
                                              controller: _closedTimeController,
                                              label: 'Hora de fechamento',
                                              isDark: isDark,
                                              width: 270,
                                              onTap: _pickClosingTime,
                                            ),
                                          ],
                                        ),
                                      ],
                                    );
                                  },
                                ),
                                const SizedBox(height: 26),
                                _buildTextField(
                                  controller: _technicalReasonController,
                                  label: 'Motivo técnico',
                                  isDark: isDark,
                                  requiredField: false,
                                  width: 360,
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? Colors.white.withOpacity(0.04)
                                        : Colors.white.withOpacity(0.7),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: isDark
                                          ? Colors.white.withOpacity(0.08)
                                          : Colors.black.withOpacity(0.05),
                                    ),
                                  ),
                                  child: CheckboxListTile(
                                    value: _requestedByFieldTechnician,
                                    contentPadding: EdgeInsets.zero,
                                    controlAffinity:
                                        ListTileControlAffinity.leading,
                                    activeColor:
                                        const Color.fromARGB(255, 192, 31, 31),
                                    checkboxShape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    title: Text(
                                      'Técnico em campo solicitando abertura',
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white
                                            : const Color.fromARGB(
                                                255, 24, 23, 23),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    subtitle: Text(
                                      'Alterna a origem da massiva entre técnico em campo e evento de rompimento.',
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white70
                                            : Colors.black54,
                                      ),
                                    ),
                                    onChanged: (value) {
                                      setState(() {
                                        _requestedByFieldTechnician =
                                            value ?? false;
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
                                    label: const Text(
                                      'Gerar descricao automatica',
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                TextFormField(
                                  controller: _descriptionController,
                                  maxLines: 10,
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
                                const SizedBox(height: 16),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? Colors.white.withOpacity(0.04)
                                        : Colors.white.withOpacity(0.7),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: isDark
                                          ? Colors.white.withOpacity(0.08)
                                          : Colors.black.withOpacity(0.05),
                                    ),
                                  ),
                                  child: SwitchListTile(
                                    title: Text(
                                      'Forçar fallback (bulk individual)',
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white
                                            : const Color.fromARGB(
                                                255, 24, 23, 23),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    subtitle: Text(
                                      'Usa abertura individual quando a massiva padrão não for desejada.',
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white70
                                            : Colors.black54,
                                      ),
                                    ),
                                    activeThumbColor:
                                        const Color.fromARGB(255, 192, 31, 31),
                                    activeTrackColor:
                                        _headerYellow.withOpacity(0.4),
                                    value: _forceFallback,
                                    contentPadding: EdgeInsets.zero,
                                    onChanged: (value) {
                                      setState(() => _forceFallback = value);
                                    },
                                  ),
                                ),
                                const SizedBox(height: 12),
                                _buildLiveImpactCard(isDark: isDark),
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 10,
                                  runSpacing: 12,
                                  children: [
                                    ElevatedButton.icon(
                                      style: _secondaryButtonStyle(),
                                      onPressed:
                                          _loadingPreview ? null : _preview,
                                      icon: _loadingPreview
                                          ? const SizedBox(
                                              width: 16,
                                              height: 16,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: Colors.white,
                                              ),
                                            )
                                          : const Icon(
                                              Icons.fact_check_outlined),
                                      label: const Text('Validar Lista Limpa'),
                                    ),
                                    ElevatedButton.icon(
                                      style: _primaryButtonStyle(),
                                      onPressed:
                                          _loadingSubmit ? null : _openMassiva,
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
                                        'Lista limpa: ${_lastPreview!.totalAffected} clientes | CorrelationId: ${_lastPreview!.correlationId}',
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
                                const SizedBox(height: 22),
                                RepaintBoundary(
                                  child: _buildAutoIspSection(isDark),
                                ),
                                const SizedBox(height: 22),
                                RepaintBoundary(
                                  child:
                                      _buildMassivasMonitoringSection(isDark),
                                ),
                              ],
                            ),
                          ),
                        ),
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

  Widget _buildMassivasMonitoringSection(bool isDark) {
    final massivasView = _filteredMassivas;
    final openCount =
        _massivas.where((m) => m.status == MassivaStatus.aberta).length;
    final activeImpactedClients = _massivas
        .where((m) => m.status == MassivaStatus.aberta)
        .fold<int>(0, (sum, item) => sum + item.affectedClients);
    final closedCount =
        _massivas.where((m) => m.status == MassivaStatus.encerrada).length;
    final totalClients =
        _massivas.fold<int>(0, (sum, item) => sum + item.affectedClients);
    final closedDurations =
        _massivas.map((m) => m.resolutionTime).whereType<Duration>().toList();
    final avgDuration = closedDurations.isEmpty
        ? null
        : Duration(
            seconds: closedDurations
                    .map((d) => d.inSeconds)
                    .reduce((a, b) => a + b) ~/
                closedDurations.length,
          );
    final slaBreaches = _slaBreaches();
    final trend = _trendOpenedByDay(days: 7);
    final topSplitters = <String, int>{};
    for (final item in _massivas) {
      final key = item.splitterCode.trim().isEmpty ? '-' : item.splitterCode;
      topSplitters[key] = (topSplitters[key] ?? 0) + 1;
    }
    final topRanking = topSplitters.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _sectionDecoration(isDark: isDark),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 700;
              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Acompanhamento de Massivas',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: isDark
                                ? Colors.white
                                : const Color.fromARGB(255, 24, 23, 23),
                          ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        IconButton(
                          tooltip: 'Atualizar',
                          onPressed: _loadingMassivas ? null : _runAutoRefresh,
                          icon: _loadingMassivas
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.refresh),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _exportCsv,
                            style: _primaryButtonStyle(),
                            icon: const Icon(Icons.download_outlined),
                            label: const Text('Exportar CSV'),
                          ),
                        ),
                      ],
                    ),
                  ],
                );
              }

              return Row(
                children: [
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
                  ),
                  IconButton(
                    tooltip: 'Atualizar',
                    onPressed: _loadingMassivas ? null : _loadMassivas,
                    icon: _loadingMassivas
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh),
                  ),
                  const SizedBox(width: 6),
                  ElevatedButton.icon(
                    onPressed: _exportCsv,
                    style: _primaryButtonStyle(),
                    icon: const Icon(Icons.download_outlined),
                    label: const Text('Exportar CSV'),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 10),
          if (!widget.ellevenService.isListConfigured)
            _buildMessageCard(
              isDark: isDark,
              icon: Icons.settings_ethernet_outlined,
              accent: const Color(0xFFEF6C00),
              backgroundLight: const Color(0xFFFFF8E1),
              backgroundDark: const Color(0xFF2E2E2E),
              text:
                  'Configure ELLEVEN_MASSIVA_LIST_ENDPOINT para habilitar monitoramento.',
            )
          else ...[
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final cardWidth =
                    width >= 1100 ? (width - 48) / 5 : (width - 12) / 2;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _kpiCard(
                      title: 'Impactados Agora',
                      value: NumberFormat.decimalPattern('pt_BR')
                          .format(activeImpactedClients),
                      isDark: isDark,
                      width: cardWidth,
                    ),
                    _kpiCard(
                      title: 'Abertas',
                      value: openCount.toString(),
                      isDark: isDark,
                      width: cardWidth,
                    ),
                    _kpiCard(
                      title: 'Encerradas',
                      value: closedCount.toString(),
                      isDark: isDark,
                      width: cardWidth,
                    ),
                    _kpiCard(
                      title: 'Clientes Impactados',
                      value: NumberFormat.decimalPattern('pt_BR')
                          .format(totalClients),
                      isDark: isDark,
                      width: cardWidth,
                    ),
                    _kpiCard(
                      title: 'Tempo Medio Encerramento',
                      value: avgDuration == null
                          ? '-'
                          : _formatDuration(avgDuration),
                      isDark: isDark,
                      width: cardWidth,
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 760;
                final children = [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: _subsectionCardDecoration(isDark: isDark),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildMiniBadge(
                          icon: Icons.timer_outlined,
                          label: 'SLA operacional',
                          accent: const Color.fromARGB(255, 192, 31, 31),
                          isDark: isDark,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '$slaBreaches em atraso',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontWeight: FontWeight.w800,
                            fontSize: 22,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Incidentes abertos acima de 4 horas.',
                          style: TextStyle(
                            color: isDark ? Colors.white70 : Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: _subsectionCardDecoration(isDark: isDark),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildMiniBadge(
                          icon: Icons.insights_outlined,
                          label: 'Tendência',
                          accent: _headerYellow,
                          isDark: isDark,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Aberturas nos últimos 7 dias',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        _TrendBars(values: trend, isDark: isDark),
                      ],
                    ),
                  ),
                ];

                if (compact) {
                  return Column(
                    children: [
                      children[0],
                      const SizedBox(height: 12),
                      children[1],
                    ],
                  );
                }

                return Row(
                  children: [
                    Expanded(child: children[0]),
                    const SizedBox(width: 12),
                    Expanded(child: children[1]),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _filterChip(
                  label: 'Todas',
                  isDark: isDark,
                  selected: _statusFilter == null,
                  onTap: () => setState(() => _statusFilter = null),
                ),
                _filterChip(
                  label: 'Em aberto',
                  isDark: isDark,
                  selected: _statusFilter == MassivaStatus.aberta,
                  onTap: () =>
                      setState(() => _statusFilter = MassivaStatus.aberta),
                ),
                _filterChip(
                  label: 'Encerradas',
                  isDark: isDark,
                  selected: _statusFilter == MassivaStatus.encerrada,
                  onTap: () =>
                      setState(() => _statusFilter = MassivaStatus.encerrada),
                ),
              ],
            ),
            if (_lastDataRefreshAt != null)
              Padding(
                padding: const EdgeInsets.only(top: 2, bottom: 8),
                child: Text(
                  'Última atualização: ${DateFormat('dd/MM/yyyy HH:mm:ss').format(_lastDataRefreshAt!)}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
              ),
            const SizedBox(height: 10),
            if (topRanking.isNotEmpty)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: _subsectionCardDecoration(isDark: isDark),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildMiniBadge(
                      icon: Icons.workspace_premium_outlined,
                      label: 'Top recorrência',
                      accent: const Color.fromARGB(255, 192, 31, 31),
                      isDark: isDark,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      topRanking
                          .take(3)
                          .map((e) => '${e.key} (${e.value})')
                          .join(' | '),
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            if (_loadingMassivas && !_loadedMassivas)
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
                text: 'Nenhuma massiva encontrada para o filtro.',
              )
            else
              ...massivasView
                  .take(25)
                  .map((item) => _massivaRow(item: item, isDark: isDark)),
          ],
        ],
      ),
    );
  }

  Widget _buildAutoIspSection(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _sectionDecoration(isDark: isDark),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
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
              ),
              IconButton(
                tooltip: 'Atualizar eventos',
                onPressed: _loadingAutoIsp ? null : _loadAutoIspEvents,
                icon: _loadingAutoIsp
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
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
      ),
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
                  color: badgeColor.withOpacity(0.18),
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
              color: isDark ? Colors.white70 : Colors.black54,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'PONs: $ponText',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _kpiCard({
    required String title,
    required String value,
    required bool isDark,
    required double width,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: _subsectionCardDecoration(
        isDark: isDark,
        accent: const Color.fromARGB(255, 192, 31, 31),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Color.fromARGB(255, 192, 31, 31),
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
        color: accent.withOpacity(isDark ? 0.16 : 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: accent),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: isDark ? accent : accent.withOpacity(0.95),
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
          ? Colors.white.withOpacity(0.08)
          : Colors.white.withOpacity(0.72),
      side: BorderSide(
        color: selected
            ? const Color.fromARGB(255, 192, 31, 31)
            : isDark
                ? Colors.white.withOpacity(0.08)
                : Colors.black.withOpacity(0.08),
      ),
      labelStyle: TextStyle(
        color: selected
            ? Colors.white
            : isDark
                ? Colors.white70
                : null,
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

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: _subsectionCardDecoration(isDark: isDark),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.18),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              item.isOpen
                  ? 'ABERTA'
                  : item.isClosed
                      ? 'ENCERRADA'
                      : 'N/D',
              style: TextStyle(
                color: statusColor,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '#${item.protocol} - ${item.title}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'AP: ${item.apCode.isEmpty ? "-" : item.apCode} | '
                  'Splitter: ${item.splitterCode.isEmpty ? "-" : item.splitterCode} | '
                  'Impactados: ${item.affectedClients}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Abertura: ${_formatDate(item.openedAt)} | Fechamento: ${_formatDate(item.closedAt)}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white60 : Colors.black54,
                  ),
                ),
              ],
            ),
          ),
          if (item.usedFallback)
            const Tooltip(
              message: 'Aberta com fallback individual',
              child: Icon(Icons.alt_route,
                  color: Color.fromARGB(255, 192, 31, 31)),
            ),
        ],
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(32),
        bottomRight: Radius.circular(32),
      ),
      child: SizedBox(
        height: 160,
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
                    const Color.fromARGB(255, 255, 174, 0).withOpacity(0.35),
                    const Color.fromARGB(255, 255, 174, 0).withOpacity(0.35),
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
                                ? Colors.white.withOpacity(0.5)
                                : Colors.black.withOpacity(0.5),
                            boxShadow: [
                              BoxShadow(
                                color: (isDark
                                        ? const Color.fromARGB(
                                            255, 253, 179, 18)
                                        : Colors.orange)
                                    .withOpacity(0.8),
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
                                  color: Colors.black.withOpacity(0.3),
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
                        color: Colors.white.withOpacity(0.95),
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
          suffixIcon: const Icon(Icons.event_outlined),
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
          label: 'AP',
          isDark: isDark,
          suffixIcon: _buildFieldSuffix(
            isDark: isDark,
            selected: isSelected,
            onTap: _pickAp,
            actionTooltip: 'Buscar AP',
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
          label: 'Porta',
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
            icon: const Icon(Icons.search),
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
            ? Colors.white.withOpacity(0.06)
            : Colors.white.withOpacity(0.72),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(isDark ? 0.32 : 0.12),
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
            ? Colors.white.withOpacity(0.06)
            : Colors.white.withOpacity(0.85),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(isDark ? 0.22 : 0.08),
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
        accent ?? Colors.white.withOpacity(isDark ? 0.08 : 0.32);
    return BoxDecoration(
      color: isDark ? const Color(0xFF3B3B3B) : Colors.white,
      borderRadius: BorderRadius.circular(14),
      border:
          Border.all(color: borderAccent.withOpacity(accent != null ? 0.7 : 1)),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(isDark ? 0.16 : 0.05),
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
            ? Colors.white.withOpacity(0.10)
            : const Color.fromARGB(255, 214, 214, 214));

    return InputDecoration(
      labelText: label,
      hintText: hintText,
      labelStyle: TextStyle(
        color: isDark
            ? Colors.white.withOpacity(0.72)
            : const Color.fromARGB(255, 88, 88, 88),
        fontWeight: FontWeight.w600,
      ),
      hintStyle: TextStyle(
        color: isDark
            ? Colors.white.withOpacity(0.36)
            : const Color.fromARGB(255, 155, 155, 155),
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
      shadowColor: const Color.fromARGB(255, 192, 31, 31).withOpacity(0.32),
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
        side: BorderSide(color: _headerYellow.withOpacity(0.42)),
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
        border: Border.all(color: accent.withOpacity(0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: accent.withOpacity(0.14),
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
              color: const Color.fromARGB(255, 192, 31, 31).withOpacity(0.14),
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
                    color: isDark ? Colors.white70 : Colors.black54,
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
        color: isDark ? Colors.white70 : Colors.black54,
      ),
      hintText: hintText,
      hintStyle: TextStyle(
        color: isDark ? Colors.white54 : Colors.black45,
      ),
      filled: true,
      fillColor: isDark ? const Color(0xFF3A3A3A) : Colors.white,
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: isDark
              ? Colors.white.withOpacity(0.08)
              : Colors.black.withOpacity(0.08),
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
                color: _headerYellow.withOpacity(isDark ? 0.18 : 0.22),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: _headerYellow.withOpacity(isDark ? 0.42 : 0.55),
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
                  _headerYellow.withOpacity(0.42),
                  _headerYellow.withOpacity(0.10),
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
                    color: const Color(0xFFFFC107).withOpacity(0.38),
                    blurRadius: 22,
                    spreadRadius: 3,
                    offset: const Offset(0, 10),
                  ),
                  BoxShadow(
                    color: Colors.white.withOpacity(0.55),
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
                    color: Colors.white.withOpacity(0.42),
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
    final colorScheme = base.colorScheme.copyWith(
      primary: _headerYellow,
      onPrimary: const Color(0xFF1F1F1F),
      primaryContainer: _headerYellow,
      onPrimaryContainer: const Color(0xFF1F1F1F),
      secondary: _headerYellow,
      tertiary: _headerYellow,
    );
    return Theme(
      data: base.copyWith(
        colorScheme: colorScheme,
        timePickerTheme: TimePickerThemeData(
          dialHandColor: _headerYellow,
          dialTextColor: base.brightness == Brightness.dark
              ? Colors.white
              : const Color(0xFF1F1F1F),
          hourMinuteTextColor: const Color(0xFF1F1F1F),
          hourMinuteColor: _headerYellow,
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

class _TrendBars extends StatelessWidget {
  final List<int> values;
  final bool isDark;

  const _TrendBars({
    required this.values,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final maxValue =
        values.isEmpty ? 1 : values.reduce((a, b) => a > b ? a : b);
    final today = DateTime.now();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(values.length, (index) {
        final value = values[index];
        final ratio = maxValue == 0 ? 0.0 : value / maxValue;
        final date = today.subtract(Duration(days: values.length - 1 - index));
        final label = DateFormat('dd/MM').format(date);

        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value.toString(),
                  style: TextStyle(
                    fontSize: 10,
                    color: isDark ? Colors.white70 : Colors.black87,
                  ),
                ),
                const SizedBox(height: 3),
                Container(
                  height: 52,
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    height: 8 + (44 * ratio),
                    decoration: BoxDecoration(
                      color: const Color.fromARGB(255, 192, 31, 31),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 9,
                    color: isDark ? Colors.white60 : Colors.black54,
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}
