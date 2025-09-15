// js/supabase/simple-supabase-storage.js - Complete Storage with RLS Support

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings';
    this.isOnline = navigator.onLine;
    this.supabaseAuthToken = null;
    this.isRLSEnabled = false;
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

// Enhanced Google access token retrieval with better debugging
getGoogleAccessToken() {
  console.log('🔐 🔍 SUPABASE: Starting token search...');
  
  // Method 1: Try to get token from auth manager first
  if (window.dashieAuth?.getGoogleAccessToken) {
    const token = window.dashieAuth.getGoogleAccessToken();
    if (token) {
      console.log('🔐 ✅ SUPABASE: Found Google access token from auth manager');
      console.log('🔐 Token length:', token.length);
      console.log('🔐 Token preview:', token.substring(0, 30) + '...');
      return token;
    } else {
      console.log('🔐 ❌ SUPABASE: Auth manager returned null/undefined token');
    }
  } else {
    console.log('🔐 ❌ SUPABASE: No dashieAuth.getGoogleAccessToken method available');
  }
  
  // Method 2: Fallback - try to get from user object
  const user = window.dashieAuth?.getUser();
  console.log('🔐 🔍 SUPABASE: User object check:', {
    hasUser: !!user,
    userId: user?.id,
    authMethod: user?.authMethod,
    hasGoogleAccessToken: !!user?.googleAccessToken,
    userKeys: user ? Object.keys(user) : null
  });
  
  if (user?.googleAccessToken) {
    console.log('🔐 ✅ SUPABASE: Found Google access token from user data');
    console.log('🔐 Token length:', user.googleAccessToken.length);
    console.log('🔐 Token preview:', user.googleAccessToken.substring(0, 30) + '...');
    return user.googleAccessToken;
  }
  
  // Method 3: Additional debugging - check if dashieAuth exists at all
  console.log('🔐 🔍 SUPABASE: Auth system debug:', {
    hasDashieAuth: !!window.dashieAuth,
    dashieAuthType: typeof window.dashieAuth,
    dashieAuthMethods: window.dashieAuth ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.dashieAuth)) : null,
    hasGetUser: !!window.dashieAuth?.getUser,
    hasGetGoogleAccessToken: !!window.dashieAuth?.getGoogleAccessToken
  });
  
  console.warn('🔐 ❌ SUPABASE: No Google access token found - will use non-RLS mode');
  console.warn('🔐 Available methods tried: auth manager, user object');
  return null;
}

