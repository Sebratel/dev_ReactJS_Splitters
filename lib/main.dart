import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:nexaview/utils/web_utils.dart';

import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

import 'package:nexaview/theme.dart';
import 'package:nexaview/models/app_session_user.dart';
import 'package:nexaview/screens/home_page.dart';
import 'package:nexaview/services/auth_service.dart';
import 'package:nexaview/services/splitter_service.dart';

import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';

// Bootstrap principal da aplicacao:
// 1. inicializa dependencias globais
// 2. resolve sessao via token ou modo local
// 3. instancia servicos compartilhados
// 4. abre a HomePage com as configuracoes carregadas de env

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  debugPrint("INICIANDO SPLITTERS VIA TOKEN DO HUB");

  // =============================================================
  // 1. Firebase
  // =============================================================
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // =============================================================
  // 2. Token via URL (Web)
  // =============================================================
  final params = WebUtils.queryParams;
  final token = params['token'];

  debugPrint("Token recebido via URL");

  // =============================================================
  // 3. Ambiente local vs produ??o
  // =============================================================
  final host = Uri.base.host;

  final isLocal = host == "localhost" ||
      host == "127.0.0.1" ||
      host == "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.");

  // As permissoes de massiva ficam em env para evitar hardcode no app.
  final allowedMassivaEmails = _parseCsvEnv(
    const String.fromEnvironment('MASSIVA_ALLOWED_EMAILS', defaultValue: ''),
  );
  final allowedMassivaRoles = _parseCsvEnv(
    const String.fromEnvironment(
      'MASSIVA_ALLOWED_ROLES',
      defaultValue: 'massiva_admin,cor_massiva',
    ),
  );
  final localMassivaEnabled = const bool.fromEnvironment(
    'LOCAL_MASSIVA_ENABLED',
    defaultValue: true,
  );
  final localUserEmail = const String.fromEnvironment(
    'LOCAL_USER_EMAIL',
    defaultValue: 'dev@local',
  );
  const localUserPersonId = int.fromEnvironment(
    'LOCAL_USER_PERSON_ID',
    defaultValue: 629,
  );
  const erpClientId = String.fromEnvironment(
    'ERP_CLIENT_ID',
    defaultValue: '',
  );
  const erpClientSecret = String.fromEnvironment(
    'ERP_CLIENT_SECRET',
    defaultValue: '',
  );
  const erpSyndata = String.fromEnvironment(
    'ERP_SYNDATA',
    defaultValue: '',
  );
  const hubSessionEndpoint = String.fromEnvironment(
    'HUB_SESSION_ENDPOINT',
    defaultValue: 'https://sebratel-hub.web.app/auth/session',
  );

  var sessionUser = AppSessionUser.guest();

  if (!isLocal) {
    // Em producao o acesso depende do token enviado pelo Hub.
    final sessionResult = resolveHubSession(token);

    if (!sessionResult.isValid) {
      debugPrint("ACESSO BLOQUEADO -> ${sessionResult.reason}");

      Future.microtask(() {
        WebUtils.redirect("https://sebratel-hub.web.app");
      });
      return;
    }

    final hubProfileResult = await fetchHubSessionProfile(
      token: token!,
      endpoint: hubSessionEndpoint,
    );

    if (hubProfileResult.isUnauthorized) {
      debugPrint("ACESSO BLOQUEADO -> ${hubProfileResult.reason}");

      Future.microtask(() {
        WebUtils.redirect("https://sebratel-hub.web.app");
      });
      return;
    }

    if (hubProfileResult.payload != null) {
      sessionUser = AppSessionUser.fromHubSession(
        hubProfileResult.payload!,
        sessionToken: token,
      );
      debugPrint("SESSAO DO HUB CARREGADA VIA /auth/session");
    } else {
      sessionUser = AppSessionUser.fromJwtPayload(
        sessionResult.payload ?? const <String, dynamic>{},
        allowedEmails: allowedMassivaEmails,
        allowedRoles: allowedMassivaRoles,
        sessionToken: token,
      );
      debugPrint("SESSAO DO HUB CARREGADA EM MODO DE COMPATIBILIDADE");
    }

    debugPrint("TOKEN ACEITO - App liberado");

    // Remove o token da URL (sem reload)
    _limparTokenDaUrl();
  } else {
    // Em ambiente local criamos uma sessao tecnica para desenvolvimento.
    debugPrint("Ambiente local - valida??o de token ignorada");
    sessionUser = AppSessionUser.local(
      email: localUserEmail,
      canOpenMassiva: localMassivaEnabled,
      personId: localUserPersonId > 0 ? localUserPersonId : 629,
      sessionToken: token,
    );
  }

  // =============================================================
  // 4. Hive (cache local)
  // =============================================================
  await Hive.initFlutter();
  await SplitterService.initHive();

  // =============================================================
  // 5. Auth ERP
  // =============================================================
  final auth = AuthService(
    clientId: erpClientId,
    clientSecret: erpClientSecret,
    syndata: erpSyndata,
    grantType: "client_credentials",
    scope: "syngw",
  );

  // =============================================================
  // 6. Servi?os principais
  // =============================================================
  const reverseGeocodeEndpoint = String.fromEnvironment(
    'REVERSE_GEOCODE_ENDPOINT',
    defaultValue: '',
  );
  const geogridBaseUrl = String.fromEnvironment(
    'GEOGRID_BASE_URL',
    defaultValue: 'https://eros.geogridmaps.com.br/sebratel/api/v3',
  );
  const geogridApiKey = String.fromEnvironment(
    'GEOGRID_API_KEY',
    defaultValue: '',
  );
  const massivaApiGatewayEndpoint = String.fromEnvironment(
    'MASSIVA_API_GATEWAY_ENDPOINT',
    defaultValue: '',
  );
  const massivaAffectedUsersEndpoint = String.fromEnvironment(
    'MASSIVA_AFFECTED_USERS_ENDPOINT',
    defaultValue: '',
  );
  const massivaApiGatewayListEndpoint = String.fromEnvironment(
    'MASSIVA_API_GATEWAY_LIST_ENDPOINT',
    defaultValue: '',
  );
  const autoIspEventsEndpoint = String.fromEnvironment(
    'AUTOISP_EVENTS_ENDPOINT',
    defaultValue: '',
  );
  const autoIspAuthEndpoint = String.fromEnvironment(
    'AUTOISP_AUTH_ENDPOINT',
    defaultValue: '',
  );
  const autoIspUsername = String.fromEnvironment(
    'AUTOISP_USERNAME',
    defaultValue: '',
  );
  const autoIspPassword = String.fromEnvironment(
    'AUTOISP_PASSWORD',
    defaultValue: '',
  );
  const massivaCookieString = String.fromEnvironment(
    'MASSIVA_COOKIE_STRING',
    defaultValue: '',
  );
  const hubGoogleIdTokenEndpoint = String.fromEnvironment(
    'HUB_GOOGLE_ID_TOKEN_ENDPOINT',
    defaultValue: 'https://sebratel-hub.web.app/auth/google-id-token',
  );

  // SplitterService centraliza cache local, consumo do ERP e resolucao de ruas.
  final splitterService = SplitterService(
    auth: auth,
    splittersEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/splitter/all",
    clientesEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/connection/all",
    reverseGeocodeEndpoint:
        reverseGeocodeEndpoint.isEmpty ? null : reverseGeocodeEndpoint,
  );

  // Restaura metadados de ultima atualizacao para a HomePage abrir mais rapido.
  splitterService.restoreLastUpdatesFromHive();

  // =============================================================
  // 7. Start App
  // =============================================================
  runApp(
    MyApp(
      splitterService: splitterService,
      authService: auth,
      sessionUser: sessionUser,
      massivaApiGatewayEndpoint: massivaApiGatewayEndpoint,
      massivaAffectedUsersEndpoint: massivaAffectedUsersEndpoint,
      ellevenMassivaListEndpoint: massivaApiGatewayListEndpoint,
      autoIspEventsEndpoint: autoIspEventsEndpoint,
      autoIspAuthEndpoint: autoIspAuthEndpoint,
      autoIspUsername: autoIspUsername,
      autoIspPassword: autoIspPassword,
      massivaCookieString: massivaCookieString,
      hubGoogleIdTokenEndpoint: hubGoogleIdTokenEndpoint,
      geogridBaseUrl: geogridBaseUrl,
      geogridApiKey: geogridApiKey,
    ),
  );
}

