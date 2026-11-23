module.exports = ({ config }) => {
  require('./scripts/devStart').prepareDirectExpoStart();
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (googleIosClientId && !/^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(googleIosClientId)) {
    throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ha de ser el client OAuth iOS de Google.');
  }
  const brandColors = require('./app/src/theme/brandColors.json');

  return {
    ...config,
    backgroundColor: brandColors.background,
    plugins: [
      ...(config.plugins || []).filter(plugin => !['expo-image', 'expo-notifications', 'expo-web-browser', 'expo-apple-authentication'].includes(Array.isArray(plugin) ? plugin[0] : plugin)).map(plugin => {
        const name = Array.isArray(plugin) ? plugin[0] : plugin;
        if (name === 'expo-splash-screen') return [name, { ...plugin[1], backgroundColor: brandColors.background }];
        if (name === '@react-native-google-signin/google-signin' && googleIosClientId) {
          return [name, { iosUrlScheme: googleIosClientId.split('.').reverse().join('.') }];
        }
        return plugin;
      }),
      'expo-apple-authentication',
      'expo-image',
      ['expo-notifications', { defaultChannel: 'trobar', color: '#A50044' }],
      'expo-web-browser',
      ['react-native-maps', { iosGoogleMapsApiKey: googleMapsApiKey, androidGoogleMapsApiKey: googleMapsApiKey }],
      './plugins/withMapQueries',
    ],
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        LSApplicationQueriesSchemes: [...new Set([...(config.ios?.infoPlist?.LSApplicationQueriesSchemes || []), 'comgooglemaps', 'maps', 'waze'])],
      },
    },
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config ? config.android.config : {}),
        googleMaps: googleMapsApiKey ? { apiKey: googleMapsApiKey } : {},
      },
    },
  };
};
