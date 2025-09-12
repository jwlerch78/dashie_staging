// js/auth/auth-manager.js - Production Auth with Device Flow Priority

import { NativeAuth } from './native-auth.js';
import { WebAuth } from './web-auth.js';
import { AuthUI } from './auth-ui.js';
import { AuthStorage } from './auth-storage.js';
import { DeviceFlowAuth } from './device-flow-auth.js';

export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isSignedIn = false;
    this.isWebView = this.detectWebView();
    this.hasNativeAuth = this.detectNativeAuth();
    this.isFireTV = this.detectFireTV();
    this.settingsInitialized = false; // ✅ NEW: Prevent duplicate settings init

    
    // Initialize auth modules
    this.storage = new AuthStorage();
    this.ui = new AuthUI();
    this.nativeAuth = this.hasNativeAuth ? new NativeAuth() : null;
    this.webAuth = new WebAuth();
    this.deviceFlowAuth = new DeviceFlowAuth();
    
    this.nativeAuthFailed = false;

    this.googleAccessToken = null; // Store the Google access token for RLS authentication with Supabase
    
    this.init();
  }

  detectWebView() {
    const userAgent = navigator.userAgent;
    const isAndroidWebView = /wv/.test(userAgent) || 
                           /Android.*AppleWebKit(?!.*Chrome)/.test(userAgent) ||
                           userAgent.includes('DashieApp');
    const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/.test(userAgent);
    
    console.log('🔐 Environment detection:', {
      userAgent: userAgent,
      isAndroidWebView: isAndroidWebView,
      isIOSWebView: isIOSWebView,
      isWebView: isAndroidWebView || isIOSWebView
    });
    
    return isAndroidWebView || isIOSWebView;
  }

  detectNativeAuth() {
    const hasNative = window.DashieNative && 
                     typeof window.DashieNative.signIn === 'function';
    console.log('🔐 Native auth available:', hasNative);
    return !!hasNative;
  }

  detectFireTV() {
    const userAgent = navigator.userAgent;
    const isFireTV = userAgent.includes('AFTS') || userAgent.includes('FireTV') || 
                    userAgent.includes('AFT') || userAgent.includes('AFTMM') ||
                    userAgent.includes('AFTRS') || userAgent.includes('AFTSS');
    console.log('🔥 Fire TV detected:', isFireTV);
    return isFireTV;
  }

  async init() {
    console.log('🔐 Initializing AuthManager...');
    console.log('🔐 Environment:', {
      isWebView: this.isWebView,
      hasNativeAuth: this.hasNativeAuth,
      isFireTV: this.isFireTV
    });

    // Set up auth result handlers
    window.handleNativeAuth = (result) => this.handleNativeAuthResult(result);
    window.handleWebAuth = (result) => this.handleWebAuthResult(result);
    
    // Check for existing authentication first
    this.checkExistingAuth();
    
    // If already signed in, we're done
    if (this.isSignedIn) {
      console.log('🔐 ✅ Already authenticated, skipping auth initialization');
      return;
    }

    // Initialize appropriate auth method based on platform
    if (this.hasNativeAuth) {
      console.log('🔐 Using native Android authentication');
      await this.nativeAuth.init();
      this.checkNativeUser();
      
    } else if (this.isWebView) {
      console.log('🔐 WebView without native auth - showing WebView prompt');
      this.ui.showWebViewAuthPrompt(() => this.createWebViewUser(), () => this.exitApp());
      
    } else {
      console.log('🔐 Browser environment - initializing web auth');
      try {
        await this.webAuth.init();
        
        // CRITICAL FIX: Check if OAuth callback was handled during init
        if (this.isSignedIn) {
          console.log('🔐 ✅ OAuth callback handled during init, user is now signed in');
          return; // Don't show sign-in prompt if we're already authenticated
        }
        
        // Only show sign-in prompt if we're still not signed in
        console.log('🔐 No existing auth found, showing sign-in prompt');
        this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
        
      } catch (error) {
        console.error('🔐 Web auth initialization failed:', error);
        this.handleAuthFailure(error);
      }
    }
  }

checkExistingAuth() {
  const savedUser = this.storage.getSavedUser();
  if (savedUser) {
    console.log('🔐 Found saved user:', savedUser.name);
    this.currentUser = savedUser;
    this.isSignedIn = true;
    
    // CRITICAL FIX: Restore the Google access token from saved user data
    if (savedUser.googleAccessToken) {
      this.googleAccessToken = savedUser.googleAccessToken;
      console.log('🔐 ✅ Restored Google access token from saved user');
      console.log('🔐 Token length:', savedUser.googleAccessToken.length);
      console.log('🔐 Token preview:', savedUser.googleAccessToken.substring(0, 30) + '...');
    } else {
      console.warn('🔐 ⚠️ No Google access token in saved user data');
    }
    
    this.ui.showSignedInState();
  }
}

  checkNativeUser() {
    if (this.nativeAuth) {
      const userData = this.nativeAuth.getCurrentUser();
      if (userData) {
        this.setUserFromAuth(userData, 'native');
        this.ui.showSignedInState();
        console.log('🔐 Found native user:', this.currentUser.name);
        return;
      }
    }
    
    // No native user found, show sign-in prompt
    this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
  }

