import 'package:flutter/material.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:flutter/services.dart';

class ClienteCard extends StatelessWidget {
  final ClienteModel cliente;

  /// 🔴 Cliente excedente (overbooking)
  final bool isOverflow;

  /// 🟠 Cliente sem porta vinculada
  final bool isNoPort;

  const ClienteCard({
    super.key,
    required this.cliente,
    this.isOverflow = false,
    this.isNoPort = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isAtivo = cliente.status == 1;

    // ================= CORES DE STATUS =================
    final Color statusColor = isOverflow
        ? const Color(0xFFDC2626) // 🔴 excedente
        : isNoPort
            ? const Color(0xFFF59E0B) // 🟠 sem porta
            : isAtivo
                ? const Color(0xFFFFC107) // 🟡 ativo
                : const Color(0xFFE53935); // 🔴 inativo

    final Color cardColor = isDark ? const Color(0xFF121212) : Colors.white;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(18),

        // 🔥 BORDA INTELIGENTE
        border: Border.all(
          color: isOverflow || isNoPort
              ? statusColor
              : isDark
                  ? Colors.white.withOpacity(0.05)
                  : Colors.grey.withOpacity(0.15),
          width: isOverflow || isNoPort ? 2 : 1,
        ),

        boxShadow: [
          BoxShadow(
            color: statusColor.withOpacity(
              isOverflow || isNoPort ? 0.25 : 0.08,
            ),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // ================= STATUS + PORTA =================
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 🔹 BADGE
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isOverflow
                      ? "EXCEDENTE"
                      : isNoPort
                          ? "SEM PORTA"
                          : isAtivo
                              ? "ATIVO"
                              : "INATIVO",
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),

              const SizedBox(height: 6),

              // 🔹 PORTA (somente se existir)
              Text(
                (cliente.port ?? 0) > 0
                    ? "Porta ${cliente.port}"
                    : "Porta não definida",
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                ),
              ),
            ],
          ),

          const SizedBox(width: 16),

          // ================= NOME + USUÁRIO =================

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end, // 🔒 mantém à direita
              children: [
                GestureDetector(
                  onLongPress: () => _copy(context, cliente.name),
                  child: SelectableText(
                    cliente.name.isNotEmpty ? cliente.name : "Cliente sem nome",
                    maxLines: 1,
                    //overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right, // 🔒 mantém à direita
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                const SizedBox(height: 5),
                GestureDetector(
                  onLongPress: () => _copy(context, cliente.user),
                  child: SelectableText(
                    cliente.user.isNotEmpty ? cliente.user : "-",
                    maxLines: 1,
                    //overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right, // 🔒 mantém à direita
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color:
                          isDark ? Colors.grey.shade400 : Colors.grey.shade700,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 16),

          // ================= ÍCONE =================
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  statusColor.withOpacity(0.25),
                  statusColor.withOpacity(0.05),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              isOverflow
                  ? Icons.warning_amber_rounded
                  : isNoPort
                      ? Icons.link_off_rounded
                      : Icons.person_rounded,
              color: statusColor,
              size: 28,
            ),
          ),
        ],
      ),
    );
  }

  void _copy(BuildContext context, String value) {
    if (value.trim().isEmpty) return;

    Clipboard.setData(ClipboardData(text: value));

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Copiado: $value'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
