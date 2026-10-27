module.exports = ({ config }) => {
  require('./scripts/devStart').prepareDirectExpoStart();
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const brandColors = require('./app/src/theme/brandColors.json');

  return {
    ...config,
    backgroundColor: brandColors.background,
    plugins: [
      ...(config.plugins || []).filter(plugin => !['expo-image', 'expo-notifications', 'expo-web-browser'].includes(Array.isArray(plugin) ? plugin[0] : plugin)).map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen' ? [plugin[0], { ...plugin[1], backgroundColor: brandColors.background }] : plugin),
      'expo-image',
      ['expo-notifications', { defaultChannel: 'trobar', color: '#A50044' }],
      'expo-web-browser',
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
