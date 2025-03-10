import 'package:flutter/material.dart';
import 'services/api_service.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(home: HomeScreen());
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  HomeScreenState createState() => HomeScreenState(); // Update this to use HomeScreenState (public)
}

class HomeScreenState extends State<HomeScreen> {
  // Remove the leading underscore
  String status = "Loading...";

  @override
  void initState() {
    super.initState();
    fetchData();
  }

  void fetchData() async {
    try {
      String response = await ApiService.getStatus();
      setState(() {
        status = response;
      });
    } catch (e) {
      setState(() {
        status = "Error loading API";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Sports Bar Finder")),
      body: Center(child: Text(status)),
    );
  }
}
