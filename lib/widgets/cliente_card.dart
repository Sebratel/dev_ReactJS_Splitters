// ignore_for_file: uri_does_not_exist, undefined_method

import 'package:flutter/material.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:nexaview/screens/cliente_detail_screen.dart';
import 'package:nexaview/widgets/reserva_lock_badge.dart';

class ClienteCard extends StatefulWidget {
  final ClienteModel cliente;
  final String token; // ADICIONAR
  final bool isOverflow;
  final bool isNoPort;
  final bool temReserva;
  final String? reservaInfo;

  const ClienteCard({
    super.key,
    required this.cliente,
    required this.token, // OBRIGATORIO
    this.isOverflow = false,
    this.isNoPort = false,
    this.temReserva = false,
    this.reservaInfo,
  });

  @override
  State<ClienteCard> createState() => _ClienteCardState();
}

class _ClienteCardState extends State<ClienteCard> {
  bool _hovered = false;
  bool _pressed = false;

  void _handlePress() {
    setState(() => _pressed = true);
    Future.delayed(const Duration(milliseconds: 180), () {
      if (mounted) setState(() => _pressed = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isAtivo = widget.cliente.status == 1;

    // ================= STATUS =================
    final Color statusColor = widget.isOverflow
        ? const Color(0xFFDC2626)
        : widget.isNoPort
            ? const Color(0xFFF59E0B)
            : isAtivo
                ? const Color(0xFFFFC107)
                : const Color(0xFFE53935);

    // ================= CORES DE INTERACAO =================
    final Color baseColor = isDark ? const Color(0xFF121212) : Colors.white;

    final Color hoverColor = isDark
        ? const Color.fromARGB(255, 100, 81, 40)
        : const Color.fromARGB(211, 255, 245, 186);

    final Color pressedColor = isDark
        ? const Color.fromARGB(255, 255, 220, 150)
        : const Color.fromARGB(255, 255, 220, 150);

    final Color bgColor = _pressed
        ? pressedColor
        : _hovered
            ? hoverColor
            : baseColor;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _handlePress(),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ClienteDetailPage(
                cliente: widget.cliente,
                token: widget.token, // AQUI
              ),
            ),
          );
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: widget.isOverflow || widget.isNoPort
                  ? statusColor
                  : const Color.fromARGB(255, 82, 82, 82)
                      .withValues(alpha: 0.2),
              width: widget.isOverflow || widget.isNoPort ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              // ================= STATUS + PORTA =================
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      widget.isOverflow
                          ? 'EXCEDENTE'
                          : widget.isNoPort
                              ? 'SEM PORTA'
                              : isAtivo
                                  ? 'ATIVO'
                                  : 'BLOQUEADO',
                      style: TextStyle(
                        color: statusColor,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.cliente.port != null
                        ? 'Porta ${widget.cliente.port}'
                        : 'Porta nao definida',
                    style: TextStyle(
                      fontSize: 14,
                      color:
                          isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                    ),
                  ),
                ],
              ),

              const SizedBox(width: 16),

              // ================= NOME + USUARIO =================
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      widget.cliente.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.cliente.user,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark
                            ? Colors.grey.shade400
                            : Colors.grey.shade700,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 16),

              // ================= ICONE =================
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          statusColor.withValues(alpha: 0.25),
                          statusColor.withValues(alpha: 0.05),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      widget.isOverflow
                          ? Icons.warning_amber_rounded
                          : widget.isNoPort
                              ? Icons.link_off_rounded
                              : Icons.person_rounded,
                      color: statusColor,
                      size: 28,
                    ),
                  ),

                  // RESERVA (PADRAO UNIFICADO)
                  if (widget.temReserva)
                    Positioned(
                      top: -6,
                      right: -6,
                      child: Tooltip(
                        message: widget.reservaInfo ?? 'Reserva GeoGrid',
                        child: const ReservaLockBadge(
                          size: 28,
                          iconSize: 18,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
