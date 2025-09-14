// js/auth/simple-auth.js - Updated Entry Point (Simplified)

import { AuthManager } from './auth-manager.js';

// Create a simplified wrapper that maintains your existing API
export class SimpleAuth {
  constructor() {
    this.authManager = new AuthManager();
  }

  getGoogleAPI() {
  return this.authManager.getGoogleAPI();
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
}

// Initialize and make globally available (maintains existing behavior)
let dashieAuth = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    dashieAuth = new SimpleAuth();
  });
} else {
  dashieAuth = new SimpleAuth();
}

window.dashieAuth = dashieAuth;

export { SimpleAuth as default };
