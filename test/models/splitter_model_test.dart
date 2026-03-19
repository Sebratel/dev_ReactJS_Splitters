import 'package:flutter_test/flutter_test.dart';
import 'package:nexaview/models/splitter_model.dart';

void main() {
  group('SplitterModel', () {
    test('normaliza coordenadas e campos aninhados da API', () {
      final splitter = SplitterModel.fromJson({
        'id': '10',
        'code': 'SPL-001',
        'integrationCode': 'geo-123',
        'title': 'Splitter Centro',
        'outPorts': '16',
        'active': true,
        'description': 'Splitter principal',
        'type': {'text': '1x16'},
        'address': {
          'latitude': '-29,1234',
          'longitude': '-51,9876',
          'road': 'Rua A',
        },
        'networkBox': {
          'code': 'CTO-01',
          'title': 'CTO Centro',
          'type': {'text': 'CTO'},
        },
        'olt': {
          'code': 'OLT-01',
          'integrationCode': 'olt-int',
          'description': 'OLT Centro',
        },
      });

      expect(splitter.id, 10);
      expect(splitter.outPorts, 16);
      expect(splitter.typeText, '1x16');
      expect(splitter.street, 'Rua A');
      expect(splitter.lat, closeTo(-29.1234, 0.0001));
      expect(splitter.lng, closeTo(-51.9876, 0.0001));
      expect(splitter.hasLocation, isTrue);
      expect(splitter.networkBoxCode, 'CTO-01');
      expect(splitter.oltCode, 'OLT-01');
    });

    test('hasLocation eh falso quando coordenadas nao podem ser convertidas', () {
      const splitter = SplitterModel(
        id: 1,
        code: 'SPL-002',
        integrationCode: 'geo-456',
        title: 'Sem coordenada',
        outPorts: 8,
        active: true,
        typeText: '1x8',
        description: '',
        latitude: '',
        longitude: 'invalido',
      );

      expect(splitter.lat, isNull);
      expect(splitter.lng, isNull);
      expect(splitter.hasLocation, isFalse);
    });
  });
}
