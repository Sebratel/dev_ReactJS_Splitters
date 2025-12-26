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

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  print("🔥 INICIANDO SPLITTERS VIA TOKEN DO HUB 🔥");

  // 1) Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // 2) Captura token da URL
  final params = WebUtils.queryParams;
  final token = params['token'];

  print("📥 TOKEN RECEBIDO PELO SPLITTERS >>> $token");

  // 3) Detecta ambiente local
  final host = Uri.base.host;

  final isLocal = host == "localhost" ||
      host == "127.0.0.1" ||
      host == "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.");

  if (isLocal) {
    print("🌐 Ambiente local detectado — ignorando validação de token");
  } else {
    // 4) Validar token SOMENTE EM PRODUÇÃO
    final tokenResult = validateToken(token);

    if (!tokenResult.isValid) {
      print("⛔ ACESSO BLOQUEADO >>> ${tokenResult.reason}");

      Future.microtask(() {
        WebUtils.redirect("https://sebratel-hub.web.app");
      });

      return;
    }

    print("✅ TOKEN ACEITO — 🔓 App liberado!");
  }

  // 5) Hive
  await Hive.initFlutter();
  await SplitterService.initHive();

  // 6) Auth ERP
  final auth = AuthService(
    clientId: "ad0c5d9a-fad1-4ca9-8d1e-cff2cedb3146",
    clientSecret: "cb53bd13-5305-4306-b03b-b00cf05f2e34",
    syndata:
        "TWpNMU9EYzVaakk1T0dSaU1USmxaalprWldFd00ySTFZV1JsTTJRMFptUT06WlhsS1ZHVlhOVWxpTTA0d1NXcHZhVTFVWnpKTWFrbDRUMU0wZUUxcVozVk5hbFY0U1dsM2FWVXpiSFZTUjBscFQybEthMWx0Vm5SalJFRjNUVlJCZDBscGQybFNSMHBWWlZoQ2JFbHFiMmxqUnpsNlpFZGtlVnBZVFdsbVVUMDk6WlRoa01qTTFZamswWXpsaU5ETm1aRGczTURsa01qWTJZekF4TUdNM01HVT0=",
    grantType: "client_credentials",
    scope: "syngw",
  );

  // 7) Serviços
  final splitterService = SplitterService(
    auth: auth,
    splittersEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/splitter/all",
    clientesEndpoint:
        "https://erp.sebratel.net.br:45715/external/map/connection/all",
  );

  // 8) Iniciar App
  runApp(
    MyApp(
      splitterService: splitterService,
      authService: auth,
    ),
  );
}

// =============================================================
// 🔐 VALIDAÇÃO DO TOKEN — Versão corrigida e estável
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
      SecretKey("MINHACHAVESECRETA123"), // mesma chave do Hub
    );

    final payload = jwt.payload;
    print("📦 PAYLOAD RECEBIDO: $payload");

    // 🔥 Verificação básica: emissor correto
    if (payload["iss"] != "sebratel-hub") {
      return TokenValidationResult(
        false,
        reason: "Token emitido por origem não autorizada",
      );
    }

    // 🔥 Tudo ok
    return TokenValidationResult(true);
  } catch (e) {
    return TokenValidationResult(false, reason: "Token inválido: $e");
  }
}

// =============================================================
// APP PRINCIPAL
// =============================================================
class MyApp extends StatefulWidget {
  final AuthService authService; // ✅ ADICIONA
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
      title: 'Listagem de Splitters',
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
