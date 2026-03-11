import 'package:nexaview/enums/splitter_status.dart';

class SplitterStatusService {
  static SplitterStatus resolve({
    required int ocupacaoReal,
    required int totalPortas,
  }) {
    if (totalPortas <= 0) {
      return SplitterStatus.normal;
    }

    // 🚨 Excedente real
    if (ocupacaoReal > totalPortas) {
      return SplitterStatus.excedente;
    }

    final double percentual = (ocupacaoReal / totalPortas) * 100;

    // 🔴 100% exatamente
    if (percentual == 100) {
      return SplitterStatus.critico;
    }

    // ⚠️ 51% até 99%
    if (percentual > 70) {
      return SplitterStatus.alerta;
    }

    // ✅ até 50%
    return SplitterStatus.normal;
  }
}
