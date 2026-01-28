import 'package:nexaview/enums/splitter_status.dart';

class SplitterStatusService {
  static SplitterStatus resolve({
    required int ocupacaoReal,
    required int totalPortas,
  }) {
    if (totalPortas <= 0) {
      return SplitterStatus.Normal;
    }

    // 🔥 EXCEDENTE REAL → percentual > 100%
    if (ocupacaoReal > totalPortas) {
      return SplitterStatus.Excedente;
    }

    final percentual = (ocupacaoReal / totalPortas) * 100;

    if (percentual >= 100) return SplitterStatus.Critico;
    if (percentual >= 80) return SplitterStatus.Alerta;

    return SplitterStatus.Normal;
  }
}
