import { SignInResource } from '@clerk/types';
declare const signIn: any;
async function test() {
  await signIn.create({ strategy: 'oauth_google', token: '123' });
  await signIn.create({ strategy: 'google_one_tap', token: '123' });
  await signIn.authenticateWithGoogleOneTap({ token: '123' });
}
