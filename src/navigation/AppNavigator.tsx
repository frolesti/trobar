import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import StartupScreen from '../screens/Startup/StartupScreen';
import MapScreen from '../screens/Map/MapScreen';
import LoginModal from '../screens/LoginModal/LoginModal';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ClaimBusinessScreen from '../screens/ClaimBusiness/ClaimBusinessScreen';

// Define the root stack param list
export type RootStackParamList = {
  Startup: undefined;
  Map: undefined;
  Login: undefined;
  Profile: undefined;
  ClaimBusiness: { barId: string; barName: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Startup"
        screenOptions={{
          headerShown: false,
          // This ensures the lateral slide animation works on Web too
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        <Stack.Screen name="Startup" component={StartupScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen} 
        />
        <Stack.Screen name="ClaimBusiness" component={ClaimBusinessScreen} options={{ headerShown: true, title: 'Alta de Negoci', headerBackTitleVisible: false }} />
        
        <Stack.Screen 
          name="Login" 
          component={LoginModal} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
