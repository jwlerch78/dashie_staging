// js/supabase/simple-supabase-storage.js
// CHANGE SUMMARY: Updated to work with Identity Pool AWS credentials instead of Cognito JWT tokens

import { supabase } from './supabase-config.js';

export class SimpleSupabaseStorage {
  constructor() {
    this.supabase = supabase;
    this.isRLSMode = false;
    this.currentUser = null;
    this.fallbackStorage = {};
    this.pendingChanges = [];
    this.isOnline = navigator.onLine;
    this.retryTimeout = null;
    this.maxRetries = 3;
    this.syncInProgress = false;
    
    this.setupNetworkMonitoring();
    this.setupRealtimeSubscription();
  }

  // UPDATED: Use AWS credentials from Identity Pool instead of Cognito JWT
  getAwsCredentials() {
    // Try to get AWS credentials from auth manager
    if (window.authManager?.currentUser?.awsCredentials) {
      return window.authManager.currentUser.awsCredentials;
    }
    
    if (window.dashieAuth?.authManager?.currentUser?.awsCredentials) {
      return window.dashieAuth.authManager.currentUser.awsCredentials;
    }
    
    // Fallback: try to get from saved user data
    try {
      const savedUser = localStorage.getItem('dashie-cognito-user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        return userData.awsCredentials;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get AWS credentials from localStorage:', error);
    }
    
    return null;
  }

  getCurrentUser() {
    // Try multiple sources for current user
    if (window.authManager?.currentUser) {
      return window.authManager.currentUser;
    }
    
    if (window.dashieAuth?.authManager?.currentUser) {
      return window.dashieAuth.authManager.currentUser;
    }
    
    // Fallback to localStorage
    try {
      const savedUser = localStorage.getItem('dashie-cognito-user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (error) {
      console.warn('⚠️ Failed to get user from localStorage:', error);
    }
    
    return null;
  }

  // UPDATED: For Identity Pool, we'll use direct database access with AWS credentials
  // Instead of trying to authenticate Supabase auth, we'll use service role
  async authenticateWithSupabase() {
    const awsCredentials = this.getAwsCredentials();
    const user = this.getCurrentUser();
    
    if (!awsCredentials || !user) {
      console.log('🔒 No AWS credentials or user available, using non-RLS mode');
      this.isRLSMode = false;
      return false;
    }

    console.log('🔒 Found AWS credentials from Identity Pool');
    console.log('🔒 📋 Identity ID:', awsCredentials.identityId);
    console.log('🔒 📋 User:', user.email);
    
    // For Identity Pool approach, we'll use direct database queries
    // The RLS policies should be based on user_email, not auth.uid()
    this.isRLSMode = true;
    this.currentUser = user;
    
    return true;
  }

  // Rest of the class remains largely unchanged
  async loadSettings() {
    await this.authenticateWithSupabase();
    
    const user = this.getCurrentUser();
    if (!user) {
      console.warn('⚙️ No user available for settings load');
      return null;
    }

    try {
      console.log('⚙️ 🔄 Loading settings for user:', user.email);
      
      // Direct query approach - RLS policies should be based on user_email
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_email', user.email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('📊 No settings found for user (new user)');
          return null;
        }
        console.error('📊 Settings query error:', error);
        throw error;
      }

      if (data?.settings) {
        console.log('📊 ✅ Settings loaded from database');
        this.saveToLocalStorage(user.email, data.settings);
        return data.settings;
      }

    } catch (error) {
      console.error('⚙️ ❌ Failed to load settings from database:', error);
      console.log('📊 Using localStorage fallback');
    }
    
    // Fallback to localStorage
    const fallbackSettings = this.loadFromLocalStorage(user.email);
    if (fallbackSettings) {
      console.log('⚙️ 📱 Using localStorage fallback settings');
      return fallbackSettings;
    }
    
    return null;
  }

  async saveSettings(settings) {
    const user = this.getCurrentUser();
    if (!user) {
      console.warn('⚙️ No user available for settings save');
      return false;
    }

    // Always save to localStorage first
    this.saveToLocalStorage(user.email, settings);

    if (!this.isOnline) {
      console.log('⚙️ 📱 Offline: Settings saved locally, will sync when online');
      this.queuePendingChange('save', settings);
      return true;
    }

    try {
      console.log('⚙️ 💾 Saving settings to database for user:', user.email);
      
      const { data, error } = await this.supabase
        .from('user_settings')
        .upsert({
          user_email: user.email,
          settings: settings,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_email'
        });

      if (error) {
        console.error('📊 Settings save error:', error);
        throw error;
      }
      
      console.log('⚙️ ✅ Settings saved to database successfully');
      this.removePendingChange('save');
      return true;

    } catch (error) {
      console.error('⚙️ ❌ Failed to save settings to database:', error);
      this.queuePendingChange('save', settings);
      return false;
    }
  }

  // Local storage and utility methods
  saveToLocalStorage(userEmail, settings) {
    try {
      const storageKey = `dashie-settings-${userEmail}`;
      const storageData = {
        settings,
        lastSync: Date.now(),
        userEmail
      };
      localStorage.setItem(storageKey, JSON.stringify(storageData));
      console.log('📱 Settings saved to localStorage');
    } catch (error) {
      console.error('📱 Failed to save to localStorage:', error);
    }
  }

  loadFromLocalStorage(userEmail) {
    try {
      const storageKey = `dashie-settings-${userEmail}`;
      const storageData = localStorage.getItem(storageKey);
      
      if (storageData) {
        const parsed = JSON.parse(storageData);
        console.log('📱 Loaded settings from localStorage');
        return parsed.settings;
      }
    } catch (error) {
      console.error('📱 Failed to load from localStorage:', error);
    }
    
    return null;
  }

  // Network and sync methods
  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Back online, syncing pending changes...');
      this.syncPendingChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📱 Gone offline, will queue changes');
    });
  }

  queuePendingChange(type, data) {
    this.pendingChanges.push({
      type,
      data,
      timestamp: Date.now()
    });
    console.log(`📋 Queued ${type} change for later sync`);
  }

  removePendingChange(type) {
    this.pendingChanges = this.pendingChanges.filter(change => change.type !== type);
  }

  async syncPendingChanges() {
    if (this.syncInProgress || !this.isOnline || this.pendingChanges.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`🔄 Syncing ${this.pendingChanges.length} pending changes...`);

    const changes = [...this.pendingChanges];
    
    for (const change of changes) {
      try {
        if (change.type === 'save') {
          await this.saveSettings(change.data);
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${change.type} change:`, error);
      }
    }

    this.syncInProgress = false;
    console.log('✅ Pending changes synced');
  }

  setupRealtimeSubscription() {
    const user = this.getCurrentUser();
    if (!user) return;

    try {
      this.supabase
        .channel('user-settings')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'user_settings',
            filter: `user_email=eq.${user.email}`
          }, 
          (payload) => {
            console.log('🔄 Real-time settings update received:', payload);
            // Handle real-time updates if needed
          }
        )
        .subscribe((status) => {
          console.log('📡 Real-time subscription status:', status);
        });
    } catch (error) {
      console.warn('📡 Failed to set up real-time subscription:', error);
    }
  }
}
