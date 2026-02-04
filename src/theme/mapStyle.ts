// OVERRIDE WITH BRAND COLORS - "ALL GREEN" THEME
// Land: Light Mint (#F0F7F4) -> Matches App Background
// Text: Deep Forest Green (#1B4D3E)
// Roads: White

export const CUSTOM_MAP_STYLE = [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#F0F7F4" }] // Default Land color
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
      "stylers": [{ "color": "#F0F7F4" }] // App Background
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
      "stylers": [{ "visibility": "on" }, { "color": "#D8F3DC" }] // Slightly Darker Mint for Parks
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [{ "visibility": "on" }, { "color": "#4BB577" }] // Brand Green Label
    },
    {
      "featureType": "road",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#FFFFFF" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": "#E6ECDA" }] // Subtle Green-ish border
    },
    {
      "featureType": "road",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#5C8D75" }] // Muted Green for road names
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
