import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QRScannerPageImpl extends StatefulWidget {
  const QRScannerPageImpl({super.key});
  @override
  State<QRScannerPageImpl> createState() => _QRScannerPageImplState();
}

class _QRScannerPageImplState extends State<QRScannerPageImpl>
    with WidgetsBindingObserver {
  late final MobileScannerController controller;
  bool hasScanned = false;
  bool torchOn = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    controller.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (hasScanned) return;
    final barcodes = capture.barcodes;
    if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
      hasScanned = true;
      final code = barcodes.first.rawValue!;
      controller.stop();
      Navigator.pop(context, code);
    }
  }

  void _toggleTorch() {
    controller.toggleTorch();
    setState(() {
      torchOn = !torchOn;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(
            controller: controller,
            onDetect: _onDetect,
          ),
          Positioned(
            top: 40,
            right: 20,
            child: IconButton(
              icon: Icon(
                torchOn ? Icons.flash_on : Icons.flash_off,
                color: Colors.white,
                size: 30,
              ),
              onPressed: _toggleTorch,
            ),
          ),
          Positioned(
            top: 40,
            left: 20,
            child: IconButton(
              icon:
                  const Icon(Icons.cameraswitch, color: Colors.white, size: 30),
              onPressed: () => controller.switchCamera(),
            ),
          ),
        ],
      ),
    );
  }
}
