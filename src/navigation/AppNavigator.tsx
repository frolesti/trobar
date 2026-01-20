import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StartupScreen from '../screens/StartupScreen';
import MapScreen from '../screens/MapScreen';
import LoginModal from '../screens/LoginModal';
import ProfileScreen from '../screens/ProfileScreen';
import ClaimBusinessScreen from '../screens/ClaimBusinessScreen';

// Define the root stack param list
export type RootStackParamList = {
  Startup: undefined;
  Map: undefined;
  Login: undefined;
  Profile: undefined;
  ClaimBusiness: { barId: string; barName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Startup"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Startup" component={StartupScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="ClaimBusiness" component={ClaimBusinessScreen} options={{ headerShown: true, title: 'Alta de Negoci', headerBackTitleVisible: false }} />
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
            <Stack.Screen name="Login" component={LoginModal} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
