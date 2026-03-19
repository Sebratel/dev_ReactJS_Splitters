import 'package:flutter_test/flutter_test.dart';
import 'package:nexaview/models/app_session_user.dart';

void main() {
  group('AppSessionUser', () {
    test('libera massiva por email permitido e extrai personId', () {
      final user = AppSessionUser.fromJwtPayload(
        {
          'email': 'Dev@Sebratel.com.br',
          'name': 'Dev User',
          'personId': '123',
          'roles': ['viewer'],
        },
        allowedEmails: {'dev@sebratel.com.br'},
        allowedRoles: {'massiva_admin'},
      );

      expect(user.email, 'Dev@Sebratel.com.br');
      expect(user.name, 'Dev User');
      expect(user.personId, 123);
      expect(user.canOpenMassiva, isTrue);
    });

    test('libera massiva por role permitida', () {
      final user = AppSessionUser.fromJwtPayload(
        {
          'preferred_username': 'analista@sebratel.com.br',
          'role': ['cor_massiva'],
        },
        allowedEmails: const {},
        allowedRoles: {'cor_massiva'},
      );

      expect(user.roles, contains('cor_massiva'));
      expect(user.canOpenMassiva, isTrue);
    });

    test('nao libera massiva quando email e roles nao sao permitidos', () {
      final user = AppSessionUser.fromJwtPayload(
        {
          'email': 'sem.acesso@sebratel.com.br',
          'roles': ['viewer'],
        },
        allowedEmails: {'outro@sebratel.com.br'},
        allowedRoles: {'massiva_admin'},
      );

      expect(user.canOpenMassiva, isFalse);
      expect(user.personId, isNull);
    });
  });
}
