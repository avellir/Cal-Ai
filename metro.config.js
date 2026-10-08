const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The chart package's CommonJS build exports worklet functions before the
// worklets transform initializes them. Use its native source entry on web too.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-wagmi-charts') {
    return context.resolveRequest(context, 'react-native-wagmi-charts/src/index.ts', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
