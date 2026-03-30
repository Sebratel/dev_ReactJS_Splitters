import 'dart:convert';

import 'package:flutter/foundation.dart';

/// Representa o usuario da sessao ja convertido para o formato do app.
///
/// Este model define se a area de massivas pode ser usada e carrega
/// identificadores reaproveitados em chamadas de API.
class AppSessionUser {
  static const String massivaViewPermission = 'massiva_view';
  static const String massivaOpenPermission = 'massiva_open';

  final String email;
  final String? name;
  final int? personId;
  final String? sessionToken;
  final Set<String> roles;
  final Set<String> permissions;
  final bool isAdmin;
  final bool canAccessMassiva;
  final bool canOpenMassiva;

  const AppSessionUser({
    required this.email,
    required this.roles,
    required this.permissions,
    required this.isAdmin,
    required this.canAccessMassiva,
    required this.canOpenMassiva,
    this.name,
    this.personId,
    this.sessionToken,
  });

  factory AppSessionUser.guest() {
    return const AppSessionUser(
      email: '',
      roles: {},
      permissions: {},
      isAdmin: false,
      canAccessMassiva: true,
      canOpenMassiva: true,
    );
  }

  factory AppSessionUser.local({
    required String email,
    required bool canOpenMassiva,
    int? personId,
    String? sessionToken,
  }) {
    return AppSessionUser(
      email: email,
      roles: canOpenMassiva ? {'local_massiva'} : const {},
      permissions: canOpenMassiva
          ? {massivaViewPermission, massivaOpenPermission}
          : const {},
      isAdmin: canOpenMassiva,
      canAccessMassiva: true,
      canOpenMassiva: true,
      name: 'Local Dev',
      personId: personId,
      sessionToken: sessionToken,
    );
  }

 factory AppSessionUser.fromJwtPayload(
  Map<String, dynamic> payload, {
  required Set<String> allowedEmails,
  required Set<String> allowedRoles,
  String? sessionToken,
}) {
  // --- 0. Pré-processamento do hubLaunch ---
  // Na URL, o hubLaunch geralmente vem como uma String JSON. 
  // Precisamos converter para Map para conseguir acessar as chaves internas.
  Map<String, dynamic> hubLaunchData = {};
  final rawHubLaunch = payload['hubLaunch'];
  
  if (rawHubLaunch is Map) {
    hubLaunchData = rawHubLaunch.cast<String, dynamic>();
  } else if (rawHubLaunch is String && rawHubLaunch.isNotEmpty) {
    try {
      final decoded = jsonDecode(rawHubLaunch);
      if (decoded is Map) {
        hubLaunchData = decoded.cast<String, dynamic>();
      }
    } catch (e) {
      debugPrint("Erro ao decodar hubLaunch da URL: $e");
    }
  }

  // --- 1. Extração de Identidade Base ---
  // Tenta na raiz, se não achar, tenta dentro do hubLaunch decodificado
  final email = _extractString(payload, ['email', 'upn', 'preferred_username', 'sub']) ??
                _extractString(hubLaunchData, ['email', 'upn']) ??
                '';

  final name = _extractString(payload, ['name', 'nome', 'given_name', 'display_name']) ??
               _extractString(hubLaunchData, ['name', 'nome']);

  final personId = _extractInt(payload, [
    'personId', 'person_id', 'employeeId', 'employee_id',
    'colaboradorId', 'colaborador_id', 'id', 'ID',
  ]) ?? _extractInt(hubLaunchData, ['personId', 'person_id', 'id']) ?? 0;

  // --- 2. Extração de Permissões ---
  final Set<String> permissions = {};

  // Busca permissões na raiz ou dentro do hubLaunchData
  // Aceita o formato "perm1,perm2" (String) ou ["perm1", "perm2"] (List)
  var rawPerms = payload['permissions'] ?? hubLaunchData['permissions'];

  if (rawPerms is String && rawPerms.isNotEmpty) {
    permissions.addAll(rawPerms.split(',').map((e) => e.trim().toLowerCase()));
  } else if (rawPerms is List) {
    permissions.addAll(rawPerms.map((e) => e.toString().trim().toLowerCase()));
  }

  // --- 3. Extração de Roles e Admin ---
  final roles = _extractRoles(payload);
  if (roles.isEmpty && hubLaunchData.containsKey('roles')) {
    final rawRoles = hubLaunchData['roles'];
    if (rawRoles is List) roles.addAll(rawRoles.map((e) => e.toString()));
  }

  final bool isAdmin = payload['isAdmin'] == true || 
                       payload['isAdmin'] == 'true' ||
                       hubLaunchData['isAdmin'] == true ||
                       hubLaunchData['isAdmin'] == 'true';

  // --- 4. Lógica de Flags de Interface (Regras de Negócio) ---
  // Agora validamos se as permissões necessárias existem no Set
  final canAccessMassiva = permissions.contains('massiva_view') || 
                           permissions.contains('massiva_admin') ||
                           isAdmin;

  final canOpenMassiva = permissions.contains('massiva_open') || 
                         permissions.contains('massiva_admin') ||
                         isAdmin;

  // DEBUG (IMPORTANTE: Verifique o console do navegador)
  debugPrint("--- AUTH DEBUG ---");
  debugPrint("Email extraído: $email");
  debugPrint("HubLaunch detectado: ${hubLaunchData.isNotEmpty}");
  debugPrint("Permissions encontradas: $permissions");
  debugPrint("Can Access Massiva: $canAccessMassiva");
  debugPrint("Can Open Massiva: $canOpenMassiva");

  return AppSessionUser(
    email: email,
    name: name ?? 'Usuário',
    personId: personId,
    sessionToken: sessionToken,
    roles: roles,
    permissions: permissions,
    isAdmin: isAdmin,
    canAccessMassiva: canAccessMassiva,
    canOpenMassiva: canOpenMassiva,
  );
}