// =============================================================
// Resolucao da sessao do Hub
// =============================================================
class HubSessionResult {
  final bool isValid;
  final String? reason;
  final Map<String, dynamic>? payload;

  const HubSessionResult(this.isValid, {this.reason, this.payload});
}

class HubSessionProfileResult {
  final bool isUnauthorized;
  final String? reason;
  final Map<String, dynamic>? payload;

  const HubSessionProfileResult({
    this.isUnauthorized = false,
    this.reason,
    this.payload,
  });
}

// Resolve a sessao recebida do Hub.
//
// Compatibilidade:
// - fluxo antigo: JWT assinado com HUB_JWT_SECRET
// - fluxo novo: sessao segura do backend do Hub, sem exigir verificacao local
HubSessionResult resolveHubSession(String? token) {
  if (token == null || token.isEmpty) {
    return const HubSessionResult(false, reason: "Token ausente");
  }

  final verifiedPayload = _tryVerifyLegacyHubJwt(token);
  if (verifiedPayload != null) {
    debugPrint("JWT do Hub validado localmente");
    return HubSessionResult(true, payload: verifiedPayload);
  }

  final decodedPayload = _tryDecodeJwtPayload(token);
  if (decodedPayload != null) {
    debugPrint("Sessao do Hub aceita sem validacao local de assinatura");
    return HubSessionResult(true, payload: decodedPayload);
  }

  debugPrint("Sessao do Hub aceita sem payload legivel no frontend");
  return const HubSessionResult(true, payload: <String, dynamic>{});
}

