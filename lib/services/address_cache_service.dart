import 'package:hive_flutter/hive_flutter.dart';
import '../models/address_model.dart';

class AddressCacheService {
  static const _boxName = 'address_cache';

  Future<Box> _openBox() async {
    return await Hive.openBox(_boxName);
  }

  Future<AddressModel?> get(String splitterCode) async {
    final box = await _openBox();
    final data = box.get(splitterCode);
    if (data == null) return null;

    return AddressModel.fromMap(Map<String, dynamic>.from(data));
  }

  Future<void> save(String splitterCode, AddressModel address) async {
    final box = await _openBox();
    await box.put(splitterCode, address.toMap());
  }
}
