import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:nexaview/utils/web_utils.dart';

import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

import 'package:nexaview/theme.dart';
import 'package:nexaview/screens/home_page.dart';
import 'package:nexaview/services/auth_service.dart';
import 'package:nexaview/services/splitter_service.dart';

import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';

// 🔥 IMPORT EXCLUSIVO PARA WEB (limpar URL)
import 'dart:html' as html;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  debugPrint("🔥 INICIANDO SPLITTERS VIA TOKEN DO HUB 🔥");

  // =============================================================
  // 1️⃣ Firebase
  // =============================================================
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // =============================================================
  // 2️⃣ Token via URL (Web)
  // =============================================================
  final params = WebUtils.queryParams;
  final token = params['token'];

  debugPrint("📥 TOKEN RECEBIDO >>> $token");

  // =============================================================
  // 3️⃣ Ambiente local vs produção
  // =============================================================
  final host = Uri.base.host;

  final isLocal = host == "localhost" ||
      host == "127.0.0.1" ||
      host == "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.");

  if (!isLocal) {
    final tokenResult = validateToken(token);

    if (!tokenResult.isValid) {
      debugPrint("⛔ ACESSO BLOQUEADO → ${tokenResult.reason}");

      Future.microtask(() {
        WebUtils.redirect("https://sebratel-hub.web.app");
      });
      return;
    }

    debugPrint("✅ TOKEN ACEITO — App liberado");

    // 🔥 REMOVE O TOKEN DA URL (SEM RELOAD)
    _limparTokenDaUrl();
  } else {
    debugPrint("🌐 Ambiente local — validação de token ignorada");
  }

  // =============================================================
  // 4️⃣ Hive (cache local)
  // =============================================================
  await Hive.initFlutter();
  await SplitterService.initHive();

  // =============================================================
  // 5️⃣ Auth ERP
  // =============================================================
  final auth = AuthService(
    clientId: "ad0c5d9a-fad1-4ca9-8d1e-cff2cedb3146",
    clientSecret: "cb53bd13-5305-4306-b03b-b00cf05f2e34",
    syndata:
        "TWpNMU9EYzVaakk1T0dSaU1USmxaalprWldFd00ySTFZV1JsTTJRMFptUT06WlhsS1ZHVlhOVWxpTTA0d1NXcHZhVTFVWnpKTWFrbDRUMU0wZUUxcVozVk5hbFY0U1dsM2FWVXpiSFZTUjBscFQybEthMWx0Vm5SalJFRjNUVlJCZDBscGQybFNSMHBWWlZoQ2JFbHFiMmxqUnpsNlpFZGtlVnBZVFdsbVVUMDk6WlRoa01qTTFZamswWXpsaU5ETm1aRGczTURsa01qWTJZekF4TUdNM01HVT0=",
    grantType: "client_credentials",
    scope: "syngw",
  );

  // =============================================================
  // 6️⃣ Serviços principais
  // =============================================================
  final splitterService = SplitterService(
    auth: auth,
    splittersEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/splitter/all",
    clientesEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/connection/all",
  );

  // =============================================================
  // 7️⃣ Start App
  // =============================================================
  runApp(
    MyApp(
      splitterService: splitterService,
      authService: auth,
    ),
  );
}

// =============================================================
// 🔐 Validação do Token JWT
// =============================================================
class TokenValidationResult {
  final bool isValid;
  final String? reason;

  TokenValidationResult(this.isValid, {this.reason});
}

TokenValidationResult validateToken(String? token) {
  if (token == null || token.isEmpty) {
    return TokenValidationResult(false, reason: "Token ausente");
  }

  try {
    final jwt = JWT.verify(
      token,
      SecretKey("MINHACHAVESECRETA123"),
    );

    final payload = jwt.payload;
    debugPrint("📦 PAYLOAD JWT → $payload");

    if (payload["iss"] != "sebratel-hub") {
      return TokenValidationResult(
        false,
        reason: "Emissor não autorizado",
      );
    }

    return TokenValidationResult(true);
  } catch (e) {
    return TokenValidationResult(false, reason: "Token inválido: $e");
  }
}

// =============================================================
// 🔥 LIMPA ?token= DA URL (WEB)
// =============================================================
void _limparTokenDaUrl() {
  final uri = Uri.base;

  if (uri.queryParameters.containsKey('token')) {
    final cleanUri = uri.replace(queryParameters: {});
    html.window.history.replaceState(
      null,
      '',
      cleanUri.toString(),
    );
  }
}

// =============================================================
// APP ROOT
// =============================================================
class MyApp extends StatefulWidget {
  final AuthService authService;
  final SplitterService splitterService;

  const MyApp({
    super.key,
    required this.splitterService,
    required this.authService,
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
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: _themeMode,
      home: HomePage(
        onThemeToggle: _toggleTheme,
        splitterService: widget.splitterService,
        authService: widget.authService,
      ),
    );
  }
}
