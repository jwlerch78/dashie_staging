// js/ui/settings/settings-controller.js
// Main settings controller with database integration and real-time sync

class SettingsController {
  constructor() {
    this.storage = null;
    this.currentSettings = {};
    this.isDirty = false;
    this.isInitialized = false;
    this.realtimeSubscription = null;
    
    // Navigation state for two-panel UI
    this.navigationState = {
      currentPanel: 'categories', // 'categories' or 'settings'
      selectedCategory: 'display', // Default to display since it has working features
      selectedSetting: 0,
      categories: [
        { 
          id: 'accounts', 
          label: '🔐 Accounts', 
          icon: '🔐',
          enabled: true 
        },
        { 
          id: 'family', 
          label: '👨‍👩‍👧‍👦 Family', 
          icon: '👨‍👩‍👧‍👦',
          enabled: false  // Grayed out for now
        },
        { 
          id: 'widgets', 
          label: '🖼️ Widgets', 
          icon: '🖼️',
          enabled: true 
        },
        { 
          id: 'display', 
          label: '🎨 Display', 
          icon: '🎨',
          enabled: true 
        },
        { 
          id: 'system', 
          label: '🔧 System', 
          icon: '🔧',
          enabled: false  // Grayed out for now
        },
        { 
          id: 'about', 
          label: 'ℹ️ About', 
          icon: 'ℹ️',
          enabled: false  // Grayed out for now
        }
      ]
    };
    
    // Bind methods to maintain context
    this.handleRealtimeUpdate = this.handleRealtimeUpdate.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  // Initialize the settings system
  async init() {
    try {
      console.log('⚙️ Initializing Settings Controller...');
      
      // Get current user from auth system
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Initialize storage with current user
      const { SimpleSupabaseStorage } = await import('../../supabase/simple-supabase-storage.js');
      this.storage = new SimpleSupabaseStorage(currentUser.id, currentUser.email);
      
      // Load settings from database/local storage
      const loadedSettings = await this.storage.loadSettings();
      this.currentSettings = loadedSettings || this.getDefaultSettings();
      
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

  // Get current user from the existing auth system
  getCurrentUser() {
    // Import the auth manager to get current user
    if (window.authManager && window.authManager.currentUser) {
      return window.authManager.currentUser;
    }
    
    // Fallback: try to get from localStorage
    try {
      const savedUser = localStorage.getItem('dashie-current-user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (error) {
      console.warn('Failed to get user from localStorage:', error);
    }
    
    return null;
  }

  // Default settings structure
  getDefaultSettings() {
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
        dashieAccount: this.getCurrentUser()?.email || 'unknown@example.com',
        connectedServices: [], // Will be populated later
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

  // Set a specific setting value with dot notation
  setSetting(path, value) {
    if (!this.isInitialized) {
      console.warn('⚙️ Settings not initialized, cannot set:', path);
      return false;
    }

    const keys = path.split('.');
    let current = this.currentSettings;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
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
      console.log(`⚙️ Setting updated: ${path} = ${value}`);
      
      // Auto-save after a short delay (debounced)
      this.scheduleAutoSave();
    }
    
    return true;
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
    if (!this.isDirty || !this.storage) {
      return true;
    }

    try {
      console.log('⚙️ 💾 Saving settings to database...');
      await this.storage.saveSettings(this.currentSettings);
      this.isDirty = false;
      console.log('⚙️ ✅ Settings saved successfully');
      return true;
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to save settings:', error);
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

// Export the settings controller
export { SettingsController };
