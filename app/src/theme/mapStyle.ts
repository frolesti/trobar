import { EDITORIAL } from './editorialTheme';

export const CUSTOM_MAP_STYLE = [
    {
      "elementType": "geometry",
      "stylers": [{ "color": EDITORIAL.paperAlt }]
    },
    {
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": EDITORIAL.ink }]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [{ "color": EDITORIAL.paper }, { "weight": 2 }]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "landscape",
      "elementType": "geometry",
      "stylers": [{ "color": EDITORIAL.paperAlt }]
    },
    {
      "featureType": "landscape.natural",
      "elementType": "geometry",
      "stylers": [{ "color": EDITORIAL.paperAlt }]
    },
    {
      "featureType": "poi",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "poi.park",
      "elementType": "geometry",
      "stylers": [{ "visibility": "on" }, { "color": EDITORIAL.greenSoft }]
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [{ "visibility": "on" }, { "color": EDITORIAL.inkMuted }]
    },
    {
      "featureType": "road",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#FFFFFF" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": '#DEE5ED' }]
    },
    {
      "featureType": "road",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": EDITORIAL.inkMuted }]
    },
    {
      "featureType": "water",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#BBDDF0" }]
    },
    {
      "featureType": "water",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": EDITORIAL.inkMuted }]
    }
  ];
