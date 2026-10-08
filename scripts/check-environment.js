const fs = require('fs');
const path = require('path');
const { getEnvFiles, loadEnvFiles } = require('@expo/env');

const root = path.resolve(__dirname, '..');
loadEnvFiles(getEnvFiles({ mode: 'development' }).map(file => path.join(root, file)), { silent: true });
const config = require('../app.json').expo;
const configured = value => typeof value === 'string' && value.trim() !== '' && !/your_|placeholder/i.test(value);
let missing = 0;
function check(label, value) {
  const valid = configured(value);
  console.log(`${valid ? 'OK' : 'MISSING'}: ${label}`);
  if (!valid) missing++;
}
check('Supabase URL', process.env.EXPO_PUBLIC_SUPABASE_URL ?? config.extra?.supabaseUrl);
check('Supabase public key', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? config.extra?.supabaseAnonKey);
console.log('INFO: Deploy analyze-food and configure Azure secrets in Supabase (not checked locally).');
console.log('INFO: Nutrition lookup uses the built-in reference table; no FatSecret credentials are needed.');
const splash = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
for (const asset of [config.icon, config.web.favicon, config.android.adaptiveIcon.foregroundImage, config.android.adaptiveIcon.monochromeImage, splash.image]) {
  const exists = fs.existsSync(path.resolve(root, asset));
  console.log(`${exists ? 'OK' : 'MISSING'}: ${asset}`);
  if (!exists) missing++;
}
console.log('Values are never printed. This checks local configuration, not credential validity.');
process.exitCode = missing ? 1 : 0;
