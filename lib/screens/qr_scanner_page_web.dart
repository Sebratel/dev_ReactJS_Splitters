import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QRScannerPageImpl extends StatefulWidget {
  const QRScannerPageImpl({super.key});

  @override
  State<QRScannerPageImpl> createState() => _QRScannerPageImplState();
}

class _QRScannerPageImplState extends State<QRScannerPageImpl> {
  bool hasScanned = false;

  void _onDetect(BarcodeCapture capture) {
    if (capture.barcodes.isNotEmpty) {
      final code = capture.barcodes.first.rawValue;
      if (!hasScanned && code != null) {
        hasScanned = true;
        Navigator.pop(context, code);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(onDetect: _onDetect),
        ],
      ),
    );
  }
}
