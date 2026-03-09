import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import StartupScreen from '../screens/Startup/StartupScreen';
import MapScreen from '../screens/Map/MapScreen';
import MatchesScreen from '../screens/Matches/MatchesScreen';
import LoginModal from '../screens/LoginModal/LoginModal';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ReportBarScreen from '../screens/ReportBar/ReportBarScreen';
import { OSMBar } from '../services/osmService';
import { TermsOfService } from '../screens/Legal/TermsOfService';
import { PrivacyPolicy } from '../screens/Legal/PrivacyPolicy';
import NotFoundScreen from '../screens/NotFound/NotFoundScreen';

// Definir la llista de paràmetres del stack principal
export type RootStackParamList = {
  Startup: undefined;
  Map: { matchId?: string } | undefined;
  Matches: undefined;
  Login: undefined;
  Profile: undefined;
  ReportBar: { osmBar: OSMBar };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  NotFound: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// Configuració de linking per forçar el títol a 'troBar'
const linking = {
  prefixes: [],
  config: {
    screens: {
      Startup: '',
      Map: 'map',
      Login: 'login',
      Profile: 'profile',
      
      ReportBar: 'report',

      // Qualsevol ruta desconeguda → redirigeix a Startup (inici)
      NotFound: '*',
    },
  },
  documentTitle: {
    enabled: false, // Desactivar completament la gestió de títols de React Navigation
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator 
        initialRouteName="Startup"
        screenOptions={{
          headerShown: false,
          title: 'troBar', // Títol per defecte per a totes les pantalles
          // Això assegura que l'animació de lliscament lateral funcioni també a web
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
            // Quan naveguem cap a Matches, lliscar des de l'esquerra (com si estigués a l'esquerra)
            gestureDirection: 'horizontal-inverted',
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS
          }} 
        />
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{ title: 'troBar' }}
        />
        

        <Stack.Screen name="ReportBar" component={ReportBarScreen} options={{ title: 'bar', presentation: 'transparentModal', animationEnabled: false, headerShown: false, gestureEnabled: false, cardStyle: { backgroundColor: 'transparent' } }} />
        
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
        <Stack.Screen 
          name="NotFound" 
          component={NotFoundScreen} 
          options={{ title: 'troBar' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
