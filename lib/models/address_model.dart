class AddressModel {
  final String? street;
  final String? neighborhood;
  final String? city;
  final String? state;
  final String? postalCode;

  AddressModel({
    this.street,
    this.neighborhood,
    this.city,
    this.state,
    this.postalCode,
  });

  factory AddressModel.fromMap(Map<String, dynamic> map) {
    return AddressModel(
      street: map['street'],
      neighborhood: map['neighborhood'],
      city: map['city'],
      state: map['state'],
      postalCode: map['postalCode'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'street': street,
      'neighborhood': neighborhood,
      'city': city,
      'state': state,
      'postalCode': postalCode,
    };
  }
}
