// js/settings/settings-controller.js
// Fixed controller with proper auth timing and theme application

export class SettingsController {
  constructor() {
    this.storage = null;
    this.currentSettings = {};
    this.isDirty = false;
    this.isInitialized = false;
    this.realtimeSubscription = null;
    
    // Navigation state for two-panel UI
    this.navigationState = {
      currentPanel: 'categories',
      selectedCategory: 'display',
      selectedSetting: 0,
      categories: [
        { id: 'accounts', label: '🔐 Accounts', icon: '🔐', enabled: true },
        { id: 'family', label: '👨‍👩‍👧‍👦 Family', icon: '👨‍👩‍👧‍👦', enabled: false },
        { id: 'widgets', label: '🖼️ Widgets', icon: '🖼️', enabled: true },
        { id: 'display', label: '🎨 Display', icon: '🎨', enabled: true },
        { id: 'system', label: '🔧 System', icon: '🔧', enabled: false },
        { id: 'about', label: 'ℹ️ About', icon: 'ℹ️', enabled: false }
      ]
    };
    
    // Bind methods to maintain context
    this.handleRealtimeUpdate = this.handleRealtimeUpdate.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  // FIXED: Initialize with better auth detection and error handling
  async init() {
    try {
      console.log('⚙️ Initializing Settings Controller...');
      
      // IMPROVED: Wait for auth to be ready with timeout
      const currentUser = await this.waitForAuth(5000); // 5 second timeout
      
      if (!currentUser) {
        console.warn('⚙️ ⚠️ No authenticated user, using localStorage only');
        // Don't throw error - initialize with local storage only
        this.currentSettings = this.getDefaultSettings();
        this.isInitialized = true;
        return true;
      }

      console.log('⚙️ Found authenticated user:', currentUser.email);

      // Initialize storage with current user
      const { SimpleSupabaseStorage } = await import('../supabase/simple-supabase-storage.js');
      this.storage = new SimpleSupabaseStorage(currentUser.id, currentUser.email);
      
      // Load settings from database/local storage
      const loadedSettings = await this.storage.loadSettings();
      this.currentSettings = loadedSettings || this.getDefaultSettings(currentUser.email);
      
      // FIXED: Apply loaded theme immediately
      await this.applyLoadedSettings();
      
      // Set up real-time sync
      this.setupRealtimeSync();
      
      // Set up auto-save on page unload
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      
      this.isInitialized = true;
      console.log('⚙️ ✅ Settings Controller initialized successfully');
      console.log('⚙️ Current settings:', this.currentSettings);
      
      return true;
      
    } catch (error) {
      console.error('⚙️ ❌ Settings Controller initialization failed:', error);
      
      // Fallback to defaults if database fails
      this.currentSettings = this.getDefaultSettings();
      this.isInitialized = true;
      
      return false;
    }
  }

  // NEW: Wait for auth system to be ready
  async waitForAuth(timeoutMs = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const user = this.getCurrentUser();
      if (user) {
        console.log('⚙️ 🔐 Auth ready, found user:', user.email);
        return user;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('⚙️ ⚠️ Auth timeout after', timeoutMs, 'ms');
    return null;
  }

  // IMPROVED: Better auth detection with multiple fallbacks
  getCurrentUser() {
    // Method 1: Check global dashieAuth
    if (window.dashieAuth && window.dashieAuth.isAuthenticated()) {
      const user = window.dashieAuth.getUser();
      if (user) return user;
    }
    
    // Method 2: Check global authManager
    if (window.authManager && window.authManager.currentUser) {
      return window.authManager.currentUser;
    }
    
    // Method 3: Check for saved user in localStorage
    try {
      const savedUser = localStorage.getItem('dashie-user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        // Verify it's not expired (basic check)
        if (parsed.savedAt && (Date.now() - parsed.savedAt < 30 * 24 * 60 * 60 * 1000)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to get user from localStorage:', error);
    }
    
    return null;
  }

  // NEW: Apply loaded settings to the dashboard
  async applyLoadedSettings() {
    if (!this.currentSettings) return;
    
    // Apply theme if it exists
    const theme = this.currentSettings.display?.theme;
    if (theme) {
      console.log('⚙️ 🎨 Applying loaded theme:', theme);
      try {
        // Import and apply theme
        const { switchTheme } = await import('../core/theme.js');
        switchTheme(theme);
        console.log('⚙️ ✅ Theme applied successfully');
      } catch (error) {
        console.warn('⚙️ ⚠️ Failed to apply theme:', error);
      }
    }
    
    // Apply other settings as needed
    // TODO: Add photo transition time, sleep settings, etc.
  }

  // IMPROVED: Default settings with proper user email
  getDefaultSettings(userEmail = 'unknown@example.com') {
    return {
      // Photos widget settings
      photos: {
        transitionTime: 5 // seconds
      },
      
      // Display settings (sleep/wake times + theme)
      display: {
        sleepTime: '22:00',
        wakeTime: '07:00', 
        reSleepDelay: 30, // minutes
        theme: 'dark' // 'dark' or 'light'
      },
      
      // Account settings
      accounts: {
        dashieAccount: userEmail,
        connectedServices: [],
        pinEnabled: false
      },
      
      // Family settings (placeholder for future)
      family: {
        familyName: '',
        members: []
      },
      
      // System settings (placeholder for future)
      system: {
        refreshInterval: 30, // seconds
        developer: {
          defaultEnvironment: 'prod', // 'prod' or 'dev'
          autoRedirect: false
        }
      },
      
      // Metadata
      version: '2.0.0',
      lastModified: Date.now()
    };
  }

  // Get a specific setting value with dot notation
  getSetting(path) {
    const keys = path.split('.');
    let current = this.currentSettings;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  // IMPROVED: Set setting with immediate theme application
  setSetting(path, value) {
    if (!this.isInitialized) {
      console.warn('⚙️ Settings not initialized, cannot set:', path);
      return false;
    }

    console.log(`⚙️ 🔧 Setting ${path} = ${value}`);

    const keys = path.split('.');
    let current = this.currentSettings;
    
    // Navigate to the parent object, creating nested objects as needed
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the final value
    const finalKey = keys[keys.length - 1];
    const oldValue = current[finalKey];
    current[finalKey] = value;
    
    // Mark as dirty if value changed
    if (oldValue !== value) {
      this.isDirty = true;
      this.currentSettings.lastModified = Date.now();
      console.log(`⚙️ ✅ Setting updated: ${path} = ${value} (was: ${oldValue})`);
      
      // IMPROVED: Apply theme immediately if it's a theme setting
      if (path === 'display.theme') {
        this.applyThemeImmediate(value);
      }
      
      // Auto-save after a short delay (debounced)
      this.scheduleAutoSave();
      
      return true;
    } else {
      console.log(`⚙️ ℹ️ Setting unchanged: ${path} = ${value}`);
      return true;
    }
  }

  // NEW: Apply theme immediately when setting changes
  async applyThemeImmediate(theme) {
    try {
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
      console.log(`⚙️ 🎨 Theme applied immediately: ${theme}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Failed to apply theme immediately:', error);
    }
  }

  // Get all settings for a category
  getCategorySettings(categoryId) {
    return this.currentSettings[categoryId] || {};
  }

  // Set multiple settings for a category
  setCategorySettings(categoryId, settings) {
    if (!this.isInitialized) {
      console.warn('⚙️ Settings not initialized, cannot set category:', categoryId);
      return false;
    }

    this.currentSettings[categoryId] = { ...this.currentSettings[categoryId], ...settings };
    this.isDirty = true;
    this.currentSettings.lastModified = Date.now();
    
    console.log(`⚙️ Category settings updated: ${categoryId}`, settings);
    this.scheduleAutoSave();
    
    return true;
  }

  // Save settings to database
  async saveSettings() {
    console.log('⚙️ 💾 saveSettings called');
    console.log('⚙️ 💾 isDirty:', this.isDirty);
    console.log('⚙️ 💾 storage exists:', !!this.storage);

    if (!this.isDirty) {
      console.log('⚙️ 💾 No changes to save');
      return true;
    }

    if (!this.storage) {
      console.warn('⚙️ 💾 No storage available, saving to localStorage only');
      try {
        localStorage.setItem('dashie-settings', JSON.stringify(this.currentSettings));
        this.isDirty = false;
        console.log('⚙️ ✅ Settings saved to localStorage');
        return true;
      } catch (error) {
        console.error('⚙️ ❌ Failed to save to localStorage:', error);
        return false;
      }
    }

    try {
      console.log('⚙️ 💾 Calling storage.saveSettings...');
      await this.storage.saveSettings(this.currentSettings);
      this.isDirty = false;
      console.log('⚙️ ✅ Settings saved successfully to storage');
      return true;
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to save settings to storage:', error);
      return false;
    }
  }

  // Auto-save with debouncing
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(async () => {
      await this.saveSettings();
    }, 2000); // Save 2 seconds after last change
  }

  // Set up real-time synchronization
  setupRealtimeSync() {
    if (!this.storage) return;

    try {
      this.realtimeSubscription = this.storage.subscribeToChanges(this.handleRealtimeUpdate);
      console.log('⚙️ 🔄 Real-time sync enabled');
    } catch (error) {
      console.warn('⚙️ ⚠️ Real-time sync setup failed:', error);
    }
  }

  // Handle real-time updates from other devices
  handleRealtimeUpdate(newSettings) {
    console.log('⚙️ 🔄 Received settings update from another device');
    
    // Check if our local settings are newer
    const localTime = this.currentSettings.lastModified || 0;
    const remoteTime = newSettings.lastModified || 0;
    
    if (remoteTime > localTime) {
      console.log('⚙️ 🔄 Applying remote settings (newer)');
      this.currentSettings = newSettings;
      this.isDirty = false;
      
      // Apply the updated settings
      this.applyLoadedSettings();
      
      // Notify UI to refresh if settings panel is open
      this.notifyUIUpdate();
    } else {
      console.log('⚙️ 🔄 Ignoring remote settings (older than local)');
    }
  }

  // Notify UI components of settings changes
  notifyUIUpdate() {
    // Dispatch custom event for UI components to listen to
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { settings: this.currentSettings }
    }));
  }

  // Navigation methods for two-panel UI
  getCurrentCategory() {
    return this.navigationState.categories.find(cat => 
      cat.id === this.navigationState.selectedCategory
    );
  }

  getEnabledCategories() {
    return this.navigationState.categories.filter(cat => cat.enabled);
  }

  selectCategory(categoryId) {
    const category = this.navigationState.categories.find(cat => cat.id === categoryId);
    if (category && category.enabled) {
      this.navigationState.selectedCategory = categoryId;
      this.navigationState.selectedSetting = 0; // Reset setting selection
      return true;
    }
    return false;
  }

  // Navigation state management
  setPanel(panel) {
    if (['categories', 'settings'].includes(panel)) {
      this.navigationState.currentPanel = panel;
    }
  }

  getCurrentPanel() {
    return this.navigationState.currentPanel;
  }

  // Cleanup
  async cleanup() {
    console.log('⚙️ 🧹 Cleaning up Settings Controller...');
    
    // Save any pending changes
    if (this.isDirty) {
      await this.saveSettings();
    }
    
    // Clear auto-save timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    // Unsubscribe from real-time updates
    if (this.realtimeSubscription) {
      this.storage?.unsubscribeAll();
    }
    
    // Remove event listeners
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    console.log('⚙️ ✅ Settings Controller cleaned up');
  }

  // Handle page unload
  handleBeforeUnload(event) {
    if (this.isDirty) {
      // Save synchronously on page unload
      this.saveSettings();
    }
  }

  // Utility method to check if settings are loaded
  isReady() {
    return this.isInitialized;
  }

  // Get current settings (read-only copy)
  getSettings() {
    return { ...this.currentSettings };
  }
}
