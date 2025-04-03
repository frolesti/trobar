import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:location/location.dart';

// Bar model
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

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Location _locationController = Location();
  final Completer<GoogleMapController> _mapController =
      Completer<GoogleMapController>();
  static const LatLng _pGooglePlex = LatLng(41.390205, 2.154007);
  LatLng? _currentP;
  Map<PolylineId, Polyline> polylines = {};
  final Set<Marker> _markers = {};

  @override
  void initState() {
    super.initState();
    getLocationUpdates();
    fetchBars();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body:
          _currentP == null
              ? const Center(child: Text("Loading..."))
              : GoogleMap(
                onMapCreated:
                    (GoogleMapController controller) =>
                        _mapController.complete(controller),
                initialCameraPosition: const CameraPosition(
                  target: _pGooglePlex,
                  zoom: 13,
                ),
                markers: _markers,
                polylines: Set<Polyline>.of(polylines.values),
              ),
    );
  }

  Future<void> fetchBars() async {
    try {
      QuerySnapshot<Map<String, dynamic>> snapshot =
          await FirebaseFirestore.instance.collection('bars').get();
      List<Bar> bars =
          snapshot.docs.map((doc) => Bar.fromFirestore(doc.data())).toList();

      setState(() {
        _markers.addAll(bars.map((bar) => _createBarMarker(bar)));
      });
    } catch (e) {
      print("Error fetching bars: $e");
    }
  }

  Marker _createBarMarker(Bar bar) {
    return Marker(
      markerId: MarkerId(bar.name),
      position: LatLng(bar.latitude, bar.longitude),
      infoWindow: InfoWindow(
        title: bar.name,
        snippet: "Showing: ${bar.teamShowing}",
      ),
      icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
    );
  }

  Future<void> getLocationUpdates() async {
    bool serviceEnabled = await _locationController.serviceEnabled();
    if (!serviceEnabled) {
      serviceEnabled = await _locationController.requestService();
      if (!serviceEnabled) return;
    }

    PermissionStatus permissionGranted =
        await _locationController.hasPermission();
    if (permissionGranted == PermissionStatus.denied) {
      permissionGranted = await _locationController.requestPermission();
      if (permissionGranted != PermissionStatus.granted) return;
    }

    _locationController.onLocationChanged.listen((
      LocationData currentLocation,
    ) {
      if (currentLocation.latitude != null &&
          currentLocation.longitude != null) {
        setState(() {
          _currentP = LatLng(
            currentLocation.latitude!,
            currentLocation.longitude!,
          );
        });
      }
    });
  }
}
