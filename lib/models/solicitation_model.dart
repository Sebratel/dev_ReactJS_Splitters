/// Representa uma solicitacao/protocolo retornado por consultas de historico.
class SolicitationModel {
  final int assignmentId;
  final int protocol;
  final String title;
  final String status;
  final String team;
  final String sectorArea;
  final DateTime beginningDate;
  final DateTime? finalDate;

  SolicitationModel({
    required this.assignmentId,
    required this.protocol,
    required this.title,
    required this.status,
    required this.team,
    required this.sectorArea,
    required this.beginningDate,
    this.finalDate,
  });

  factory SolicitationModel.fromJson(Map<String, dynamic> json) {
    return SolicitationModel(
      assignmentId: json['assignmentId'],
      protocol: json['protocol'],
      title: json['title'] ?? '',
      status: json['status'] ?? '',
      team: json['team'] ?? '',
      sectorArea: json['sectorArea'] ?? '',
      beginningDate: DateTime.parse(json['beginningData']),
      finalDate: json['finalData'] != null
          ? DateTime.parse(json['finalData'])
          : null,
    );
  }
}
