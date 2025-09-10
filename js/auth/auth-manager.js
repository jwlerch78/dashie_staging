// js/auth/auth-manager.js - Authentication Manager (Updated with Reload Support)

export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isSignedIn = false;
    this.nativeAuthFailed = false;
    
    // Environment detection
    this.isFireTV = this.detectFireTV();
    this.isWebView = this.detectWebView();
    this.hasNativeAuth = window.DashieNative && typeof window.DashieNative.signIn === 'function';
    
    console.log('🔐 Auth Manager initialized:', {
      isFireTV: this.isFireTV,
      isWebView: this.isWebView,
      hasNativeAuth: this.hasNativeAuth
    });
  }

  async init() {
    console.log('🔐 Initializing authentication...');
    
    try {
      // Initialize components
      const { AuthUI } = await import('./auth-ui.js');
      const { AuthStorage } = await import('./auth-storage.js');
      
      this.ui = new AuthUI();
      this.storage = new AuthStorage();
      
      // Check for existing authentication first
      this.checkExistingAuth();
      
      if (this.isSignedIn) {
        console.log('🔐 User already authenticated');
        return;
      }
      
      // Initialize auth methods based on environment
      if (this.hasNativeAuth) {
        console.log('🔐 Native environment detected');
        const { NativeAuth } = await import('./native-auth.js');
        this.nativeAuth = new NativeAuth();
        this.nativeAuth.onAuthResult = (result) => this.handleNativeAuthResult(result);
        this.checkNativeUser();
        
      } else if (this.isFireTV) {
        console.log('🔥 Fire TV without native auth - using Device Flow');
        const { DeviceFlowAuth } = await import('./device-flow-auth.js');
        this.deviceFlowAuth = new DeviceFlowAuth();
        this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
        
      } else if (this.isWebView) {
        console.log('🔐 WebView environment - showing WebView prompt');
        this.ui.showWebViewAuthPrompt(() => this.createWebViewUser(), () => this.exitApp());
        
      } else {
        console.log('🔐 Browser environment - initializing web auth');
        try {
          const { WebAuth } = await import('./web-auth.js');
          this.webAuth = new WebAuth();
          this.webAuth.onAuthResult = (result) => this.handleWebAuthResult(result);
          await this.webAuth.init();
          this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
        } catch (error) {
          console.error('🔐 Web auth initialization failed:', error);
          this.handleAuthFailure(error);
        }
      }
      
    } catch (error) {
      console.error('🔐 Auth initialization error:', error);
      this.handleAuthFailure(error);
    }
  }

  detectFireTV() {
    const userAgent = navigator.userAgent;
    return userAgent.includes('AFTS') || userAgent.includes('FireTV') || 
           userAgent.includes('AFT') || userAgent.includes('AFTMM') ||
           userAgent.includes('AFTRS') || userAgent.includes('AFTSS');
  }

  detectWebView() {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || userAgent.includes('WebView') ||
           (window.Android !== undefined) || (window.webkit?.messageHandlers !== undefined);
  }

  checkExistingAuth() {
    const savedUser = this.storage.getSavedUser();
    if (savedUser) {
      console.log('🔐 Found saved user:', savedUser.name);
      this.currentUser = savedUser;
      this.isSignedIn = true;
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

  handleNativeAuthResult(result) {
    console.log('🔐 Native auth result received:', result);
    
    if (result.success && result.user) {
      this.setUserFromAuth(result.user, 'native');
      this.isSignedIn = true;
      this.storage.saveUser(this.currentUser);
      this.ui.showSignedInState();
      console.log('🔐 ✅ Native auth successful:', this.currentUser.name);
    } else {
      console.error('🔐 ❌ Native auth failed:', result.error);
      this.nativeAuthFailed = true;
      
      // For Fire TV, immediately try Device Flow
      if (this.isFireTV) {
        console.log('🔥 Native auth failed on Fire TV, switching to Device Flow...');
        this.startDeviceFlow();
      } else if (result.error && result.error !== 'Sign-in was cancelled') {
        this.ui.showAuthError(result.error || 'Native authentication failed');
      }
    }
  }

  async startDeviceFlow() {
    try {
      console.log('🔥 Starting Device Flow authentication...');
      
      // Hide any existing prompts
      this.ui.hideSignInPrompt();
      
      const result = await this.deviceFlowAuth.startDeviceFlow();
      
      if (result.success && result.user) {
        this.setUserFromAuth(result.user, 'device_flow');
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

  handleWebAuthResult(result) {
    console.log('🔐 Web auth result received:', result);
    
    if (result.success && result.user) {
      this.setUserFromAuth(result.user, 'web');
      this.isSignedIn = true;
      this.storage.saveUser(this.currentUser);
      this.ui.showSignedInState();
      console.log('🔐 ✅ Web auth successful:', this.currentUser.name);
    } else {
      console.error('🔐 ❌ Web auth failed:', result.error);
      this.ui.showAuthError(result.error || 'Web authentication failed');
    }
  }

  setUserFromAuth(userData, authMethod) {
    this.currentUser = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      picture: userData.picture,
      signedInAt: Date.now(),
      authMethod: authMethod
    };
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
    this.storage.clearSavedUser();
    
    // Show appropriate sign-in prompt based on environment
    if (this.isWebView && !this.hasNativeAuth) {
      this.ui.showWebViewAuthPrompt(() => this.createWebViewUser(), () => this.exitApp());
    } else {
      this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
    }
  }

  reloadApp() {
    console.log('🔄 Reloading application...');
    
    // Clear any temporary auth state
    this.nativeAuthFailed = false;
    
    // Hide any current prompts
    this.ui.hideSignInPrompt();
    
    // Perform a full page reload
    window.location.reload();
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