// Get Supabase auth token from Google OAuth via Edge Function
// Updated to use dev or prod edge server dynamically
async ensureSupabaseAuth() {
  if (this.supabaseAuthToken) {
    return this.supabaseAuthToken; // Already authenticated
  }

  try {
    console.log('🔐 Getting Supabase auth via Edge Function...');
    
    const currentUser = window.dashieAuth?.getUser();
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    // Get Google access token
    const googleToken = this.getGoogleAccessToken();
    if (!googleToken) {
      throw new Error('No Google access token available');
    }

    console.log('🔐 Calling Edge Function with user:', currentUser.email);
    console.log('🔐 Google token length:', googleToken.length);
    console.log('🔐 Google token preview:', googleToken.substring(0, 30) + '...');

    // Dynamically determine Edge Function URL based on environment
    const getEdgeFunctionUrl = () => {
      const config = window.currentDbConfig;
      if (config.supabaseEdgeUrl) {
        return config.supabaseEdgeUrl;
      }
      
      // Fallback: construct URL from supabaseUrl if edgeUrl not defined
      const baseUrl = config.supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      return `https://${baseUrl}.supabase.co/functions/v1/hyper-responder`;
    };

    const edgeFunctionUrl = getEdgeFunctionUrl();
    console.log('🔐 Using Edge Function URL:', edgeFunctionUrl);

    // Use the environment-appropriate auth token
    const authToken = window.currentDbConfig.supabaseKey;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        googleToken: googleToken,
        userData: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          picture: currentUser.picture,
          authMethod: currentUser.authMethod
        }
      })
    });

    console.log('🔐 Edge Function response status:', response.status);

    const result = await response.json();
    console.log('🔐 Edge Function result:', result);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to authenticate with Supabase');
    }

    // Handle both possible response formats
    this.supabaseAuthToken = result.supabaseToken || result.token;
    const supabaseUserId = result.supabase_user_id || result.user_id;
    
    if (!this.supabaseAuthToken) {
      throw new Error('No token received from Edge Function');
    }

    console.log('🔐 ✅ Authentication successful');
    console.log('🔐 Google ID:', currentUser.id);
    console.log('🔐 Supabase UUID:', supabaseUserId);
    
    // CRITICAL: Update the userId to use Supabase UUID for database operations
    this.userId = supabaseUserId;
    console.log('🔐 Updated userId for database operations:', this.userId);
    
    // Try to set session with improved approach
    try {
      // Method 1: Try standard setSession
      const { data, error } = await supabase.auth.setSession({
        access_token: this.supabaseAuthToken,
        refresh_token: null
      });

      if (error) {
        console.warn('⚠️ setSession failed, trying alternative approaches:', error.message);
        
        // Method 2: Set auth header manually on REST client
        if (supabase.rest && supabase.rest.headers) {
          supabase.rest.headers['Authorization'] = `Bearer ${this.supabaseAuthToken}`;
          console.log('✅ Set manual Authorization header on REST client');
        }
        
        // Method 3: Set global headers if available
        if (supabase.supabaseKey) {
          const originalHeaders = supabase.rest.headers || {};
          supabase.rest.headers = {
            ...originalHeaders,
            'Authorization': `Bearer ${this.supabaseAuthToken}`
          };
          console.log('✅ Updated global headers');
        }
        
        // Method 4: Try direct auth client method
        try {
          if (supabase.auth && typeof supabase.auth.setAuth === 'function') {
            supabase.auth.setAuth(this.supabaseAuthToken);
            console.log('✅ Set auth token directly on auth client');
          }
        } catch (directAuthError) {
          console.log('⚠️ Direct auth method not available:', directAuthError.message);
        }
        
      } else {
        console.log('✅ Session set successfully via setSession');
      }
    } catch (authSetupError) {
      console.warn('⚠️ All auth setup methods failed:', authSetupError.message);
      console.log('🔄 Proceeding without proper session - RLS may not work');
    }

    this.isRLSEnabled = true;
    console.log('🔐 ✅ Supabase RLS authentication established');
    return this.supabaseAuthToken;

  } catch (error) {
    console.error('🔐 ❌ Supabase auth failed:', error);
    console.log('🔐 ⚠️ Falling back to non-RLS mode');
    this.isRLSEnabled = false;
    return null;
  }
}
  // Save settings with hybrid approach (local + cloud)
  async saveSettings(settings) {
    console.log('💾 Saving settings for user:', this.userId);
    
    // Always save locally first (immediate)
    this.saveToLocalStorage(settings);
    
    // Try to save to cloud (background)
    if (this.isOnline) {
      try {
        await this.saveToSupabase(settings);
        console.log('☁️ Settings synced to Supabase');
      } catch (error) {
        console.warn('☁️ Supabase sync failed, will retry when online:', error);
        this.markForRetry(settings);
      }
    } else {
      console.log('📴 Offline - settings will sync when online');
      this.markForRetry(settings);
    }
  }

  // Load settings with fallback strategy
  async loadSettings() {
    console.log('📖 Loading settings for user:', this.userId);
    
    try {
      // Try cloud first if online
      if (this.isOnline) {
        const cloudSettings = await this.loadFromSupabase();
        if (cloudSettings) {
          // Update local cache with cloud data
          this.saveToLocalStorage(cloudSettings);
          console.log('☁️ Settings loaded from Supabase');
          return cloudSettings;
        }
      }
    } catch (error) {
      console.warn('☁️ Supabase load failed, using local storage:', error);
    }

    // Fallback to local storage
    const localSettings = this.loadFromLocalStorage();
    if (localSettings) {
      console.log('💾 Settings loaded from local storage');
      return localSettings;
    }

    console.log('🆕 No saved settings found, using defaults');
    return null;
  }

  // Save to Supabase with RLS support
  async saveToSupabase(settings) {
    if (!this.userId) throw new Error('No user ID');

    try {
      // Try to establish Supabase auth (won't break if it fails)
      await this.ensureSupabaseAuth();
      
      // Save with current auth status
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: this.userId,
          user_email: this.userEmail,
          settings: settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }
      
      const mode = this.isRLSEnabled ? '(with RLS auth)' : '(without RLS)';
      console.log(`📊 Settings saved to Supabase successfully ${mode}`);
      return data;
      
    } catch (error) {
      console.error('Supabase save failed:', error);
      throw error;
    }
  }

  // Load from Supabase with RLS support
  async loadFromSupabase() {
    if (!this.userId) return null;

    try {
      // Try to establish auth (optional)
      await this.ensureSupabaseAuth();
      
      console.log('🔍 Loading from Supabase for user:', this.userId);
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_id', this.userId);

      if (error) {
        console.error('🔍 Supabase load error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const record = data[0];
        const mode = this.isRLSEnabled ? '(with RLS auth)' : '(without RLS)';
        console.log(`📊 Settings loaded from Supabase ${mode}`);
        return {
          ...record.settings,
          lastModified: new Date(record.updated_at).getTime()
        };
      } else {
        console.log('📊 No settings found in Supabase (new user)');
        return null;
      }

    } catch (error) {
      console.error('🔍 Supabase load failed:', error);
      throw error;
    }
  }

  // Subscribe to real-time changes
  subscribeToChanges(callback) {
    if (!this.userId) return null;

    console.log('🔄 Setting up real-time sync for user:', this.userId);

    const subscription = supabase
      .channel(`settings-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${this.userId}`
        },
        (payload) => {
          console.log('🔄 Settings updated from another device');
          const newSettings = {
            ...payload.new.settings,
            lastModified: new Date(payload.new.updated_at).getTime()
          };
          
          // Update local cache
          this.saveToLocalStorage(newSettings);
          
          // Notify the app
          callback(newSettings);
        }
      )
      .subscribe((status) => {
        console.log('🔄 Real-time subscription status:', status);
      });

    return subscription;
  }

  // Local storage methods
  saveToLocalStorage(settings) {
    try {
      const dataToSave = {
        ...settings,
        lastModified: Date.now()
      };
      localStorage.setItem(this.localStorageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Local storage save failed:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(this.localStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Local storage load failed:', error);
      return null;
    }
  }

  markForRetry(settings) {
    try {
      localStorage.setItem('dashie-settings-pending', JSON.stringify({
        settings,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to mark for retry:', error);
    }
  }

  async syncPendingChanges() {
    try {
      const pending = localStorage.getItem('dashie-settings-pending');
      if (pending) {
        const { settings } = JSON.parse(pending);
        await this.saveToSupabase(settings);
        localStorage.removeItem('dashie-settings-pending');
        console.log('✅ Synced pending settings changes');
      }
    } catch (error) {
      console.warn('Failed to sync pending changes:', error);
    }
  }

  // Cleanup
  unsubscribeAll() {
    console.log('🧹 Cleaning up Supabase subscriptions');
  }
}
