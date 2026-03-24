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

  var sessionUser = AppSessionUser.guest();

  if (!isLocal) {
    // Em producao o acesso depende do token enviado pelo Hub.
    final tokenResult = validateToken(token);

    sessionUser = AppSessionUser.fromJwtPayload(
      tokenResult.payload ?? const <String, dynamic>{},
      allowedEmails: allowedMassivaEmails,
      allowedRoles: allowedMassivaRoles,
    );

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
      geogridBaseUrl: geogridBaseUrl,
      geogridApiKey: geogridApiKey,
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

// Valida o JWT recebido via query string e devolve o payload normalizado.
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
        geogridBaseUrl: widget.geogridBaseUrl,
        geogridApiKey: widget.geogridApiKey,
      ),
    );
  }
}
