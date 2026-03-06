// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package.json export map support in Metro!
config.resolver.unstable_enablePackageExports = true;
// Also add standard mjs and cjs to source extensions if needed
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
