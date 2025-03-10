import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiService {
  static const String baseUrl = "http://localhost:5000"; // Update for production

  static Future<String> getStatus() async {
    final response = await http.get(Uri.parse("$baseUrl/"));
    if (response.statusCode == 200) {
      return json.decode(response.body)['message'];
    } else {
      throw Exception("Failed to load data");
    }
  }
}
