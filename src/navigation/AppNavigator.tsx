import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import StartupScreen from '../screens/Startup/StartupScreen';
import MapScreen from '../screens/Map/MapScreen';
import MatchesScreen from '../screens/Matches/MatchesScreen';
import LoginModal from '../screens/LoginModal/LoginModal';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ClaimBusinessScreen from '../screens/ClaimBusiness/ClaimBusinessScreen';
import ReportBarScreen from '../screens/ReportBar/ReportBarScreen';
import { OSMBar } from '../services/osmService';
import { TermsOfService } from '../screens/Legal/TermsOfService';
import { PrivacyPolicy } from '../screens/Legal/PrivacyPolicy';

// Define the root stack param list
export type RootStackParamList = {
  Startup: undefined;
  Map: { matchId?: string } | undefined;
  Matches: undefined;
  Login: undefined;
  Profile: undefined;
  ClaimBusiness: { barId: string; barName: string };
  ReportBar: { osmBar: OSMBar };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// Define linking configuration to force the title to 'troBar'
const linking = {
  prefixes: [],
  config: {
    screens: {
      Startup: '',
      Map: 'map',
      Login: 'login',
      Profile: 'profile',
      ClaimBusiness: 'claim-business',
      ReportBar: 'report',
    },
  },
  documentTitle: {
    enabled: false, // Completely disable React Navigation's title handling
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator 
        initialRouteName="Startup"
        screenOptions={{
          headerShown: false,
          title: 'troBar', // Default title for all screens
          // This ensures the lateral slide animation works on Web too
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        <Stack.Screen name="Startup" component={StartupScreen} options={{ title: 'troBar' }} />
        <Stack.Screen name="Map" component={MapScreen} options={{ title: 'troBar' }} />
        <Stack.Screen 
          name="Matches" 
          component={MatchesScreen} 
          options={{ 
            title: 'troBar',
            // When navigating TO Matches, slide from Left (as if it was on the left)
            gestureDirection: 'horizontal-inverted',
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS
          }} 
        />
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{ title: 'troBar' }}
        />
        <Stack.Screen name="ClaimBusiness" component={ClaimBusinessScreen} options={{ headerShown: true, title: 'Reclamar Negoci', headerBackTitleVisible: false, headerShadowVisible: false, headerStyle: { backgroundColor: '#F0F7F4' } }} />

        <Stack.Screen name="ReportBar" component={ReportBarScreen} options={{ title: 'troBar', presentation: 'transparentModal', headerShown: false, gestureEnabled: false, cardStyle: { backgroundColor: 'rgba(0,0,0,0.5)' } }} />
        
        <Stack.Screen 
          name="Login" 
          component={LoginModal} 
          options={{ title: 'troBar' }}
        />
        
        <Stack.Screen 
          name="TermsOfService" 
          component={TermsOfService} 
          options={{ title: 'Termes del Servei' }}
        />
        <Stack.Screen 
          name="PrivacyPolicy" 
          component={PrivacyPolicy} 
          options={{ title: 'Política de Privacitat' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
