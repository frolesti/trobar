// SOBREESCRIPTURA AMB COLORS DE MARCA — TEMA BLAUGRANA
// Terra: Crema càlid (#F5F2EE) -> Fons de l'app
// Text: Blau fosc (#1A1A2E)
// Carrers: Blanc

export const CUSTOM_MAP_STYLE = [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#F5F2EE" }] // Color de terra per defecte
    },
    {
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#1A1A2E" }]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [{ "color": "#F5F2EE" }, { "weight": 2 }]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "landscape",
      "elementType": "geometry",
      "stylers": [{ "color": "#F5F2EE" }] // Fons de l'app
    },
    {
      "featureType": "landscape.natural",
      "elementType": "geometry",
      "stylers": [{ "color": "#F5F2EE" }]
    },
    {
      "featureType": "poi",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "poi.park",
      "elementType": "geometry",
      "stylers": [{ "visibility": "on" }, { "color": "#E8E4D9" }] // Crema lleugerament més fosc per a parcs
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [{ "visibility": "on" }, { "color": "#004d98" }] // Blau Barça per a etiquetes de parc
    },
    {
      "featureType": "road",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#FFFFFF" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": "#E2DDD5" }] // Vora suau càlida
    },
    {
      "featureType": "road",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#6B7280" }] // Gris neutre per a noms de carrer
    },
    {
      "featureType": "water",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#B3D4E8" }] // Blau clar suau
    },
    {
      "featureType": "water",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#004d98" }] // Blau Barça
    }
  ];
