// SOBREESCRIPTURA AMB COLORS DE MARCA — TEMA "TOT VERD"
// Terra: Menta clar (#F0F7F4) -> Fons de l'app
// Text: Verd fosc bosquetà (#1B4D3E)
// Carrers: Blanc

export const CUSTOM_MAP_STYLE = [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#F0F7F4" }] // Color de terra per defecte
    },
    {
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#1B4D3E" }]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [{ "color": "#F0F7F4" }, { "weight": 2 }]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "landscape",
      "elementType": "geometry",
      "stylers": [{ "color": "#F0F7F4" }] // Fons de l'app
    },
    {
      "featureType": "landscape.natural",
      "elementType": "geometry",
      "stylers": [{ "color": "#F0F7F4" }]
    },
    {
      "featureType": "poi",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "poi.park",
      "elementType": "geometry",
      "stylers": [{ "visibility": "on" }, { "color": "#D8F3DC" }] // Menta lleugerament més fosc per a parcs
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [{ "visibility": "on" }, { "color": "#4BB577" }] // Etiqueta de verd de marca
    },
    {
      "featureType": "road",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#FFFFFF" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": "#E6ECDA" }] // Vora subtilment verdosa
    },
    {
      "featureType": "road",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#5C8D75" }] // Verd apagat per a noms de carrer
    },
    {
      "featureType": "water",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#C5E6E0" }] // Aqua
    },
    {
      "featureType": "water",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#5C8D75" }]
    }
  ];
