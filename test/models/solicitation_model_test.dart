import 'package:flutter_test/flutter_test.dart';
import 'package:nexaview/models/solicitation_model.dart';

void main() {
  group('SolicitationModel', () {
    test('converte payload de historico para model', () {
      final solicitation = SolicitationModel.fromJson({
        'assignmentId': 10,
        'protocol': 2026,
        'title': 'Falha em splitter',
        'status': 'Encerrada',
        'team': 'NOC',
        'sectorArea': 'Infra',
        'beginningData': '2026-03-19T08:00:00',
        'finalData': '2026-03-19T10:00:00',
      });

      expect(solicitation.assignmentId, 10);
      expect(solicitation.protocol, 2026);
      expect(solicitation.title, 'Falha em splitter');
      expect(solicitation.finalDate, DateTime.parse('2026-03-19T10:00:00'));
    });
  });
}
