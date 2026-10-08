module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // This plugin must be listed LAST.
      'react-native-worklets/plugin',
    ],
  };
};
