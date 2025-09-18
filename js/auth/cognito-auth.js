// js/auth/cognito-auth.js
import { COGNITO_CONFIG, AMPLIFY_CONFIG } from './cognito-config.js';

export class CognitoAuth {
  constructor() {
    this.amplify = null;
    this.currentUser = null;
    this.isInitialized = false;
    this.googleAccessToken = null;
    this.cognitoTokens = null;
  }

  async init() {
    console.log('🔐 Initializing Cognito authentication...');
    try {
      await this.waitForAmplify();
      this.configureAmplify();

      const callbackResult = await this.handleOAuthCallback();
      if (callbackResult.success) {
        console.log('🔐 ✅ OAuth callback handled successfully');
        this.isInitialized = true;
        return callbackResult;
      }

      const existingUser = await this.getCurrentSession();
      if (existingUser) {
        console.log('🔐 ✅ Found existing Cognito session:', existingUser.email);
        this.isInitialized = true;
        return { success: true, user: existingUser };
      }

      this.isInitialized = true;
      return { success: false, reason: 'no_existing_auth' };
    } catch (error) {
      console.error('🔐 ❌ Cognito initialization failed:', error);
      this.isInitialized = true;
      return { success: false, error: error.message };
    }
  }

  async waitForAmplify(maxAttempts = 50) {
    for (let i = 0; i < maxAttempts; i++) {
      if (window.aws && window.aws.amplifyAuth) {
        const auth = window.aws.amplifyAuth;
        if (auth.Amplify && auth.Auth) {
          this.amplify = auth;
          console.log('🔐 ✅ Amplify loaded');
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Amplify failed to load');
  }

  configureAmplify() {
    if (this.amplify.Amplify && typeof this.amplify.Amplify.configure === 'function') {
      this.amplify.Amplify.configure(AMPLIFY_CONFIG);
      console.log('🔐 ✅ Amplify configured');
    } else {
      throw new Error('Amplify.configure not found');
    }
  }

  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    if (!authCode) return { success: false, wasCallback: false };

    try {
      const user = await this.waitForAuthenticatedUser(10000);
      if (!user) throw new Error('No authenticated user after callback');

      const session = await this.amplify.Auth.currentSession();
      const userData = this.formatUserData(user, session);
      this.currentUser = userData;
      this.saveUserToStorage(userData);
      this.cleanupCallbackUrl();

      console.log('🔐 ✅ OAuth callback processed:', userData.email);
      return { success: true, user: userData, wasCallback: true };
    } catch (error) {
      console.error('🔐 ❌ OAuth callback failed:', error);
      this.cleanupCallbackUrl();
      return { success: false, error: error.message, wasCallback: true };
    }
  }

  async waitForAuthenticatedUser(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const user = await this.amplify.Auth.currentAuthenticatedUser();
        if (user) return user;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  }

  async getCurrentSession() {
    try {
      const user = await this.amplify.Auth.currentAuthenticatedUser();
      const session = await this.amplify.Auth.currentSession();
      if (!user || !session) return null;

      const userData = this.formatUserData(user, session);
      this.currentUser = userData;
      this.saveUserToStorage(userData);
      return userData;
    } catch {
      return null;
    }
  }

  formatUserData(cognitoUser, session) {
    const idPayload = session.getIdToken().payload || {};
    let googleToken = null;

    try {
      if (idPayload.identities) {
        const googleIdentity = idPayload.identities.find(i => i.providerName === 'Google');
        if (googleIdentity && googleIdentity.access_token) googleToken = googleIdentity.access_token;
      }
    } catch {}

    this.googleAccessToken = googleToken;

    return {
      id: cognitoUser.username,
      email: idPayload.email || cognitoUser.attributes?.email,
      name: idPayload.name || cognitoUser.attributes?.name || idPayload.email,
      picture: idPayload.picture || cognitoUser.attributes?.picture,
      given_name: idPayload.given_name || cognitoUser.attributes?.given_name,
      family_name: idPayload.family_name || cognitoUser.attributes?.family_name,
      username: cognitoUser.username,
      sub: idPayload.sub,
      authMethod: 'cognito',
      provider: 'google',
      googleAccessToken: googleToken,
      cognitoTokens: {
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken()
      },
      savedAt: Date.now(),
      lastSignIn: Date.now()
    };
  }

  saveUserToStorage(userData) {
    localStorage.setItem(COGNITO_CONFIG.storage.userDataKey, JSON.stringify(userData));
    console.log('🔐 ✅ User data saved');
  }

  cleanupCallbackUrl() {
    const cleanUrl = window.location.origin + window.location.pathname.replace('/oauth2/idpresponse', '');
    window.history.replaceState({}, document.title, cleanUrl || '/');
  }

  async signIn() {
    await this.amplify.Auth.federatedSignIn({ provider: 'Google' });
  }

  async signOut() {
    await this.amplify.Auth.signOut({ global: true });
    this.currentUser = null;
    this.googleAccessToken = null;
    this.cognitoTokens = null;
    localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
    console.log('🔐 ✅ Signed out');
  }

  getUser() { return this.currentUser; }
  isAuthenticated() { return !!this.currentUser; }
  getGoogleAccessToken() { return this.googleAccessToken; }
  getCognitoTokens() { return this.currentUser?.cognitoTokens || null; }
}
