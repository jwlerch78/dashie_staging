// js/auth/auth-manager.js - Complete Authentication Solution

import { NativeAuth } from './native-auth.js';
import { WebAuth } from './web-auth.js';
import { AuthUI } from './auth-ui.js';
import { AuthStorage } from './auth-storage.js';
import { DeviceFlowAuth } from './device-flow-auth.js';
import { SimpleFireTVAuth } from './fire-tv-fallback.js';

export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isSignedIn = false;
    this.isWebView = this.detectWebView();
    this.hasNativeAuth = this.detectNativeAuth();
    this.isFireTV = this.detectFireTV();
    
    // Initialize auth modules
    this.storage = new AuthStorage();
    this.ui = new AuthUI();
    this.nativeAuth = this.hasNativeAuth ? new NativeAuth() : null;
    this.webAuth = new WebAuth();
    this.deviceFlowAuth = new DeviceFlowAuth();
    this.fireTVFallback = new SimpleFireTVAuth();
    
    this.nativeAuthAttempted = false;
    
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
    
    // Initialize appropriate auth method based on environment
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
        if (!this.isSignedIn) {
          this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
        }
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
    this.nativeAuthAttempted = true;
    
    if (result.success && result.user) {
      this.setUserFromAuth(result.user, 'native');
      this.isSignedIn = true;
      this.storage.saveUser(this.currentUser);
      this.ui.showSignedInState();
      console.log('🔐 ✅ Native auth successful:', this.currentUser.name);
    } else {
      console.error('🔐 ❌ Native auth failed:', result.error);
      
      // Enhanced Fire TV fallback strategy
      if (this.isFireTV) {
        this.handleFireTVAuthFailure(result.error);
      } else if (result.error && result.error !== 'Sign-in was cancelled') {
        this.ui.showAuthError(result.error || 'Native authentication failed');
      }
    }
  }

  async handleFireTVAuthFailure(error) {
    console.log('🔥 Native auth failed on Fire TV, trying alternative methods...');
    
    try {
      // First, try OAuth Device Flow (Google's recommended method for TV)
      console.log('🔥 Attempting OAuth Device Flow...');
      const result = await this.deviceFlowAuth.startDeviceFlow();
      
      if (result.success && result.user) {
        this.setUserFromAuth(result.user, 'device_flow');
        this.isSignedIn = true;
        this.storage.saveUser(this.currentUser);
        this.ui.showSignedInState();
        console.log('🔥 ✅ Device Flow successful:', this.currentUser.name);
        return;
      }
      
    } catch (deviceFlowError) {
      console.log('🔥 Device Flow failed, trying simple fallback:', deviceFlowError);
      
      try {
        // If Device Flow fails, offer simple "Continue" option
        const fallbackResult = await this.fireTVFallback.showFireTVFallback();
        
        if (fallbackResult.success && fallbackResult.user) {
          this.setUserFromAuth(fallbackResult.user, 'fire_tv_fallback');
          this.isSignedIn = true;
          this.storage.saveUser(this.currentUser);
          this.ui.showSignedInState();
          console.log('🔥 ✅ Fire TV fallback successful:', this.currentUser.name);
          return;
        }
        
      } catch (fallbackError) {
        console.error('🔥 All Fire TV auth methods failed:', fallbackError);
        this.ui.showAuthError('Authentication failed. Please check your network connection and try again.');
      }
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
    
    if (this.hasNativeAuth && this.nativeAuth) {
      console.log('🔐 Using native sign-in');
      this.nativeAuth.signIn();
      
      // Set a timeout for Fire TV to try alternative methods
      if (this.isFireTV) {
        setTimeout(() => {
          if (!this.isSignedIn && !this.nativeAuthAttempted) {
            console.log('🔥 Native auth timeout, trying alternatives...');
            this.handleFireTVAuthFailure('timeout');
          }
        }, 3000); // 3 second timeout
      }
      
    } else if (this.isFireTV) {
      // If no native auth on Fire TV, go straight to Device Flow
      console.log('🔥 Fire TV without native auth - using Device Flow');
      try {
        const result = await this.deviceFlowAuth.startDeviceFlow();
        if (result.success && result.user) {
          this.setUserFromAuth(result.user, 'device_flow');
          this.isSignedIn = true;
          this.storage.saveUser(this.currentUser);
          this.ui.showSignedInState();
        }
      } catch (error) {
        console.error('🔥 Device Flow failed:', error);
        this.handleFireTVAuthFailure(error.message);
      }
      
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
    this.nativeAuthAttempted = false;
    this.storage.clearSavedUser();
    
    // Show appropriate sign-in prompt based on environment
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
        this.handleFireTVAuthFailure(error.message);
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
