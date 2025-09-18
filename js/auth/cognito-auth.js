// js/auth/cognito-auth.js
// CHANGE SUMMARY: Fixed OAuth callback handling to properly process authorization code and wait for Cognito session

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
    console.log('🔐 Initializing AWS Cognito authentication...');
    
    try {
      // Wait for Amplify to be loaded
      await this.waitForAmplify();
      
      // Configure Amplify
      await this.configureAmplify();
      
      // FIRST: Check if we're handling an OAuth callback
      const callbackResult = await this.handleOAuthCallback();
      if (callbackResult.success) {
        console.log('🔐 ✅ OAuth callback handled successfully');
        this.isInitialized = true;
        return callbackResult;
      }
      
      // SECOND: Check for existing session (only if no callback)
      if (!callbackResult.wasCallback) {
        const existingUser = await this.getCurrentSession();
        if (existingUser) {
          console.log('🔐 ✅ Found existing Cognito session:', existingUser.username);
          this.currentUser = existingUser;
          this.isInitialized = true;
          return { success: true, user: existingUser };
        }
      }
      
      console.log('🔐 No existing authentication found');
      this.isInitialized = true;
      return { success: false, reason: 'no_existing_auth' };
      
    } catch (error) {
      console.error('🔐 ❌ Cognito initialization failed:', error);
      this.isInitialized = true;
      return { success: false, error: error.message };
    }
  }

  async waitForAmplify(maxAttempts = 50) {
    console.log('🔍 Waiting for Amplify to load...');
    
    for (let i = 0; i < maxAttempts; i++) {
      if (window.aws && window.aws.amplifyAuth) {
        const auth = window.aws.amplifyAuth;
        
        if (auth.Amplify && auth.Auth) {
          this.amplify = auth;
          console.log('🔐 ✅ Amplify loaded successfully');
          return;
        }
      }
      
      if (i < 5) {
        console.log(`🔍 Attempt ${i + 1}: Still waiting for Amplify...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('AWS Amplify failed to load within timeout');
  }

  async configureAmplify() {
    console.log('🔐 Configuring Amplify...');
    
    try {
      if (this.amplify.Amplify && typeof this.amplify.Amplify.configure === 'function') {
        this.amplify.Amplify.configure(AMPLIFY_CONFIG);
        console.log('🔐 ✅ Amplify configured successfully');
        return;
      }
      
      throw new Error('Amplify.configure method not found');
      
    } catch (error) {
      console.error('🔐 ❌ Amplify configuration failed:', error);
      throw error;
    }
  }

  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    // Check if this is a callback URL
    const isCallback = authCode || error || window.location.pathname === '/oauth2/idpresponse';
    
    if (!isCallback) {
      console.log('🔐 Not an OAuth callback URL');
      return { success: false, reason: 'no_callback', wasCallback: false };
    }
    
    console.log('🔐 🔄 Processing OAuth callback...', {
      hasCode: !!authCode,
      hasError: !!error,
      pathname: window.location.pathname,
      searchParams: window.location.search
    });
    
    // Handle OAuth errors
    if (error) {
      console.error('🔐 ❌ OAuth callback error:', {
        error,
        errorDescription,
        fullUrl: window.location.href
      });
      
      // Clean up URL and show error
      this.cleanupCallbackUrl();
      return { 
        success: false, 
        error: `OAuth error: ${error} - ${errorDescription}`, 
        wasCallback: true 
      };
    }
    
    // Handle successful callback with authorization code
    if (authCode) {
      console.log('🔐 ✅ Authorization code received, waiting for Cognito to process...');
      
      try {
        // Wait for Cognito to process the authorization code
        // This can take a moment, so we'll poll for the authenticated user
        const user = await this.waitForAuthenticatedUser(10000); // 10 second timeout
        
        if (user) {
          const userData = this.formatUserData(user);
          this.currentUser = userData;
          this.saveUserToStorage(userData);
          
          // Clean up the callback URL
          this.cleanupCallbackUrl();
          
          console.log('🔐 ✅ OAuth callback processed successfully:', userData.email);
          return { success: true, user: userData, wasCallback: true };
        } else {
          throw new Error('Failed to get authenticated user after authorization code processing');
        }
        
      } catch (error) {
        console.error('🔐 ❌ Failed to process authorization code:', error);
        this.cleanupCallbackUrl();
        return { 
          success: false, 
          error: `Authorization code processing failed: ${error.message}`, 
          wasCallback: true 
        };
      }
    }
    
    return { success: false, reason: 'callback_processing_failed', wasCallback: true };
  }

  async waitForAuthenticatedUser(timeoutMs = 10000) {
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      attempts++;
      
      try {
        console.log(`🔐 🔄 Attempt ${attempts}: Checking for authenticated user...`);
        
        const user = await this.amplify.Auth.currentAuthenticatedUser();
        if (user) {
          console.log('🔐 ✅ Authenticated user found:', user.username);
          
          // Also get the session for tokens
          const session = await this.amplify.Auth.currentSession();
          if (session) {
            this.cognitoTokens = {
              idToken: session.getIdToken().getJwtToken(),
              accessToken: session.getAccessToken().getJwtToken(),
              refreshToken: session.getRefreshToken().getToken()
            };
            
            // Try to extract Google access token
            await this.extractGoogleAccessToken(session);
          }
          
          return user;
        }
      } catch (error) {
        if (error.message !== 'The user is not authenticated') {
          console.warn(`🔐 ⚠️ Attempt ${attempts} error:`, error.message);
        }
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.error('🔐 ❌ Timeout waiting for authenticated user');
    return null;
  }

  async getCurrentSession() {
    try {
      const user = await this.amplify.Auth.currentAuthenticatedUser();
      if (user) {
        const session = await this.amplify.Auth.currentSession();
        
        this.cognitoTokens = {
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken()
        };
        
        await this.extractGoogleAccessToken(session);
        
        const userData = this.formatUserData(user);
        this.currentUser = userData;
        this.saveUserToStorage(userData);
        
        return userData;
      }
    } catch (error) {
      if (error.message !== 'The user is not authenticated') {
        console.error('🔐 Error getting current session:', error);
      }
    }
    return null;
  }

  async extractGoogleAccessToken(session) {
    try {
      // Try multiple methods to get Google access token
      
      // Method 1: Check credentials
      try {
        const credentials = await this.amplify.Auth.currentCredentials();
        if (credentials && credentials.params && credentials.params.google_access_token) {
          this.googleAccessToken = credentials.params.google_access_token;
          console.log('🔐 ✅ Google access token extracted from credentials');
          return;
        }
      } catch (credError) {
        console.log('🔐 Method 1 (credentials) failed:', credError.message);
      }
      
      // Method 2: Check ID token payload
      try {
        const idToken = session.getIdToken();
        const payload = idToken.payload;
        
        if (payload && payload.identities) {
          const googleIdentity = payload.identities.find(id => id.providerName === 'Google');
          if (googleIdentity && googleIdentity.access_token) {
            this.googleAccessToken = googleIdentity.access_token;
            console.log('🔐 ✅ Google access token extracted from ID token');
            return;
          }
        }
      } catch (tokenError) {
        console.log('🔐 Method 2 (ID token) failed:', tokenError.message);
      }
      
      console.log('🔐 ⚠️ No Google access token found - this is expected with basic scopes');
      
    } catch (error) {
      console.error('🔐 ❌ Failed to extract Google access token:', error);
    }
  }

  formatUserData(cognitoUser) {
    const attributes = cognitoUser.attributes || {};
    
    return {
      id: cognitoUser.username,
      email: attributes.email,
      name: attributes.name || attributes.email,
      picture: attributes.picture,
      given_name: attributes.given_name,
      family_name: attributes.family_name,
      username: cognitoUser.username,
      sub: attributes.sub,
      authMethod: 'cognito',
      provider: 'google',
      googleAccessToken: this.googleAccessToken,
      cognitoTokens: this.cognitoTokens,
      savedAt: Date.now(),
      lastSignIn: Date.now()
    };
  }

  saveUserToStorage(userData) {
    try {
      localStorage.setItem(COGNITO_CONFIG.storage.userDataKey, JSON.stringify(userData));
      console.log('🔐 ✅ User data saved to localStorage');
    } catch (error) {
      console.error('🔐 ❌ Failed to save user data:', error);
    }
  }

  getSavedUser() {
    try {
      const saved = localStorage.getItem(COGNITO_CONFIG.storage.userDataKey);
      if (saved) {
        const userData = JSON.parse(saved);
        
        // Check if data is not too old (30 days)
        if (userData.savedAt && (Date.now() - userData.savedAt < 30 * 24 * 60 * 60 * 1000)) {
          return userData;
        } else {
          console.log('🔐 Saved user data expired, removing...');
          localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
        }
      }
    } catch (error) {
      console.error('🔐 ❌ Failed to load saved user:', error);
    }
    return null;
  }

  cleanupCallbackUrl() {
    // Remove OAuth parameters from URL
    const cleanUrl = window.location.origin + window.location.pathname.replace('/oauth2/idpresponse', '');
    window.history.replaceState({}, document.title, cleanUrl || '/');
    console.log('🔐 🧹 Cleaned up callback URL');
  }

  async signIn() {
    try {
      console.log('🔐 Starting Cognito sign-in...');
      await this.amplify.Auth.federatedSignIn({ provider: 'Google' });
    } catch (error) {
      console.error('🔐 ❌ Sign-in failed:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      console.log('🔐 Signing out from Cognito...');
      
      await this.amplify.Auth.signOut({ global: true });
      
      this.currentUser = null;
      this.googleAccessToken = null;
      this.cognitoTokens = null;
      
      localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
      localStorage.removeItem(COGNITO_CONFIG.storage.sessionKey);
      
      console.log('🔐 ✅ Sign-out completed');
      
    } catch (error) {
      console.error('🔐 ❌ Sign-out failed:', error);
      throw error;
    }
  }

  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getGoogleAccessToken() {
    return this.googleAccessToken;
  }

  getCognitoTokens() {
    return this.cognitoTokens;
  }

  async refreshSession() {
    try {
      console.log('🔐 🔄 Refreshing Cognito session...');
      const session = await this.amplify.Auth.currentSession();
      
      this.cognitoTokens = {
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken()
      };
      
      await this.extractGoogleAccessToken(session);
      
      if (this.currentUser) {
        this.currentUser.cognitoTokens = this.cognitoTokens;
        this.currentUser.googleAccessToken = this.googleAccessToken;
        this.saveUserToStorage(this.currentUser);
      }
      
      console.log('🔐 ✅ Session refreshed successfully');
      return true;
      
    } catch (error) {
      console.error('🔐 ❌ Session refresh failed:', error);
      return false;
    }
  }
}
