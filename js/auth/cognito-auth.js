// js/auth/cognito-auth.js
// CHANGE SUMMARY: Simplified for direct Google federation via Identity Pool (no User Pool needed)

import { COGNITO_CONFIG, AMPLIFY_CONFIG } from './cognito-config.js';

export class CognitoAuth {
  constructor() {
    this.amplify = null;
    this.currentUser = null;
    this.isInitialized = false;
    this.googleAccessToken = null;
    this.identityPoolCredentials = null;
  }

  async init() {
    console.log('🔐 Initializing Direct Google Federation via Identity Pool...');
    console.log('🔐 🆔 Identity Pool ID:', COGNITO_CONFIG.identityPoolId);
    
    try {
      await this.waitForAmplify();
      this.configureAmplify();

      // Check if we're coming back from Google OAuth
      const urlParams = new URLSearchParams(window.location.search);
      const authCode = urlParams.get('code');
      
      if (authCode) {
        console.log('🔐 📨 Found Google OAuth callback with code');
        const result = await this.handleGoogleCallback(authCode);
        if (result.success) {
          console.log('🔐 ✅ Google OAuth callback processed successfully');
          this.isInitialized = true;
          return result;
        }
      }

      // Check for existing session
      const existingUser = await this.getCurrentSession();
      if (existingUser) {
        console.log('🔐 ✅ Found existing Google session:', existingUser.email);
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

  async init() {
    console.log('🔐 Initializing Direct Google Federation via Identity Pool...');
    console.log('🔐 🆔 Identity Pool ID:', COGNITO_CONFIG.identityPoolId);
    
    try {
      await this.waitForAmplify();
      this.configureAmplify();

      // Check if we're coming back from Google OAuth (URL fragment method)
      const urlFragment = window.location.hash;
      const urlParams = new URLSearchParams(window.location.search);
      
      if (urlFragment && urlFragment.includes('access_token')) {
        console.log('🔐 📨 Found Google OAuth callback in URL fragment');
        const result = await this.handleGoogleFragmentCallback(urlFragment);
        if (result.success) {
          console.log('🔐 ✅ Google OAuth fragment callback processed successfully');
          this.isInitialized = true;
          return result;
        }
      }

      // Check for existing session
      const existingUser = await this.getCurrentSession();
      if (existingUser) {
        console.log('🔐 ✅ Found existing Google session:', existingUser.email);
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

  async handleGoogleFragmentCallback(fragment) {
    console.log('🔐 📨 Processing Google OAuth fragment callback...');
    
    try {
      // Parse the fragment for tokens
      const params = new URLSearchParams(fragment.substring(1)); // Remove the #
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');
      
      if (!accessToken || !idToken) {
        throw new Error('Missing tokens in Google OAuth callback');
      }
      
      console.log('🔐 📨 ✅ Google tokens found in fragment');
      console.log('🔐 📨 📋 Access token length:', accessToken.length);
      console.log('🔐 📨 📋 ID token length:', idToken.length);
      
      // Now federate with Cognito Identity Pool using the Google ID token
      const federatedUser = await this.amplify.Auth.federatedSignIn(
        'google', // provider
        { 
          token: idToken,
          expires_at: Date.now() + (3600 * 1000) // 1 hour from now
        }
      );
      
      console.log('🔐 📨 ✅ Successfully federated with Cognito Identity Pool');
      
      // Get the AWS credentials
      const credentials = await this.amplify.Auth.currentCredentials();
      console.log('🔐 📨 ✅ AWS credentials obtained');
      
      // Build user data using the Google access token
      const userData = await this.buildUserDataFromGoogleToken(accessToken, credentials);
      this.currentUser = userData;
      this.saveUserToStorage(userData);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return { success: true, user: userData };
      
    } catch (error) {
      console.error('🔐 📨 ❌ Google fragment callback processing failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGoogleCodeCallback(authCode) {
    console.log('🔐 📨 Processing Google OAuth code callback...');
    
    try {
      // Exchange the authorization code for Google tokens
      const googleClientId = '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com';
      const redirectUri = window.location.origin;
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: googleClientId,
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      
      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }
      
      const tokens = await tokenResponse.json();
      console.log('🔐 📨 ✅ Google tokens received');
      console.log('🔐 📨 📋 Access token length:', tokens.access_token?.length || 0);
      console.log('🔐 📨 📋 ID token length:', tokens.id_token?.length || 0);
      
      // Now federate with Cognito Identity Pool using the Google ID token
      const federatedUser = await this.amplify.Auth.federatedSignIn(
        'google', // provider
        { 
          token: tokens.id_token,
          expires_at: Date.now() + (tokens.expires_in * 1000) // Use actual expiration
        }
      );
      
      console.log('🔐 📨 ✅ Successfully federated with Cognito Identity Pool');
      
      // Get the AWS credentials
      const credentials = await this.amplify.Auth.currentCredentials();
      console.log('🔐 📨 ✅ AWS credentials obtained');
      
      // Build user data using the Google access token
      const userData = await this.buildUserDataFromGoogleToken(tokens.access_token, credentials);
      this.currentUser = userData;
      this.saveUserToStorage(userData);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return { success: true, user: userData };
      
    } catch (error) {
      console.error('🔐 📨 ❌ Google code callback processing failed:', error);
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
      console.log('🔐 🆔 Configuring Amplify for direct Google federation...');
      
      // Simplified config for direct Google federation - remove User Pool settings
      const directGoogleConfig = {
        Auth: {
          region: COGNITO_CONFIG.region,
          identityPoolId: COGNITO_CONFIG.identityPoolId,
          // No User Pool settings needed for direct federation
          mandatorySignIn: false
        }
      };
      
      console.log('🔐 🆔 📋 Using simplified config:', {
        region: directGoogleConfig.Auth.region,
        identityPoolId: directGoogleConfig.Auth.identityPoolId,
        mandatorySignIn: directGoogleConfig.Auth.mandatorySignIn
      });
      
      this.amplify.Amplify.configure(directGoogleConfig);
      console.log('🔐 ✅ Amplify configured for direct Google federation');
    } else {
      throw new Error('Amplify.configure not found');
    }
  }

  async getCurrentSession() {
    try {
      console.log('🔐 🔄 Checking for existing Google session...');
      
      // First, check if we have saved user data with Google token
      const savedUserData = localStorage.getItem(COGNITO_CONFIG.storage.userDataKey);
      if (savedUserData) {
        try {
          const userData = JSON.parse(savedUserData);
          console.log('🔐 📋 Found saved user data:', {
            email: userData.email,
            hasGoogleToken: !!userData.googleAccessToken,
            authMethod: userData.authMethod,
            savedAt: new Date(userData.savedAt).toLocaleString()
          });
          
          if (userData.googleAccessToken && userData.authMethod === 'cognito_identity_pool') {
            console.log('🔐 🔄 Attempting to restore Identity Pool session with saved Google token...');
            
            // Try to restore the federated session using saved Google token
            // We need the ID token for federation, but we might only have access token
            // Let's try to get fresh credentials first
            try {
              const credentials = await this.amplify.Auth.currentCredentials();
              if (credentials.authenticated) {
                console.log('🔐 ✅ Found existing Identity Pool session!');
                
                // Update the saved user data with current credentials
                userData.awsCredentials = {
                  accessKeyId: credentials.accessKeyId,
                  secretAccessKey: credentials.secretAccessKey,
                  sessionToken: credentials.sessionToken,
                  identityId: credentials.identityId
                };
                
                this.currentUser = userData;
                this.googleAccessToken = userData.googleAccessToken;
                this.identityPoolCredentials = credentials;
                
                // Update storage with fresh AWS credentials
                this.saveUserToStorage(userData);
                
                return userData;
              }
            } catch (credentialsError) {
              console.log('🔐 ⚠️ No existing Identity Pool session, saved data exists but session expired');
              
              // If we have saved user data but no active session, 
              // we could try to re-authenticate with the saved Google token
              // But for security, it's better to require re-authentication
              console.log('🔐 ℹ️ Will require re-authentication for security');
            }
          }
        } catch (parseError) {
          console.log('🔐 ⚠️ Failed to parse saved user data:', parseError.message);
          localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
        }
      }
      
      // If no saved data or session restoration failed, try fresh credentials
      try {
        const credentials = await this.amplify.Auth.currentCredentials();
        
        console.log('🔐 📋 Credentials check:', {
          authenticated: credentials.authenticated,
          identityId: credentials.identityId,
          hasParams: !!credentials.params,
          hasLogins: !!(credentials.params && credentials.params.Logins),
          paramsKeys: credentials.params ? Object.keys(credentials.params) : [],
          loginKeys: credentials.params?.Logins ? Object.keys(credentials.params.Logins) : []
        });
        
        if (credentials.authenticated && credentials.params && credentials.params.Logins) {
          const loginProviders = Object.keys(credentials.params.Logins);
          console.log('🔐 📋 Available login providers:', loginProviders);
          
          const googleToken = credentials.params.Logins['accounts.google.com'];
          
          if (googleToken) {
            console.log('🔐 ✅ Found existing Google token in active session!');
            console.log('🔐 📋 Token length:', googleToken.length);
            
            // Create user data from active Google token
            const userData = await this.buildUserDataFromGoogleToken(googleToken, credentials);
            this.currentUser = userData;
            this.saveUserToStorage(userData);
            
            return userData;
          } else {
            console.log('🔐 ❌ No Google token found in login providers');
          }
        } else {
          console.log('🔐 ❌ Missing authentication data:', {
            authenticated: credentials.authenticated,
            hasParams: !!credentials.params,
            hasLogins: !!(credentials.params && credentials.params.Logins)
          });
        }
      } catch (credentialsError) {
        // This error is expected if user is not authenticated
        if (credentialsError.message.includes('Unauthenticated access is not supported') || 
            credentialsError.message.includes('NotAuthorizedException')) {
          console.log('🔐 ℹ️ No active Identity Pool session - user needs to authenticate with Google');
        } else {
          console.log('🔐 ⚠️ Credentials check error:', credentialsError.message);
        }
      }
      
      console.log('🔐 ⚠️ No existing Google session found');
      return null;
      
    } catch (error) {
      console.log('🔐 ⚠️ Session check error:', error.message);
      return null;
    }
  }

  async buildUserDataFromGoogleToken(googleToken, credentials) {
    console.log('🔐 📝 Building user data from Google token...');
    
    try {
      // Get user info from Google using the access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${googleToken}`
        }
      });
      
      if (!userInfoResponse.ok) {
        throw new Error(`Google userinfo failed: ${userInfoResponse.status}`);
      }
      
      const userInfo = await userInfoResponse.json();
      console.log('🔐 📋 Google user info:', {
        email: userInfo.email,
        name: userInfo.name,
        picture: !!userInfo.picture
      });
      
      // Store the Google token
      this.googleAccessToken = googleToken;
      this.identityPoolCredentials = credentials;
      
      const userData = {
        id: credentials.identityId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        username: userInfo.email,
        sub: userInfo.id,
        authMethod: 'cognito_identity_pool',
        provider: 'google',
        googleAccessToken: googleToken,
        awsCredentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
          identityId: credentials.identityId
        },
        savedAt: Date.now(),
        lastSignIn: Date.now()
      };
      
      console.log('🔐 📝 ✅ User data built successfully:', {
        email: userData.email,
        name: userData.name,
        hasGoogleToken: !!userData.googleAccessToken,
        hasAwsCredentials: !!userData.awsCredentials,
        identityId: userData.awsCredentials.identityId
      });
      
      return userData;
      
    } catch (error) {
      console.error('🔐 📝 ❌ Failed to build user data:', error);
      throw error;
    }
  }

  async refreshSession() {
    console.log('🔐 🔄 Refreshing Google session via Identity Pool...');
    
    try {
      // Clear any cached credentials to force refresh
      await this.amplify.Auth.clearCachedId();
      
      // Get fresh credentials - Cognito will automatically refresh Google token if needed
      const credentials = await this.amplify.Auth.currentCredentials();
      
      if (credentials.authenticated && credentials.params && credentials.params.Logins) {
        const googleToken = credentials.params.Logins['accounts.google.com'];
        
        if (googleToken) {
          console.log('🔐 🔄 ✅ Google token refreshed successfully');
          
          const userData = await this.buildUserDataFromGoogleToken(googleToken, credentials);
          this.currentUser = userData;
          this.saveUserToStorage(userData);
          
          return true;
        }
      }
      
      throw new Error('No Google token after refresh');
      
    } catch (error) {
      console.error('🔐 🔄 ❌ Session refresh failed:', error);
      return false;
    }
  }

  saveUserToStorage(userData) {
    localStorage.setItem(COGNITO_CONFIG.storage.userDataKey, JSON.stringify(userData));
    console.log('🔐 ✅ User data saved to localStorage');
  }

  async signIn() {
    console.log('🔐 🔄 Starting Google sign-in for Identity Pool federation...');
    
    try {
      // Step 1: Get Google OAuth token manually
      const googleClientId = '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com';
      const redirectUri = encodeURIComponent(window.location.origin);
      // Start with minimal scopes to test
      const scopes = encodeURIComponent('openid email profile');
      
      const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${googleClientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=id_token token&` +  // Back to implicit flow - no client secret needed
        `scope=${scopes}&` +
        `prompt=consent&` +
        `nonce=${Date.now()}`;  // Add nonce for security
      
      console.log('🔐 🔄 Redirecting to Google OAuth for Identity Pool federation...');
      console.log('🔐 📋 OAuth URL:', googleOAuthUrl);
      
      // Store that we're doing Identity Pool auth
      localStorage.setItem('dashie_auth_method', 'identity_pool');
      
      // Redirect to Google
      window.location.href = googleOAuthUrl;
      
    } catch (error) {
      console.error('🔐 ❌ Google sign-in failed:', error);
      throw error;
    }
  }

  async signOut() {
    console.log('🔐 🔄 Signing out from Google...');
    
    try {
      await this.amplify.Auth.signOut();
      
      // Clear local state
      this.currentUser = null;
      this.googleAccessToken = null;
      this.identityPoolCredentials = null;
      
      // Clear localStorage
      localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
      
      console.log('🔐 ✅ Signed out successfully');
      
    } catch (error) {
      console.error('🔐 ❌ Sign out failed:', error);
      // Still clear local state even if remote sign-out fails
      this.currentUser = null;
      this.googleAccessToken = null;
      this.identityPoolCredentials = null;
      localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
    }
  }

  getUser() { return this.currentUser; }
  isAuthenticated() { return !!this.currentUser; }
  getGoogleAccessToken() { return this.googleAccessToken; }
  getAwsCredentials() { return this.currentUser?.awsCredentials || null; }
}
