class AppSessionUser {
  final String email;
  final String? name;
  final Set<String> roles;
  final bool canOpenMassiva;

  const AppSessionUser({
    required this.email,
    required this.roles,
    required this.canOpenMassiva,
    this.name,
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
  }) {
    return AppSessionUser(
      email: email,
      roles: canOpenMassiva ? {'local_massiva'} : const {},
      canOpenMassiva: canOpenMassiva,
      name: 'Local Dev',
    );
  }

  factory AppSessionUser.fromJwtPayload(
    Map<String, dynamic> payload, {
    required Set<String> allowedEmails,
    required Set<String> allowedRoles,
  }) {
    final email = _extractString(
          payload,
          ['email', 'upn', 'preferred_username', 'sub'],
        ) ??
        '';
    final name = _extractString(
      payload,
      ['name', 'nome', 'given_name'],
    );
    final roles = _extractRoles(payload);

    final emailAllowed = email.isNotEmpty &&
        allowedEmails.any((it) => it == email.toLowerCase());
    final roleAllowed = roles.any(allowedRoles.contains);

    return AppSessionUser(
      email: email,
      name: name,
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
