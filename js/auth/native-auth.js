// js/auth/native-auth.js - Native Android Authentication Handler

export class NativeAuth {
  constructor() {
    this.available = this.checkAvailability();
  }

  checkAvailability() {
    return window.DashieNative && 
           typeof window.DashieNative.signIn === 'function' &&
           typeof window.DashieNative.isSignedIn === 'function';
  }

  async init() {
    if (!this.available) {
      throw new Error('Native auth not available');
    }
    console.log('🔐 Native auth initialized');
  }

  getCurrentUser() {
    if (!this.available) return null;
    
    try {
      if (window.DashieNative.isSignedIn()) {
        const userJson = window.DashieNative.getCurrentUser();
        if (userJson) {
          return JSON.parse(userJson);
        }
      }
    } catch (error) {
      console.warn('🔐 Failed to get native user:', error);
    }
    
    return null;
  }

  signIn() {
    if (!this.available) {
      throw new Error('Native auth not available');
    }
    
    console.log('🔐 Triggering native sign-in');
    try {
      window.DashieNative.signIn();
    } catch (error) {
      console.error('🔐 Native sign-in failed:', error);
      throw error;
    }
  }

  signOut() {
    if (!this.available) return;
    
    console.log('🔐 Triggering native sign-out');
    try {
      window.DashieNative.signOut();
    } catch (error) {
      console.error('🔐 Native sign-out failed:', error);
    }
  }

  isSignedIn() {
    if (!this.available) return false;
    
    try {
      return window.DashieNative.isSignedIn();
    } catch (error) {
      console.warn('🔐 Failed to check native sign-in status:', error);
      return false;
    }
  }
}
