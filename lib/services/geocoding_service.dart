import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/address_model.dart';
import 'address_cache_service.dart';

class GeocodingService {
  static const _baseUrl = 'https://nominatim.openstreetmap.org/reverse';
  final AddressCacheService _cache = AddressCacheService();

  Future<AddressModel?> resolveAddress({
    required String splitterCode,
    required double lat,
    required double lng,
  }) async {
    try {
      final cached = await _cache.get(splitterCode);
      if (cached != null) return cached;

      final uri = Uri.parse(
        '$_baseUrl?format=json&lat=$lat&lon=$lng&addressdetails=1',
      );
      debugPrint('Consultando geocodificacao para $lat, $lng...');

      final response = await http.get(
        uri,
        headers: {
          'User-Agent': 'SplitterApp/1.0 (contato@sebratel.com.br)',
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode != 200) return null;

      final json = jsonDecode(response.body);
      final address = json['address'] ?? {};

      final model = AddressModel(
        street: address['road'] ?? address['pedestrian'],
        neighborhood: address['suburb'] ?? address['neighbourhood'],
        city: address['city'] ?? address['town'],
        state: address['state'],
        postalCode: address['postcode'],
      );

      await _cache.save(splitterCode, model);

      return model;
    } catch (_) {
      return null;
    }
  }
}
