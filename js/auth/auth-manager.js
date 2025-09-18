// js/auth/auth-manager.js
// CHANGE SUMMARY: Fixed widget postMessage error by removing non-cloneable objects from message

import { CognitoAuth } from './cognito-auth.js';
import { AuthUI } from './auth-ui.js';
import { AuthStorage } from './auth-storage.js';
import { GoogleAPIClient } from '../google-apis/google-api-client.js';

export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isSignedIn = false;
    this.googleAccessToken = null;
    this.googleAPI = null;
    
    // Initialize auth modules - much simpler now!
    this.cognitoAuth = new CognitoAuth();
    this.ui = new AuthUI();
    this.storage = new AuthStorage(); // Keep for compatibility
    
    // Centralized data cache (unchanged)
    this.dataCache = {
      calendar: {
        events: [],
        calendars: [],
        lastUpdated: null,
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        isLoading: false
      },
      photos: {
        albums: [],
        recentPhotos: [],
        lastUpdated: null,
        refreshInterval: 30 * 60 * 1000, // 30 minutes
        isLoading: false
      }
    };
    
    this.refreshTimers = {};
    this.pendingWidgetRequests = [];
    
    this.init();
  }

  async init() {
    console.log('🔐 Initializing simplified AuthManager with Cognito...');
    
    // Set up widget request handler (unchanged)
    this.setupWidgetRequestHandler();
    
    try {
      // Initialize Cognito
      const result = await this.cognitoAuth.init();
      
      if (result.success && result.user) {
        console.log('🔐 ✅ Cognito authentication successful');
        this.setUserFromCognito(result.user);
        this.isSignedIn = true;
        this.ui.showSignedInState();
        await this.initializeGoogleAPIs();
        return;
      }
      
      // No existing auth found - show sign-in prompt
      console.log('🔐 No existing authentication, showing sign-in prompt');
      this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
      
    } catch (error) {
      console.error('🔐 ❌ Auth initialization failed:', error);
      this.handleAuthFailure(error);
    }
  }

  setUserFromCognito(userData) {
    this.currentUser = userData;
    this.googleAccessToken = userData.googleAccessToken;
    
    console.log('🔐 ✅ User set from Cognito:', {
      name: userData.name,
      email: userData.email,
      picture: userData.picture,
      firstname: userData.given_name,
      lastname: userData.family_name,
      id: userData.id,
      hasGoogleToken: !!this.googleAccessToken
    });
    
    // Save to legacy storage for compatibility
    this.storage.saveUser(userData);
  }

  async signIn() {
    try {
      console.log('🔐 Starting Cognito sign-in...');
      this.ui.hideSignInPrompt();
      
      // This will redirect to Google OAuth
      await this.cognitoAuth.signIn();
      
    } catch (error) {
      console.error('🔐 ❌ Sign-in failed:', error);
      this.ui.showAuthError('Sign-in failed. Please try again.');
    }
  }

  async signOut() {
    console.log('🔐 Signing out...');
    
    try {
      // Clear refresh timers
      Object.values(this.refreshTimers).forEach(timer => clearTimeout(timer));
      this.refreshTimers = {};
      
      // Clear data cache
      this.dataCache = {
        calendar: { events: [], calendars: [], lastUpdated: null, refreshInterval: 5 * 60 * 1000, isLoading: false },
        photos: { albums: [], recentPhotos: [], lastUpdated: null, refreshInterval: 30 * 60 * 1000, isLoading: false }
      };
      
      // Sign out from Cognito
      await this.cognitoAuth.signOut();
      
      // Clear local state
      this.currentUser = null;
      this.isSignedIn = false;
      this.googleAccessToken = null;
      this.googleAPI = null;
      
      // Clear legacy storage
      this.storage.clearSavedUser();
      
      // Show sign-in prompt
      this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
      
    } catch (error) {
      console.error('🔐 ❌ Sign-out failed:', error);
      // Still clear local state even if remote sign-out fails
      this.currentUser = null;
      this.isSignedIn = false;
      this.googleAccessToken = null;
      this.googleAPI = null;
      this.ui.showSignInPrompt(() => this.signIn(), () => this.exitApp());
    }
  }

  exitApp() {
    console.log('🚪 Exiting Dashie...');
    
    // Try platform-specific exit methods (legacy compatibility)
    if (window.DashieNative?.exitApp) {
      window.DashieNative.exitApp();
    } else if (window.close) {
      window.close();
    } else {
      window.location.href = 'about:blank';
    }
  }

  handleAuthFailure(error) {
    console.error('🔐 Auth initialization failed:', error);
    
    // Try to get saved user as fallback
    const savedUser = this.cognitoAuth.getSavedUser();
    if (savedUser) {
      console.log('🔐 Using saved user data as fallback');
      this.setUserFromCognito(savedUser);
      this.isSignedIn = true;
      this.ui.showSignedInState();
    } else {
      this.ui.showAuthError('Authentication service is currently unavailable. Please try again.');
    }
  }

  // API compatibility methods (unchanged from original)
  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.isSignedIn && !!this.currentUser;
  }

  getGoogleAccessToken() {
    return this.googleAccessToken;
  }

  // NEW: Method for token refresh (uses Cognito's built-in refresh)
  async refreshGoogleAccessToken() {
    try {
      console.log('🔄 Refreshing Google access token via Cognito...');
      const success = await this.cognitoAuth.refreshSession();
      
      if (success && this.cognitoAuth.getGoogleAccessToken()) {
        this.googleAccessToken = this.cognitoAuth.getGoogleAccessToken();
        
        // Update current user object
        if (this.currentUser) {
          this.currentUser.googleAccessToken = this.googleAccessToken;
          this.storage.saveUser(this.currentUser);
        }
        
        console.log('🔄 ✅ Google access token refreshed successfully');
        return this.googleAccessToken;
      } else {
        throw new Error('Cognito session refresh failed');
      }
    } catch (error) {
      console.error('🔄 ❌ Google access token refresh failed:', error);
      throw error;
    }
  }

  // Google APIs initialization (updated for Cognito)
  async initializeGoogleAPIs() {
    if (!this.googleAccessToken) {
      console.warn('🔐 ⚠️ No Google access token available for API initialization');
      return;
    }

    try {
      // Pass 'this' as the auth manager so GoogleAPIClient can call refreshGoogleAccessToken
      this.googleAPI = new GoogleAPIClient(this);
      const testResults = await this.googleAPI.testAccess();
      console.log('🌐 ✅ Google APIs initialized:', testResults);
      
      // Notify widgets (unchanged)
      this.notifyWidgetsOfAPIReadiness(testResults);
      
    } catch (error) {
      console.error('🌐 ❌ Google APIs initialization failed:', error);
      this.notifyWidgetsOfAPIReadiness({ calendar: false, photos: false });
    }
  }

  // Widget communication methods (unchanged from original)
  setupWidgetRequestHandler() {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'widget-data-request') {
        this.handleWidgetDataRequest(event.data, event.source);
      }
    });
  }

  notifyWidgetsOfAPIReadiness(testResults) {
    setTimeout(() => {
      const allWidgetIframes = document.querySelectorAll('.widget-iframe, .widget iframe, .widget-iframe');
      
      if (allWidgetIframes.length === 0) {
        console.log('📡 🔄 No widget iframes found initially, retrying...');
        setTimeout(() => {
          const retryIframes = document.querySelectorAll('.widget-iframe, .widget iframe, .widget-iframe');
          if (retryIframes.length > 0) {
            console.log(`📡 🔄 Retry found ${retryIframes.length} widget iframe(s)`);
            this.sendGoogleAPIReadyMessage(retryIframes, testResults);
          }
        }, 2000);
      } else {
        this.sendGoogleAPIReadyMessage(allWidgetIframes, testResults);
      }
    }, 1000);
  }

  sendGoogleAPIReadyMessage(iframes, testResults) {
    iframes.forEach((iframe, index) => {
      if (iframe.contentWindow) {
        try {
          // FIXED: Only send cloneable data - no Promise objects or functions
          const message = {
            type: 'google-apis-ready',
            apiCapabilities: testResults,
            timestamp: Date.now(),
            googleAccessToken: this.googleAccessToken,
            debugInfo: {
              sentAt: new Date().toISOString(),
              widgetSrc: iframe.src,
              widgetIndex: index + 1
            }
          };
          
          iframe.contentWindow.postMessage(message, '*');
          console.log(`📡 ✅ Message sent to widget ${index + 1} (${iframe.src})`);
          
        } catch (error) {
          console.error(`📡 ❌ Failed to send message to widget ${index + 1}:`, error);
        }
      }
    });
  }

  async handleWidgetDataRequest(requestData, sourceWindow) {
    console.log('📡 📨 Received widget data request:', requestData);
    
    try {
      let response = { 
        type: 'widget-data-response',
        requestId: requestData.requestId,
        success: false,
        timestamp: Date.now()
      };
      
      const { dataType, requestType, params } = requestData;
      
      if (dataType === 'calendar') {
        response = await this.handleCalendarRequest(requestType, params, response);
      } else if (dataType === 'photos') {
        response = await this.handlePhotosRequest(requestType, params, response);
      } else {
        response.error = 'Unknown data type requested';
      }
      
      sourceWindow.postMessage(response, '*');
      console.log('📡 ✅ Widget data response sent');
      
    } catch (error) {
      console.error('📡 ❌ Widget data request failed:', error);
      sourceWindow.postMessage({
        type: 'widget-data-response',
        requestId: requestData.requestId,
        success: false,
        error: error.message,
        timestamp: Date.now()
      }, '*');
    }
  }

  async handleCalendarRequest(requestType, params, response) {
    if (!this.googleAPI) {
      throw new Error('Google APIs not initialized');
    }
    
    switch (requestType) {
      case 'events':
        const events = await this.googleAPI.getUpcomingEvents(params?.timeRange);
        response.success = true;
        response.data = events;
        break;
        
      case 'calendars':
        const calendars = await this.googleAPI.getCalendarList();
        response.success = true;
        response.data = calendars;
        break;
        
      default:
        throw new Error(`Unknown calendar request type: ${requestType}`);
    }
    
    return response;
  }

  async handlePhotosRequest(requestType, params, response) {
    if (!this.googleAPI) {
      throw new Error('Google APIs not initialized');
    }
    
    switch (requestType) {
      case 'albums':
        const albums = await this.googleAPI.getPhotoAlbums();
        response.success = true;
        response.data = albums;
        break;
        
      case 'recent':
        const photos = await this.googleAPI.getRecentPhotos(params?.count || 10);
        response.success = true;
        response.data = photos;
        break;
        
      default:
        throw new Error(`Unknown photos request type: ${requestType}`);
    }
    
    return response;
  }
}
