import 'package:nexaview/models/massiva_models.dart';
import 'package:nexaview/services/massiva_gateway_service.dart';
import 'package:nexaview/services/massiva_middleware_service.dart';

class MassivaOrchestratorService {
  final MassivaMiddlewareService middlewareService;
  final MassivaGatewayService gatewayService;

  MassivaOrchestratorService({
    required this.middlewareService,
    required this.gatewayService,
  });

  Future<MassivaExecutionResult> execute({
    required MassivaIncidentRequest request,
    bool forceIndividualFallback = false,
  }) async {
    final filtered = await middlewareService.filterAffectedClients(request);

    if (filtered.cleanAuthenticationIds.isEmpty) {
      return MassivaExecutionResult(
        filtered: filtered,
        usedFallback: false,
        elleven: const EllevenMassivaResponse(
          success: true,
          message: 'Nenhum cliente impactado para abrir protocolo.',
        ),
      );
    }

    if (forceIndividualFallback) {
      final fallback = await gatewayService.openMassiva(
        incident: request,
        authenticationIds: filtered.cleanAuthenticationIds,
        individualTickets: true,
      );

      return MassivaExecutionResult(
        filtered: filtered,
        elleven: fallback,
        usedFallback: true,
      );
    }

    try {
      final massiva = await gatewayService.openMassiva(
        incident: request,
        authenticationIds: filtered.cleanAuthenticationIds,
        individualTickets: false,
      );

      return MassivaExecutionResult(
        filtered: filtered,
        elleven: massiva,
        usedFallback: false,
      );
    } catch (_) {
      final fallback = await gatewayService.openMassiva(
        incident: request,
        authenticationIds: filtered.cleanAuthenticationIds,
        individualTickets: true,
      );

      return MassivaExecutionResult(
        filtered: filtered,
        elleven: fallback,
        usedFallback: true,
      );
    }
  }
}