// ENHANCED: Update native auth handling
  handleNativeAuthResult(result) {
    console.log('🔐 Native auth result received:', result);
    
    if (result.success && result.user) {
      // Native auth might also have tokens
      this.setUserFromAuth(result.user, 'native', result.tokens);
      this.isSignedIn = true;
      this.storage.saveUser(this.currentUser);
      this.ui.showSignedInState();
      console.log('🔐 ✅ Native auth successful:', this.currentUser.name);
    } else {
      console.error('🔐 ❌ Native auth failed:', result.error);
      this.nativeAuthFailed = true;
      
      if (this.isFireTV) {
        console.log('🔥 Native auth failed on Fire TV, switching to Device Flow...');
        this.startDeviceFlow();
      } else if (result.error && result.error !== 'Sign-in was cancelled') {
        this.ui.showAuthError(result.error || 'Native authentication failed');
      }
    }
  }

 // ENHANCED: Update device flow handling to pass tokens
  async startDeviceFlow() {
    try {
      console.log('🔥 Starting Device Flow authentication...');
      
      this.ui.hideSignInPrompt();
      
      const result = await this.deviceFlowAuth.startDeviceFlow();
      
      if (result.success && result.user) {
        // Pass the tokens object so setUserFromAuth can extract access_token
        this.setUserFromAuth(result.user, 'device_flow', result.tokens);
        this.isSignedIn = true;
        this.storage.saveUser(this.currentUser);
        this.ui.showSignedInState();
        console.log('🔥 ✅ Device Flow successful:', this.currentUser.name);
      } else {
        throw new Error('Device Flow was cancelled or failed');
      }
      
    } catch (error) {
      console.error('🔥 Device Flow failed:', error);
      this.ui.showAuthError(`Authentication failed: ${error.message}. Please try again.`);
    }
  }

// ENHANCED: Update web auth handling - REMOVE duplicate UI calls
handleWebAuthResult(result) {
  console.log('🔐 Web auth result received:', result);
  
  if (result.success && result.user) {
    this.setUserFromAuth(result.user, 'web', result.tokens);
    this.isSignedIn = true;
    this.storage.saveUser(this.currentUser);
      
    // ✅ SIMPLIFIED: setUserFromAuth now handles all UI updates
    console.log('🔐 ✅ Web auth completed, UI handled by setUserFromAuth');
  } else {
    console.error('🔐 ❌ Web auth failed:', result.error);
    this.ui.showAuthError(result.error || 'Web authentication failed');
  }
}
  
