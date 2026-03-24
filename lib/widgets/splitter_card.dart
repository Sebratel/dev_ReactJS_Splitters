import 'package:flutter/material.dart';
import 'package:nexaview/models/splitter_model.dart';

class SplitterCard extends StatelessWidget {
  final SplitterModel splitter;
  final int ocupacao;
  final VoidCallback onTap;

  const SplitterCard({
    super.key,
    required this.splitter,
    required this.ocupacao,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final total = splitter.outPorts;
    final pct = total == 0 ? 0 : ((ocupacao / total) * 100).round();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    final Color statusColor = pct >= 90
        ? const Color(0xFFEF4444)
        : pct >= 70
            ? const Color(0xFFF59E0B)
            : const Color(0xFF10B981);

    final cardBg = isDark
        ? const Color.fromARGB(255, 90, 90, 90)
        : const Color.fromARGB(188, 65, 65, 65);

    final shadowColor = isDark
        ? Colors.black.withValues(alpha: 0.4)
        : Colors.black.withValues(alpha: 0.15);

    final Color circleBgColor = pct > 100
        ? (isDark
            ? const Color.fromARGB(255, 117, 27, 27)
            : const Color.fromARGB(255, 252, 180, 180))
        : (isDark
            ? const Color.fromARGB(255, 58, 58, 58).withValues(alpha: 0.90)
            : Colors.white.withValues(alpha: 0.90));

    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompactCard =
            constraints.maxHeight > 0 && constraints.maxHeight < 132;
        final indicatorSize = isCompactCard ? 62.0 : 70.0;
        final outerPadding = isCompactCard ? 9.0 : 10.0;
        final horizontalGap = isCompactCard ? 8.0 : 10.0;
        final titleFontSize = isCompactCard ? 14.0 : 16.0;
        final codeFontSize = isCompactCard ? 11.0 : 12.0;
        final footerFontSize = isCompactCard ? 12.0 : 13.0;
        final progressSpacing = isCompactCard ? 7.0 : 10.0;

        return GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            padding: EdgeInsets.all(outerPadding),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.grey.withValues(alpha: 0.15),
              ),
              boxShadow: [
                BoxShadow(
                  color: shadowColor,
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: indicatorSize,
                  height: indicatorSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: circleBgColor,
                    border: Border.all(
                      color: pct > 100 ? const Color(0xFFDC2626) : statusColor,
                      width: pct > 100 ? 3 : 2,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      '$pct%',
                      style: TextStyle(
                        fontSize: isCompactCard ? 14 : 16,
                        fontWeight: FontWeight.bold,
                        color:
                            pct > 100 ? const Color(0xFFDC2626) : statusColor,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: horizontalGap),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        splitter.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: titleFontSize,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          height: 1.08,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        splitter.code,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: codeFontSize,
                          color: Colors.white.withValues(alpha: 0.92),
                        ),
                      ),
                      SizedBox(height: progressSpacing),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: pct > 100 ? 1.0 : pct / 100,
                          minHeight: 7,
                          backgroundColor: isDark
                              ? Colors.grey.shade800
                              : Colors.grey.shade200,
                          valueColor: AlwaysStoppedAnimation(statusColor),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '$ocupacao / $total portas ocupadas',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: footerFontSize,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