  factory AppSessionUser.fromHubSession(
    Map<String, dynamic> payload, {
    String? sessionToken,
  }) {
    final email = _extractString(payload, ['email']) ?? '';
    final name = _extractString(payload, ['name']);
    final permissions = _extractValues(payload, ['permissions']);
    final isAdmin = payload['isAdmin'] == true;
    final canAccessMassiva = isAdmin ||
        permissions.contains(massivaViewPermission) ||
        permissions.contains(massivaOpenPermission);
    final canOpenMassiva =
        isAdmin || permissions.contains(massivaOpenPermission);

    return AppSessionUser(
      email: email,
      name: name,
      personId: null,
      sessionToken: sessionToken,
      roles: _extractValues(payload, ['profile', 'team']),
      permissions: permissions,
      isAdmin: isAdmin,
      canAccessMassiva: canAccessMassiva,
      canOpenMassiva: canOpenMassiva,
    );
  }

  static String? _extractString(
    Map<String, dynamic> payload,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = payload[key];
      if (value is String && value.trim().isNotEmpty) {
        return value.trim();
      }
    }
    return null;
  }

  static int? _extractInt(
    Map<String, dynamic> payload,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = payload[key];
      if (value is int) {
        return value > 0 ? value : null;
      }
      final parsed = int.tryParse(value?.toString() ?? '');
      if (parsed != null && parsed > 0) {
        return parsed;
      }
    }
    return null;
  }

  static Set<String> _extractRoles(Map<String, dynamic> payload) {
    final rawRoles = payload['roles'] ?? payload['role'];
    final roles = <String>{};

    if (rawRoles is String) {
      roles.add(rawRoles.trim().toLowerCase());
    } else if (rawRoles is List) {
      for (final item in rawRoles) {
        if (item is String && item.trim().isNotEmpty) {
          roles.add(item.trim().toLowerCase());
        }
      }
    }

    return roles;
  }

  static Set<String> _extractValues(
    Map<String, dynamic> payload,
    List<String> keys,
  ) {
    final values = <String>{};

    for (final key in keys) {
      final raw = payload[key];
      if (raw is String && raw.trim().isNotEmpty) {
        values.add(raw.trim().toLowerCase());
      } else if (raw is List) {
        for (final item in raw) {
          if (item is String && item.trim().isNotEmpty) {
            values.add(item.trim().toLowerCase());
          }
        }
      }
    }

    return values;
  }
}
