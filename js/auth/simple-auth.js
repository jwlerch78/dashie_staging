// js/auth/simple-auth.js - Fixed to prevent duplicate AuthManager creation

import { AuthManager } from './auth-manager.js';

// Create a simplified wrapper that maintains your existing API
export class SimpleAuth {
  constructor(existingAuthManager = null) {
    // Use existing AuthManager if provided, otherwise create new one
    this.authManager = existingAuthManager || new AuthManager();
  }

  // Delegate to AuthManager
  getUser() {
    return this.authManager.getUser();
  }

  isAuthenticated() {
    return this.authManager.isAuthenticated();
  }

  signOut() {
    this.authManager.signOut();
  }

  exitApp() {
    this.authManager.exitApp();
  }

  // Get Google access token (for settings system)
  getGoogleAccessToken() {
    return this.authManager.getGoogleAccessToken();
  }
}

// FIXED: Only initialize if not already exists
let dashieAuth = null;

function initializeAuth() {
  if (window.dashieAuth) {
    console.log('🔐 dashieAuth already exists, skipping duplicate creation');
    return window.dashieAuth;
  }

  console.log('🔐 Creating new dashieAuth instance');
  dashieAuth = new SimpleAuth();
  window.dashieAuth = dashieAuth;
  
  // Also expose authManager for compatibility
  window.authManager = dashieAuth.authManager;
  
  return dashieAuth;
}

// Initialize based on document ready state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
  initializeAuth();
}

export { SimpleAuth as default };