Future<HubSessionProfileResult> fetchHubSessionProfile({
  required String token,
  required String endpoint,
}) async {
  if (token.trim().isEmpty || endpoint.trim().isEmpty) {
    return const HubSessionProfileResult();
  }

  try {
    final response = await http.get(
      Uri.parse(endpoint),
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ).timeout(const Duration(seconds: 15));

    if (response.statusCode == 401) {
      return const HubSessionProfileResult(
        isUnauthorized: true,
        reason: 'Sessao do Hub expirada ou invalida',
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      debugPrint(
        'Falha ao consultar /auth/session no Hub: HTTP ${response.statusCode}',
      );
      return const HubSessionProfileResult();
    }

    final body = response.body.trim();
    if (body.isEmpty) {
      debugPrint('Falha ao consultar /auth/session no Hub: resposta vazia');
      return const HubSessionProfileResult();
    }

    final decoded = jsonDecode(body);
    if (decoded is Map) {
      return HubSessionProfileResult(
        payload: decoded.map((k, v) => MapEntry(k.toString(), v)),
      );
    }

    debugPrint('Falha ao consultar /auth/session no Hub: payload invalido');
  } catch (e) {
    debugPrint('Falha ao consultar /auth/session no Hub: $e');
  }

  return const HubSessionProfileResult();
}

Map<String, dynamic>? _tryVerifyLegacyHubJwt(String token) {
  try {
    const hubJwtSecret = String.fromEnvironment(
      'HUB_JWT_SECRET',
      defaultValue: '',
    );
    if (hubJwtSecret.trim().isEmpty) {
      return null;
    }

    final jwt = JWT.verify(
      token,
      SecretKey(hubJwtSecret),
    );

    final payload = jwt.payload;
    if (payload["iss"] != "sebratel-hub") {
      return null;
    }

    return payload.map((k, v) => MapEntry(k.toString(), v));
  } catch (_) {
    return null;
  }
}

Map<String, dynamic>? _tryDecodeJwtPayload(String token) {
  final parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    final normalized = base64Url.normalize(parts[1]);
    final decoded = utf8.decode(base64Url.decode(normalized));
    final json = jsonDecode(decoded);
    if (json is Map) {
      return json.map((k, v) => MapEntry(k.toString(), v));
    }
  } catch (_) {
    return null;
  }

  return null;
}

Set<String> _parseCsvEnv(String value) {
  return value
      .split(',')
      .map((it) => it.trim().toLowerCase())
      .where((it) => it.isNotEmpty)
      .toSet();
}

// Remove o token da URL depois da validacao para nao deixar credenciais
// temporarias expostas na barra do navegador.
void _limparTokenDaUrl() {
  final uri = Uri.base;

  if (uri.queryParameters.containsKey('token')) {
    final cleanUri = uri.replace(queryParameters: {});
    WebUtils.replaceUrl(cleanUri.toString());
  }
}

/// Widget raiz que propaga servicos e configuracoes para a interface.
class MyApp extends StatefulWidget {
  final AuthService authService;
  final SplitterService splitterService;
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

  const MyApp({
    super.key,
    required this.splitterService,
    required this.authService,
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
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  ThemeMode _themeMode = ThemeMode.system;

  void _toggleTheme() {
    setState(() {
      _themeMode =
          _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Splitters',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('pt', 'BR'),
        Locale('en', 'US'),
      ],
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: _themeMode,
      home: HomePage(
        onThemeToggle: _toggleTheme,
        splitterService: widget.splitterService,
        authService: widget.authService,
        sessionUser: widget.sessionUser,
        massivaApiGatewayEndpoint: widget.massivaApiGatewayEndpoint,
        massivaAffectedUsersEndpoint: widget.massivaAffectedUsersEndpoint,
        ellevenMassivaListEndpoint: widget.ellevenMassivaListEndpoint,
        autoIspEventsEndpoint: widget.autoIspEventsEndpoint,
        autoIspAuthEndpoint: widget.autoIspAuthEndpoint,
        autoIspUsername: widget.autoIspUsername,
        autoIspPassword: widget.autoIspPassword,
        massivaCookieString: widget.massivaCookieString,
        hubGoogleIdTokenEndpoint: widget.hubGoogleIdTokenEndpoint,
        geogridBaseUrl: widget.geogridBaseUrl,
        geogridApiKey: widget.geogridApiKey,
      ),
    );
  }
}