// js/supabase/simple-supabase-storage.js - Complete Storage with RLS Bypass

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor(userId, userEmail = null) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.localStorageKey = 'dashie-settings';
    this.isOnline = navigator.onLine;
    this.supabaseAuthToken = null;
    
    // CRITICAL FIX: Skip RLS entirely since it's disabled
    this.isRLSEnabled = false;
    this.skipRLSAuth = true;
    
    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // BYPASSED: Skip RLS authentication entirely
  async ensureSupabaseAuth() {
    // QUICK FIX: Skip RLS entirely for debugging
    console.log('🔐 ⏭️ Skipping RLS authentication (disabled for debugging)');
    this.isRLSEnabled = false;
    return null;
  }

  // Enhanced Google access token retrieval (kept for future RLS use)
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
    
    console.warn('🔐 ❌ SUPABASE: No Google access token found - will use non-RLS mode');
    return null;
  }

  // Save settings with hybrid approach (local + cloud)
  async saveSettings(settings) {
    console.log('💾 Saving settings for user:', this.userId);
    console.log('💾 Online status:', this.isOnline);
    console.log('💾 Settings keys to save:', Object.keys(settings));
    
    // Always save locally first (immediate)
    this.saveToLocalStorage(settings);
    console.log('💾 ✅ Saved to local storage');
    
    // Try to save to cloud (background) only if online
    if (this.isOnline) {
      try {
        await this.saveToSupabase(settings);
        console.log('☁️ ✅ Settings synced to Supabase');
      } catch (error) {
        console.warn('☁️ ❌ Supabase sync failed:', error.message);
        console.warn('☁️ 🔄 Will retry when conditions improve');
        this.markForRetry(settings);
        
        // Don't throw the error - local save succeeded
        // The user's settings are safe locally
      }
    } else {
      console.log('📴 Offline - settings saved locally only');
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

  // UPDATED: Save to Supabase without RLS authentication
  async saveToSupabase(settings) {
    if (!this.userId) throw new Error('No user ID');

    console.log('📊 💾 Starting Supabase save (non-RLS mode)...');
    console.log('📊 💾 User ID:', this.userId);
    console.log('📊 💾 User Email:', this.userEmail);
    console.log('📊 💾 Supabase URL:', window.currentDbConfig.supabaseUrl);

    try {
      // SKIP the RLS authentication step entirely
      console.log('📊 💾 Using direct Supabase client (no RLS auth)');
      
      const saveData = {
        user_id: this.userId,
        user_email: this.userEmail,
        settings: settings,
        updated_at: new Date().toISOString()
      };

      console.log('📊 💾 Attempting upsert with data structure:', {
        user_id: saveData.user_id,
        user_email: saveData.user_email,
        settings_keys: Object.keys(saveData.settings),
        settings_sample: Object.keys(saveData.settings).reduce((acc, key) => {
          acc[key] = typeof saveData.settings[key];
          return acc;
        }, {}),
        updated_at: saveData.updated_at
      });

      // Direct save without any authentication headers
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(saveData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('📊 ❌ Supabase upsert error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        });
        throw error;
      }
      
      console.log('📊 ✅ Supabase save successful (non-RLS)');
      console.log('📊 ✅ Returned data count:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('📊 ✅ Saved record ID:', data[0].user_id);
      }
      return data;
      
    } catch (error) {
      console.error('📊 ❌ Supabase save failed:', {
        errorType: typeof error,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack?.split('\n')[0] // Just first line of stack
      });
      
      // Enhanced error analysis
      if (error.message?.includes('CORS')) {
        console.error('📊 ❌ CORS Error detected - check Supabase project settings');
        console.error('📊 ❌ Current origin:', window.location.origin);
      }
      
      if (error.message?.includes('fetch')) {
        console.error('📊 ❌ Network/Fetch Error - check internet connection');
      }
      
      if (error.message?.includes('relation') || error.message?.includes('table')) {
        console.error('📊 ❌ Table Error - user_settings table may not exist');
      }
      
      throw error;
    }
  }

  // UPDATED: Load from Supabase without RLS authentication  
  async loadFromSupabase() {
    if (!this.userId) return null;

    try {
      console.log('📊 📖 Loading from Supabase (non-RLS mode)...');
      console.log('📊 📖 User ID:', this.userId);
      
      // Direct load without authentication
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_id', this.userId);

      if (error) {
        console.error('📊 ❌ Supabase load error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const record = data[0];
        console.log('📊 ✅ Settings loaded from Supabase (non-RLS)');
        console.log('📊 ✅ Settings keys loaded:', Object.keys(record.settings));
        return {
          ...record.settings,
          lastModified: new Date(record.updated_at).getTime()
        };
      } else {
        console.log('📊 ℹ️ No settings found in Supabase (new user)');
        return null;
      }

    } catch (error) {
      console.error('📊 ❌ Supabase load failed:', error);
      throw error;
    }
  }

  // Subscribe to real-time changes (keeping for future use)
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
      console.log('💾 ✅ Saved to localStorage with keys:', Object.keys(dataToSave));
    } catch (error) {
      console.error('💾 ❌ Local storage save failed:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(this.localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('💾 ✅ Loaded from localStorage with keys:', Object.keys(parsed));
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('💾 ❌ Local storage load failed:', error);
      return null;
    }
  }

  markForRetry(settings) {
    try {
      localStorage.setItem('dashie-settings-pending', JSON.stringify({
        settings,
        timestamp: Date.now()
      }));
      console.log('🔄 ✅ Marked settings for retry when online');
    } catch (error) {
      console.warn('🔄 ❌ Failed to mark for retry:', error);
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

  // Debug method to test connection
  async testConnection() {
    try {
      console.log('🧪 Testing Supabase connection...');
      console.log('🧪 Target URL:', window.currentDbConfig.supabaseUrl);
      console.log('🧪 Environment:', window.currentDbConfig.environment);
      
      // Simple test query
      const { data, error } = await supabase
        .from('user_settings')
        .select('user_id')
        .limit(1);
      
      if (error) {
        console.error('🧪 ❌ Connection test failed:', error);
        return { success: false, error };
      }
      
      console.log('🧪 ✅ Connection test successful');
      console.log('🧪 ✅ Sample data count:', data?.length || 0);
      return { success: true, data };
      
    } catch (error) {
      console.error('🧪 ❌ Connection test exception:', error);
      return { success: false, error };
    }
  }
}