// FIXED: Store access token from any auth method with duplicate prevention
setUserFromAuth(userData, authMethod, tokens = null) {
  // Determine the Google access token from various sources
  let googleAccessToken = null;
  
  if (tokens && tokens.access_token) {
    googleAccessToken = tokens.access_token;
    console.log('🔐 ✅ Found Google access token from tokens object (', authMethod, ')');
    console.log('🔐 Token length:', tokens.access_token.length);
    console.log('🔐 Token preview:', tokens.access_token.substring(0, 30) + '...');
  } else if (userData.googleAccessToken) {
    googleAccessToken = userData.googleAccessToken;
    console.log('🔐 ✅ Found Google access token from user data (', authMethod, ')');
  } else if (authMethod === 'web' && this.webAuth?.accessToken) {
    googleAccessToken = this.webAuth.accessToken;
    console.log('🔐 ✅ Found Google access token from web auth (', authMethod, ')');
  } else {
    console.warn('🔐 ⚠️ No Google access token found for', authMethod);
    console.warn('🔐 This means RLS authentication will not work');
  }

  // Create user object with Google access token included
  this.currentUser = {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    picture: userData.picture,
    signedInAt: Date.now(),
    authMethod: authMethod,
    googleAccessToken: googleAccessToken // ← KEY FIX: Include token in user object
  };

  // Store token separately for quick access (existing behavior)
  this.googleAccessToken = googleAccessToken;

  // Enhanced debug logging
  console.log('🔍 DEBUG setUserFromAuth DETAILED:', {
    authMethod,
    userId: userData.id,
    userEmail: userData.email,
    tokens_provided: !!tokens,
    tokens_type: typeof tokens,
    tokens_keys: tokens ? Object.keys(tokens) : null,
    tokens_has_access_token: tokens?.access_token ? true : false,
    access_token_length: tokens?.access_token?.length,
    access_token_preview: tokens?.access_token?.substring(0, 20) + '...',
    userData_has_googleAccessToken: !!userData.googleAccessToken,
    webAuth_exists: !!this.webAuth,
    webAuth_has_accessToken: !!this.webAuth?.accessToken,
    FINAL_USER_HAS_TOKEN: !!this.currentUser.googleAccessToken, // ← New verification
    STORED_TOKEN_MATCHES: this.googleAccessToken === this.currentUser.googleAccessToken
  });

  // Final verification
  console.log('🔍 FINAL TOKEN STATUS:', {
    authMethod,
    hasStoredToken: !!this.googleAccessToken,
    userObjectHasToken: !!this.currentUser.googleAccessToken, // ← New check
    tokenLength: this.googleAccessToken?.length,
    canUseRLS: !!this.googleAccessToken
  });

  this.isSignedIn = true;

  // ✅ NEW: Settings initialization with duplicate prevention
  if (!this.settingsInitialized) {
    console.log('🔐 🎯 Initializing settings for first time...');
    this.settingsInitialized = true;
    
    // Dynamic import to avoid circular dependencies
    import('../ui/settings.js').then(({ initializeSupabaseSettings }) => {
      initializeSupabaseSettings();
    });
  } else {
    console.log('🔐 ⏭️ Settings already initialized, skipping...');
  }

  // ✅ NEW: UI updates (add these if they don't exist elsewhere)
  console.log('🔐 🎯 Hiding sign-in UI and showing dashboard...');
  this.ui.hideSignInPrompt();
  this.ui.showSignedInState();
  
  console.log(`🔐 ✅ ${authMethod} auth successful:`, this.currentUser.name);

  // Notify that auth is ready
  document.dispatchEvent(new CustomEvent('dashie-auth-ready'));
}


  
  createWebViewUser() {
    console.log('🔐 Creating WebView user');
    
    this.currentUser = {
      id: 'webview-user-' + Date.now(),
      name: 'Dashie User',
      email: 'user@dashie.app',
      picture: 'icons/icon-profile-round.svg',
      signedInAt: Date.now(),
      authMethod: 'webview'
    };
    
    this.isSignedIn = true;
    this.storage.saveUser(this.currentUser);
    this.ui.showSignedInState();
    
    console.log('🔐 WebView user created:', this.currentUser.name);
  }

  async signIn() {
    console.log('🔐 Starting sign-in process...');
    
    if (this.isFireTV) {
      // For Fire TV, always use Device Flow unless native auth is available and hasn't failed
      if (this.hasNativeAuth && !this.nativeAuthFailed) {
        console.log('🔥 Fire TV: Trying native auth first...');
        this.nativeAuth.signIn();
        
        // Quick timeout to fallback to Device Flow
        setTimeout(() => {
          if (!this.isSignedIn && !this.nativeAuthFailed) {
            console.log('🔥 Native auth timeout, switching to Device Flow...');
            this.nativeAuthFailed = true;
            this.startDeviceFlow();
          }
        }, 3000);
      } else {
        console.log('🔥 Fire TV: Using Device Flow directly...');
        this.startDeviceFlow();
      }
      
    } else if (this.hasNativeAuth && this.nativeAuth) {
      console.log('🔐 Using native sign-in');
      this.nativeAuth.signIn();
      
    } else if (this.webAuth) {
      console.log('🔐 Using web sign-in');
      try {
        await this.webAuth.signIn();
      } catch (error) {
        console.error('🔐 Web sign-in failed:', error);
        this.ui.showAuthError('Sign-in failed. Please try again.');
      }
    } else {
      this.ui.showAuthError('No authentication method available.');
    }
  }

  // NEW: Public method to get Google access token
  getGoogleAccessToken() {
    return this.googleAccessToken;
  }

// ENHANCED: Clear token on sign out
  signOut() {
    console.log('🔐 Signing out...');
    
    if (this.hasNativeAuth && this.nativeAuth) {
      this.nativeAuth.signOut();
    }
    
    if (this.webAuth) {
      this.webAuth.signOut();
    }
    
    this.currentUser = null;
    this.isSignedIn = false;
    this.nativeAuthFailed = false;
    this.googleAccessToken = null; // NEW: Clear stored token
    this.storage.clearSavedUser();
    
    // Show appropriate sign-in prompt
    if (this.isWebView && !this.hasNativeAuth) {
      this.ui.showWebViewAuthPrompt(() => this.createWebViewUser(), () => this.exitApp());
    } else {
      this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
    }
  }

  exitApp() {
    console.log('🚪 Exiting Dashie...');
    
    if (this.hasNativeAuth && window.DashieNative?.exitApp) {
      window.DashieNative.exitApp();
    } else if (window.close) {
      window.close();
    } else {
      window.location.href = 'about:blank';
    }
  }

 
  handleAuthFailure(error) {
    console.error('🔐 Auth initialization failed:', error);
    
    const savedUser = this.storage.getSavedUser();
    if (savedUser) {
      console.log('🔐 Using saved authentication as fallback');
      this.currentUser = savedUser;
      this.isSignedIn = true;
      this.ui.showSignedInState();
    } else {
      if (this.isFireTV) {
        console.log('🔥 Auth failure on Fire TV, trying Device Flow...');
        this.startDeviceFlow();
      } else if (this.isWebView) {
        this.ui.showWebViewAuthPrompt(() => this.createWebViewUser(), () => this.exitApp());
      } else {
        this.ui.showAuthError('Authentication service is currently unavailable.', true);
      }
    }
  }


  
  // Public API
  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.isSignedIn && this.currentUser !== null;
  }
}
