import 'package:flutter_test/flutter_test.dart';
import 'package:nexaview/models/massiva_models.dart';

void main() {
  group('Massiva models', () {
    test('EllevenMassivaResponse consolida protocolo e assignment', () {
      final response = EllevenMassivaResponse.fromJson({
        'data': {
          'response': {
            'message': 'Massiva aberta',
          },
        },
        'createdProtocols': ['4567'],
        'assignmentId': '99',
      });

      expect(response.success, isTrue);
      expect(response.protocol, 4567);
      expect(response.assignmentId, 99);
      expect(response.message, 'Massiva aberta');
      expect(response.createdProtocols, [4567]);
    });

    test('MassivaTicket interpreta datas brasileiras e status encerrado', () {
      final ticket = MassivaTicket.fromJson({
        'protocol': '1234',
        'assignmentId': '77',
        'title': 'Intermitencia',
        'apCode': 'AP-01',
        'splitterCode': 'SPL-01',
        'status': 'Encerrada',
        'beginningDate': '19/03/2026 08:30',
        'finalDate': '19/03/2026',
        'finalTime': '10:15',
        'closedAt': '19/03/2026 10:20',
        'affectedClients': '12',
      });

      expect(ticket.protocol, 1234);
      expect(ticket.assignmentId, 77);
      expect(ticket.status, MassivaStatus.encerrada);
      expect(ticket.openedAt, DateTime(2026, 3, 19, 8, 30));
      expect(ticket.expectedCloseAt, DateTime(2026, 3, 19, 10, 15));
      expect(ticket.closedAt, DateTime(2026, 3, 19, 10, 20));
      expect(ticket.affectedClients, 12);
      expect(ticket.isClosed, isTrue);
    });

    test('AutoIspEvent identifica evento aberto', () {
      final event = AutoIspEvent.fromJson({
        'id': '55',
        'event_type': 'fiber_cut',
        'admin_status': 'new',
        'start_at': '2026-03-19T08:00:00',
        'count_onus': '5',
        'count_circuits': '7',
        'resources': [
          {
            'ponlink': 'PON-1',
            'pppoe_username': 'cliente01',
            'network_status': 'down',
            'contract_id': '100',
            'onu_id': '200',
          },
        ],
      });

      expect(event.id, 55);
      expect(event.isOpen, isTrue);
      expect(event.resources, hasLength(1));
      expect(event.resources.first.pppoeUsername, 'cliente01');
    });
  });
}
