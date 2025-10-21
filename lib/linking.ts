import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

const expoScheme =
  Constants.expoConfig?.scheme ??
  Constants.expoConfig?.slug ??
  Constants.manifest?.scheme ??
  'calai';

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest?.hostUri ?? null;

export function getAuthRedirectUrl() {
  if (isExpoGo) {
    if (hostUri) {
      return `exp://${hostUri}/--/auth-callback`;
    }

    // Fallback when hostUri is unavailable (e.g., web preview)
    return Linking.createURL('/auth-callback', { scheme: 'exp' });
  }

  return Linking.createURL('/auth-callback', { scheme: expoScheme });
}
