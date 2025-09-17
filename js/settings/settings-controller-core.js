// js/settings/settings-controller-core.js - Core settings functionality
// Core initialization, auth, and basic settings management

export class SettingsControllerCore {
  constructor() {
    this.storage = null;
    this.currentSettings = {};
    this.isDirty = false;
    this.isInitialized = false;
    this.realtimeSubscription = null;
    
    // Define which settings should be stored locally only (device-specific)
    this.LOCAL_ONLY_SETTINGS = [
      'system.autoRedirect',
      'system.debugMode'
    ];
    
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
        { id: 'system', label: '🔧 System', icon: '🔧', enabled: true },
        { id: 'about', label: 'ℹ️ About', icon: 'ℹ️', enabled: false }
      ]
    };
    
    // Bind methods to maintain context
    this.handleRealtimeUpdate = this.handleRealtimeUpdate.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  // Initialize with auth detection and error handling
  async init() {
    try {
      console.log('⚙️ Initializing Settings Controller...');
      
      // Wait for auth to be ready with timeout
      const currentUser = await this.waitForAuth(5000);
      
      if (!currentUser) {
        console.warn('⚙️ No authenticated user, using localStorage only');
        this.currentSettings = this.getDefaultSettings();
        this.isInitialized = true;
        
        this.mergeLocalOnlySettings();
        await this.applyLoadedSettings();
        
        return true;
      }

      console.log('⚙️ Found authenticated user:', currentUser.email);

      // Initialize storage with current user
      const { SimpleSupabaseStorage } = await import('../supabase/simple-supabase-storage.js');
      this.storage = new SimpleSupabaseStorage(currentUser.id, currentUser.email);
      
      // Load settings from database/local storage
      const loadedSettings = await this.storage.loadSettings();
      this.currentSettings = loadedSettings || this.getDefaultSettings(currentUser.email);
      
      this.mergeLocalOnlySettings();
      await this.applyLoadedSettings();
      
      // Set up real-time sync
      this.setupRealtimeSync();
      
      // Set up auto-save on page unload
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      
      this.isInitialized = true;
      console.log('⚙️ ✅ Settings Controller initialized successfully');
      
      return true;
      
    } catch (error) {
      console.error('⚙️ ❌ Settings Controller initialization failed:', error);
      
      this.currentSettings = this.getDefaultSettings();
      this.isInitialized = true;
      
      this.mergeLocalOnlySettings();
      await this.applyLoadedSettings();
      
      return false;
    }
  }

  // Wait for auth system to be ready
  async waitForAuth(timeoutMs = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const user = this.getCurrentUser();
      if (user) {
        return user;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
  }

  // Better auth detection with multiple fallbacks
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
        if (parsed.savedAt && (Date.now() - parsed.savedAt < 30 * 24 * 60 * 60 * 1000)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to get user from localStorage:', error);
    }
    
    return null;
  }

  // Default settings with proper user email and system settings
  getDefaultSettings(userEmail = 'unknown@example.com') {
    // Detect current site for default
    const currentSite = this.detectCurrentSite();
    const defaultSite = currentSite !== 'other' ? currentSite : 'prod';
    
    return {
      photos: {
        transitionTime: 5
      },
      display: {
        sleepTime: '22:00',
        wakeTime: '07:00', 
        reSleepDelay: 30,
        theme: 'dark'
      },
      accounts: {
        dashieAccount: userEmail,
        connectedServices: [],
        pinEnabled: false
      },
      family: {
        familyName: 'Dashie',
        members: []
      },
      system: {
        activeSite: defaultSite,
        refreshInterval: 30
        // NOTE: autoRedirect and debugMode will come from localStorage
      },
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

  // Set setting with immediate application
  setSetting(path, value) {
    if (!this.isInitialized) {
      console.warn('⚙️ Settings not initialized, cannot set:', path);
      return false;
    }

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
      
      // Apply immediate changes for specific settings
      if (path === 'display.theme') {
        this.applyThemeImmediate(value);
      }
      
      if (path === 'family.familyName') {
        this.applyFamilyNameImmediate(value);
      }
      
      if (path === 'system.activeSite') {
        this.handleSiteChange(value);
      }
      
      // Auto-save after a short delay (debounced)
      this.scheduleAutoSave();
      
      return true;
    } else {
      return true;
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
    
    this.scheduleAutoSave();
    
    return true;
  }

  // Auto-save with debouncing
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(async () => {
      await this.saveSettings();
    }, 2000);
  }

  // Set up real-time synchronization
  setupRealtimeSync() {
    if (!this.storage) return;

    try {
      this.realtimeSubscription = this.storage.subscribeToChanges(this.handleRealtimeUpdate);
      console.log('⚙️ Real-time sync enabled');
    } catch (error) {
      console.warn('⚙️ Real-time sync setup failed:', error);
    }
  }

  // Handle real-time updates from other devices
  handleRealtimeUpdate(newSettings) {
    const localTime = this.currentSettings.lastModified || 0;
    const remoteTime = newSettings.lastModified || 0;
    
    if (remoteTime > localTime) {
      console.log('⚙️ Applying remote settings update');
      this.currentSettings = newSettings;
      this.isDirty = false;
      
      this.applyLoadedSettings();
      this.checkSiteRedirectSync();
      this.notifyUIUpdate();
    }
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
      this.navigationState.selectedSetting = 0;
      return true;
    }
    return false;
  }

  setPanel(panel) {
    if (['categories', 'settings'].includes(panel)) {
      this.navigationState.currentPanel = panel;
    }
  }

  getCurrentPanel() {
    return this.navigationState.currentPanel;
  }

  // Notify UI components of settings changes
  notifyUIUpdate() {
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { settings: this.currentSettings }
    }));
  }

  // Handle page unload
  handleBeforeUnload(event) {
    if (this.isDirty) {
      this.saveSettings();
    }
  }

  // Utility methods
  isReady() {
    return this.isInitialized;
  }

  getSettings() {
    return { ...this.currentSettings };
  }

  // Cleanup
  async cleanup() {
    console.log('⚙️ Cleaning up Settings Controller...');
    
    if (this.isDirty) {
      await this.saveSettings();
    }
    
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    if (this.realtimeSubscription) {
      this.storage?.unsubscribeAll();
    }
    
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    console.log('⚙️ Settings Controller cleaned up');
  }

  // Placeholder methods that will be implemented in features file
  mergeLocalOnlySettings() {
    throw new Error('mergeLocalOnlySettings must be implemented in features class');
  }

  applyLoadedSettings() {
    throw new Error('applyLoadedSettings must be implemented in features class');
  }

  saveSettings() {
    throw new Error('saveSettings must be implemented in features class');
  }

  detectCurrentSite() {
    throw new Error('detectCurrentSite must be implemented in features class');
  }

  checkSiteRedirectSync() {
    throw new Error('checkSiteRedirectSync must be implemented in features class');
  }

  applyThemeImmediate() {
    throw new Error('applyThemeImmediate must be implemented in features class');
  }

  applyFamilyNameImmediate() {
    throw new Error('applyFamilyNameImmediate must be implemented in features class');
  }

  handleSiteChange() {
    throw new Error('handleSiteChange must be implemented in features class');
  }
}
