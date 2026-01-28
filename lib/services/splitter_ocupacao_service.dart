class SplitterOcupacao {
  final int totalClientes;
  final int totalPortas;
  final int excedentes;

  const SplitterOcupacao({
    required this.totalClientes,
    required this.totalPortas,
    required this.excedentes,
  });
}

class SplitterOcupacaoService {
  static SplitterOcupacao calcular({
    required int totalClientes,
    required int totalPortas,
  }) {
    final excedentes =
        totalPortas > 0 ? (totalClientes - totalPortas).clamp(0, 9999) : 0;

    return SplitterOcupacao(
      totalClientes: totalClientes,
      totalPortas: totalPortas,
      excedentes: excedentes,
    );
  }
}
