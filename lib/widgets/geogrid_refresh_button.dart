import 'package:flutter/material.dart';

class GeoGridRefreshButton extends StatefulWidget {
  final bool loading;
  final bool hasReserva;
  final VoidCallback onPressed;

  const GeoGridRefreshButton({
    super.key,
    required this.loading,
    required this.hasReserva,
    required this.onPressed,
  });

  @override
  State<GeoGridRefreshButton> createState() => _GeoGridRefreshButtonState();
}

class _GeoGridRefreshButtonState extends State<GeoGridRefreshButton> {
  static const int _maxClicks = 1;
  static const Duration _window = Duration(minutes: 1);

  final List<DateTime> _clicks = [];

  bool get _canClick {
    final now = DateTime.now();

    // remove cliques fora da janela de 1 minuto
    _clicks.removeWhere((t) => now.difference(t) > _window);

    return _clicks.length < _maxClicks;
  }

  int get _remainingClicks => _maxClicks - _clicks.length;

  void _handleTap() {
    if (widget.loading || !_canClick) return;

    setState(() {
      _clicks.add(DateTime.now());
    });

    widget.onPressed();
  }

  @override
  Widget build(BuildContext context) {
    final bool disabled = widget.loading || !_canClick;

    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Tooltip(
        message: widget.loading
            ? 'Atualizando reservas GeoGrid...'
            : !_canClick
                ? 'Limite atingido (1/min). Aguarde um pouco.'
                : widget.hasReserva
                    ? 'Atualizar reservas GeoGrid ($_remainingClicks restantes)'
                    : 'Nenhuma reserva GeoGrid',
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 200),
          opacity: disabled ? 0.5 : 1,
          child: Material(
            color: Colors.transparent,
            shape: const CircleBorder(),
            child: InkResponse(
              radius: 28,
              containedInkWell: true,
              customBorder: const CircleBorder(),
              onTap: disabled ? null : _handleTap,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 74,
                height: 54,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.black.withValues(alpha: 0.35),
                  boxShadow: [
                    // 🌟 Glow ativo apenas se houver reserva e não estiver bloqueado
                    if (widget.hasReserva && !disabled)
                      BoxShadow(
                        color: Colors.purple.withValues(alpha: 0.7),
                        blurRadius: 14,
                        spreadRadius: 1,
                      ),

                    // sombra base
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.45),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 250),
                    transitionBuilder: (child, animation) =>
                        ScaleTransition(scale: animation, child: child),
                    child: widget.loading
                        ? const SizedBox(
                            key: ValueKey('loading'),
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : Icon(
                            widget.hasReserva
                                ? Icons.lock_reset_rounded
                                : Icons.sync,
                            key: ValueKey(
                              widget.hasReserva ? 'locked' : 'unlocked',
                            ),
                            color: Colors.white,
                            size: 35,
                          ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

