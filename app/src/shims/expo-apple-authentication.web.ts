/**
 * Web shim for expo-apple-authentication.
 * Provides no-op stubs so the app can load on web for debugging.
 */

export const AppleAuthenticationScope = {
  FULL_NAME: 0,
  EMAIL: 1,
};

export async function isAvailableAsync(): Promise<boolean> {
  return false;
}

export async function signInAsync(_options?: any): Promise<any> {
  throw new Error('Apple Authentication is not available on web.');
}
