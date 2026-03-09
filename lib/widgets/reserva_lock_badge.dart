import 'package:flutter/material.dart';

class ReservaLockBadge extends StatelessWidget {
  final double size;
  final double iconSize;

  const ReservaLockBadge({
    super.key,
    this.size = 28,
    this.iconSize = 18,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.purple,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Icon(
          Icons.lock,
          size: iconSize,
          color: Colors.white,
        ),
      ),
    );
  }
}
