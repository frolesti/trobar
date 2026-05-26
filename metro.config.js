// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package.json export map support in Metro!
config.resolver.unstable_enablePackageExports = true;
// Also add standard mjs and cjs to source extensions if needed
config.resolver.sourceExts.push('mjs', 'cjs');

// ─── Web shims for native-only modules ───────────────────────────
// When platform=web, redirect native modules to lightweight stubs
// so the app can load in a browser for debugging.
const shimDir = path.resolve(__dirname, 'app/src/shims');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const webShims = {
      'react-native-maps': path.resolve(shimDir, 'react-native-maps.web.tsx'),
      '@react-native-google-signin/google-signin': path.resolve(shimDir, 'google-signin.web.ts'),
      'expo-apple-authentication': path.resolve(shimDir, 'expo-apple-authentication.web.ts'),
      '@react-native-async-storage/async-storage': path.resolve(shimDir, 'async-storage.web.ts'),
    };
    if (webShims[moduleName]) {
      return {
        filePath: webShims[moduleName],
        type: 'sourceFile',
      };
    }
  }
  // Fall back to the default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
