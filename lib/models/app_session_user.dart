/// Representa o usuario da sessao ja convertido para o formato do app.
///
/// Este model define se a area de massivas pode ser usada e carrega
/// identificadores reaproveitados em chamadas de API.
class AppSessionUser {
  final String email;
  final String? name;
  final int? personId;
  final Set<String> roles;
  final bool canOpenMassiva;

  const AppSessionUser({
    required this.email,
    required this.roles,
    required this.canOpenMassiva,
    this.name,
    this.personId,
  });

  factory AppSessionUser.guest() {
    return const AppSessionUser(
      email: '',
      roles: {},
      canOpenMassiva: false,
    );
  }

  factory AppSessionUser.local({
    required String email,
    required bool canOpenMassiva,
    int? personId,
  }) {
    return AppSessionUser(
      email: email,
      roles: canOpenMassiva ? {'local_massiva'} : const {},
      canOpenMassiva: canOpenMassiva,
      name: 'Local Dev',
      personId: personId,
    );
  }

  factory AppSessionUser.fromJwtPayload(
    Map<String, dynamic> payload, {
    required Set<String> allowedEmails,
    required Set<String> allowedRoles,
  }) {
    // O payload do JWT pode variar conforme a origem. Por isso tentamos
    // multiplas chaves equivalentes antes de decidir o acesso.
    final email = _extractString(
          payload,
          ['email', 'upn', 'preferred_username', 'sub'],
        ) ??
        '';
    final name = _extractString(
      payload,
      ['name', 'nome', 'given_name'],
    );
    final personId = _extractInt(
      payload,
      [
        'personId',
        'person_id',
        'employeeId',
        'employee_id',
        'colaboradorId',
        'colaborador_id',
        'collaboratorId',
        'collaborator_id',
        'userId',
        'user_id',
        'id',
        'ID',
      ],
    );
    final roles = _extractRoles(payload);

    final emailAllowed = email.isNotEmpty &&
        allowedEmails.any((it) => it == email.toLowerCase());
    final roleAllowed = roles.any(allowedRoles.contains);

    return AppSessionUser(
      email: email,
      name: name,
      personId: personId,
      roles: roles,
      canOpenMassiva: emailAllowed || roleAllowed,
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
}
