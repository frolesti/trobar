class Bar {
  final String name;
  final double latitude;
  final double longitude;
  final String teamShowing;

  Bar({
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.teamShowing,
  });

  factory Bar.fromFirestore(Map<String, dynamic> data) {
    return Bar(
      name: data['name'],
      latitude: data['latitude'],
      longitude: data['longitude'],
      teamShowing: data['teamShowing'],
    );
  }
}
