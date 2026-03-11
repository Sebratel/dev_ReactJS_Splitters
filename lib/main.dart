import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:nexaview/utils/web_utils.dart';

import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

import 'package:nexaview/theme.dart';
import 'package:nexaview/models/app_session_user.dart';
import 'package:nexaview/screens/home_page.dart';
import 'package:nexaview/services/auth_service.dart';
import 'package:nexaview/services/splitter_service.dart';

import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';

// Import exclusivo para web (limpar URL)

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

  var sessionUser = AppSessionUser.guest();

  if (!isLocal) {
    final tokenResult = validateToken(token);

    if (!tokenResult.isValid) {
      debugPrint("ACESSO BLOQUEADO -> ${tokenResult.reason}");

      Future.microtask(() {
        WebUtils.redirect("https://sebratel-hub.web.app");
      });
      return;
    }

    sessionUser = AppSessionUser.fromJwtPayload(
      tokenResult.payload ?? const <String, dynamic>{},
      allowedEmails: allowedMassivaEmails,
      allowedRoles: allowedMassivaRoles,
    );

    debugPrint("TOKEN ACEITO - App liberado");

    // Remove o token da URL (sem reload)
    _limparTokenDaUrl();
  } else {
    debugPrint("Ambiente local - valida??o de token ignorada");
    sessionUser = AppSessionUser.local(
      email: localUserEmail,
      canOpenMassiva: localMassivaEnabled,
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
  const middlewareMassivaBaseUrl = String.fromEnvironment(
    'MIDDLEWARE_MASSIVA_BASE_URL',
    defaultValue: '',
  );
  const ellevenMassivaEndpoint = String.fromEnvironment(
    'ELLEVEN_MASSIVA_ENDPOINT',
    defaultValue: '',
  );
  const ellevenMassivaListEndpoint = String.fromEnvironment(
    'ELLEVEN_MASSIVA_LIST_ENDPOINT',
    defaultValue: '',
  );
  const ellevenMassivaListBearerToken = String.fromEnvironment(
    'ELLEVEN_MASSIVA_LIST_BEARER',
    defaultValue: '',
  );
  const ellevenMassivaListHeaderName = String.fromEnvironment(
    'ELLEVEN_MASSIVA_LIST_HEADER_NAME',
    defaultValue: '',
  );
  const ellevenMassivaListHeaderValue = String.fromEnvironment(
    'ELLEVEN_MASSIVA_LIST_HEADER_VALUE',
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

  final splitterService = SplitterService(
    auth: auth,
    splittersEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/splitter/all",
    clientesEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/connection/all",
    reverseGeocodeEndpoint:
        reverseGeocodeEndpoint.isEmpty ? null : reverseGeocodeEndpoint,
  );

// RESTAURA METADADOS PERSISTIDOS
  splitterService.restoreLastUpdatesFromHive();

  // =============================================================
  // 7. Start App
  // =============================================================
  runApp(
    MyApp(
      splitterService: splitterService,
      authService: auth,
      sessionUser: sessionUser,
      middlewareMassivaBaseUrl: middlewareMassivaBaseUrl,
      ellevenMassivaEndpoint: ellevenMassivaEndpoint,
      ellevenMassivaListEndpoint: ellevenMassivaListEndpoint,
      ellevenMassivaListBearerToken: ellevenMassivaListBearerToken,
      ellevenMassivaListHeaderName: ellevenMassivaListHeaderName,
      ellevenMassivaListHeaderValue: ellevenMassivaListHeaderValue,
        autoIspEventsEndpoint: autoIspEventsEndpoint,
        autoIspAuthEndpoint: autoIspAuthEndpoint,
        autoIspUsername: autoIspUsername,
        autoIspPassword: autoIspPassword,
        massivaCookieString: massivaCookieString,
      ),
    );
}

// =============================================================
// Valida??o do Token JWT
// =============================================================
class TokenValidationResult {
  final bool isValid;
  final String? reason;
  final Map<String, dynamic>? payload;

  TokenValidationResult(this.isValid, {this.reason, this.payload});
}

TokenValidationResult validateToken(String? token) {
  if (token == null || token.isEmpty) {
    return TokenValidationResult(false, reason: "Token ausente");
  }

  try {
    const hubJwtSecret = String.fromEnvironment(
      'HUB_JWT_SECRET',
      defaultValue: '',
    );
    if (hubJwtSecret.trim().isEmpty) {
      return TokenValidationResult(
        false,
        reason: "Segredo JWT do hub nao configurado",
      );
    }

    final jwt = JWT.verify(
      token,
      SecretKey(hubJwtSecret),
    );

    final payload = jwt.payload;
    debugPrint("JWT validado com sucesso");

    if (payload["iss"] != "sebratel-hub") {
      return TokenValidationResult(
        false,
        reason: "Emissor n\u00e3o autorizado",
      );
    }

    return TokenValidationResult(
      true,
      payload: payload.map((k, v) => MapEntry(k.toString(), v)),
    );
  } catch (e) {
    return TokenValidationResult(false, reason: "Token inv\u00e1lido: $e");
  }
}

Set<String> _parseCsvEnv(String value) {
  return value
      .split(',')
      .map((it) => it.trim().toLowerCase())
      .where((it) => it.isNotEmpty)
      .toSet();
}

// =============================================================
// LIMPA ?token= DA URL (WEB)
// =============================================================
void _limparTokenDaUrl() {
  final uri = Uri.base;

  if (uri.queryParameters.containsKey('token')) {
    final cleanUri = uri.replace(queryParameters: {});
    WebUtils.replaceUrl(cleanUri.toString());
  }
}

// =============================================================
// APP ROOT
// =============================================================
class MyApp extends StatefulWidget {
  final AuthService authService;
  final SplitterService splitterService;
  final AppSessionUser sessionUser;
  final String middlewareMassivaBaseUrl;
  final String ellevenMassivaEndpoint;
  final String ellevenMassivaListEndpoint;
  final String ellevenMassivaListBearerToken;
  final String ellevenMassivaListHeaderName;
  final String ellevenMassivaListHeaderValue;
  final String autoIspEventsEndpoint;
  final String autoIspAuthEndpoint;
  final String autoIspUsername;
  final String autoIspPassword;
  final String massivaCookieString;

  const MyApp({
    super.key,
    required this.splitterService,
    required this.authService,
    required this.sessionUser,
    required this.middlewareMassivaBaseUrl,
    required this.ellevenMassivaEndpoint,
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
        middlewareMassivaBaseUrl: widget.middlewareMassivaBaseUrl,
        ellevenMassivaEndpoint: widget.ellevenMassivaEndpoint,
        ellevenMassivaListEndpoint: widget.ellevenMassivaListEndpoint,
        ellevenMassivaListBearerToken: widget.ellevenMassivaListBearerToken,
        ellevenMassivaListHeaderName: widget.ellevenMassivaListHeaderName,
        ellevenMassivaListHeaderValue: widget.ellevenMassivaListHeaderValue,
        autoIspEventsEndpoint: widget.autoIspEventsEndpoint,
        autoIspAuthEndpoint: widget.autoIspAuthEndpoint,
        autoIspUsername: widget.autoIspUsername,
        autoIspPassword: widget.autoIspPassword,
        massivaCookieString: widget.massivaCookieString,
      ),
    );
  }
}
