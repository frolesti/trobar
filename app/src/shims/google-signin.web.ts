/**
 * Web shim for @react-native-google-signin/google-signin.
 * Provides no-op stubs so the app can load on web for debugging.
 */

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

export const GoogleSignin = {
  configure: (_options?: any) => {},
  hasPlayServices: async (_opts?: any) => true,
  signIn: async () => {
    throw new Error('Google Sign-In is not available on web. Please use the Android/iOS app.');
  },
  signOut: async () => {},
  revokeAccess: async () => {},
  isSignedIn: async () => false,
  getCurrentUser: () => null,
  getTokens: async () => ({ idToken: '', accessToken: '' }),
};

export function isErrorWithCode(error: any): error is { code: string } {
  return error && typeof error.code === 'string';
}

export default GoogleSignin;
