// lib/models/porta_geogrid_model.dart

class PortaGeoGrid {
  final int porta;
  final bool hasReserva;
  final bool reservaEmAtendimento;
  final DateTime? dataReserva;
  final String? idCliente;

  bool get hasReservaComCadeado => hasReserva && !reservaEmAtendimento;

  const PortaGeoGrid({
    required this.porta,
    required this.hasReserva,
    required this.reservaEmAtendimento,
    this.dataReserva,
    this.idCliente,
  });

  static DateTime? _parseDate(dynamic value) {
    final raw = value?.toString().trim();
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  factory PortaGeoGrid.fromGeoGrid(Map<String, dynamic> json) {
    final dados = json['dados'] as Map<String, dynamic>? ?? {};

    final porta = int.tryParse(dados['porta']?.toString() ?? '');
    final reservaStatus = dados['reservaStatus']?.toString();
    final reservaAtendimento = dados['reservaAtendimento']?.toString();
    final dataReserva = _parseDate(dados['dataReserva']);
    final idClienteRaw = dados['idCliente']?.toString();
    final idCliente =
        (idClienteRaw == null || idClienteRaw.isEmpty) ? null : idClienteRaw;

    return PortaGeoGrid(
      porta: porta ?? -1,
      hasReserva: reservaStatus == 'reserva',
      reservaEmAtendimento: reservaAtendimento == 'S',
      dataReserva: dataReserva,
      idCliente: idCliente,
    );
  }
}
