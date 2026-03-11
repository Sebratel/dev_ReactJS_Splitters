import 'package:flutter/material.dart';

import 'qr_scanner_page_mobile.dart'
    if (dart.library.html) 'qr_scanner_page_web.dart';

class QRScannerPage extends StatelessWidget {
  const QRScannerPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const QRScannerPageImpl(); // ✅ agora reconhece corretamente
  }
}
