// js/settings/settings-controller.js - FIXED: Add site redirect functionality
// Fixed controller with proper auth timing and site redirect system

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
        { id: 'system', label: '🔧 System', icon: '🔧', enabled: true }, // NOW ENABLED
        { id: 'about', label: 'ℹ️ About', icon: 'ℹ️', enabled: false }
      ]
    };
    
    // Bind methods to maintain context
    this.handleRealtimeUpdate = this.handleRealtimeUpdate.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  // Initialize with better auth detection and error handling
  async init() {
    try {
      console.log('⚙️ Initializing Settings Controller...');
      
      // Wait for auth to be ready with timeout
      const currentUser = await this.waitForAuth(5000); // 5 second timeout
      
      if (!currentUser) {
        console.warn('⚙️ ⚠️ No authenticated user, using localStorage only');
        // Don't throw error - initialize with local storage only
        this.currentSettings = this.getDefaultSettings();
        this.isInitialized = true;
        
        // NEW: Check site redirect even without auth
        await this.checkSiteRedirect();
        
        return true;
      }

      console.log('⚙️ Found authenticated user:', currentUser.email);

      // Initialize storage with current user
      const { SimpleSupabaseStorage } = await import('../supabase/simple-supabase-storage.js');
      this.storage = new SimpleSupabaseStorage(currentUser.id, currentUser.email);
      
      // Load settings from database/local storage
      const loadedSettings = await this.storage.loadSettings();
      this.currentSettings = loadedSettings || this.getDefaultSettings(currentUser.email);
      
      // Apply loaded settings immediately (theme AND family name)
      await this.applyLoadedSettings();
      
      // NEW: Check site redirect after settings are loaded
      await this.checkSiteRedirect();
      
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
      
      // Still check site redirect on fallback
      await this.checkSiteRedirect();
      
      return false;
    }
  }

  // NEW: Site redirect functionality
  async checkSiteRedirect() {
    try {
      const autoRedirect = this.currentSettings.system?.autoRedirect;
      const targetSite = this.currentSettings.system?.activeSite || 'prod';
      const currentSite = this.detectCurrentSite();
      
      console.log('🌐 Site redirect check:', {
        autoRedirect,
        targetSite,
        currentSite,
        shouldRedirect: autoRedirect && targetSite !== currentSite
      });
      
      if (autoRedirect && targetSite !== currentSite) {
        console.log(`🌐 Auto-redirecting from ${currentSite} to ${targetSite}`);
        this.performSiteRedirect(targetSite, false); // false = no confirmation on startup
      } else {
        console.log('🌐 No redirect needed');
      }
    } catch (error) {
      console.error('🌐 ❌ Site redirect check failed:', error);
    }
  }

  // NEW: Detect current site
  detectCurrentSite() {
    const hostname = window.location.hostname;
    
    if (hostname === 'dashieapp.com' || hostname === 'www.dashieapp.com') {
      return 'prod';
    } else if (hostname === 'dev.dashieapp.com') {
      return 'dev';
    } else {
      return 'other';
    }
  }

  // NEW: Perform site redirect
  performSiteRedirect(targetSite, showConfirmation = true) {
    const urls = {
      prod: 'https://dashieapp.com',
      dev: 'https://dev.dashieapp.com'
    };
    
    const targetUrl = urls[targetSite];
    if (!targetUrl) {
      console.error('🌐 ❌ Invalid target site:', targetSite);
      return;
    }
    
    const currentSite = this.detectCurrentSite();
    if (currentSite === targetSite) {
      console.log('🌐 Already on target site, no redirect needed');
      return;
    }
    
    if (showConfirmation) {
      // Show confirmation modal
      this.showSiteChangeConfirmation(targetSite, targetUrl);
    } else {
      // Direct redirect (startup)
      console.log(`🌐 🔄 Redirecting to ${targetUrl}`);
      window.location.href = targetUrl;
    }
  }

  // NEW: Show site change confirmation modal
  showSiteChangeConfirmation(targetSite, targetUrl) {
    const siteName = targetSite === 'prod' ? 'Production' : 'Development';
    
    const modal = document.createElement('div');
    modal.className = 'site-change-modal-backdrop';
    modal.innerHTML = `
      <div class="site-change-modal">
        <div class="modal-header">
          <h3>Switch to ${siteName} Site?</h3>
        </div>
        <div class="modal-content">
          <p>You are about to switch to the ${siteName} site:</p>
          <div class="target-url">${targetUrl}</div>
          <p>This will redirect you to a different site. Continue?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="site-change-cancel">Cancel</button>
          <button class="btn btn-primary" id="site-change-confirm">Switch Site</button>
        </div>
      </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
      .site-change-modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .site-change-modal {
        background: #FCFCFF;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        color: #424242;
      }
      
      .site-change-modal .modal-header h3 {
        margin: 0 0 16px 0;
        font-size: 20px;
        color: #424242;
      }
      
      .site-change-modal .modal-content p {
        margin: 8px 0;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .site-change-modal .target-url {
        background: #f8f9fa;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        margin: 12px 0;
        border: 1px solid #dadce0;
        color: #1a73e8;
      }
      
      .site-change-modal .modal-footer {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 20px;
      }
      
      .site-change-modal .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .site-change-modal .btn-secondary {
        background: #f8f9fa;
        color: #5f6368;
        border: 1px solid #dadce0;
      }
      
      .site-change-modal .btn-primary {
        background: #1a73e8;
        color: white;
      }
      
      .site-change-modal .btn:hover {
        transform: translateY(-1px);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('#site-change-cancel').addEventListener('click', () => {
      modal.remove();
      style.remove();
      
      // Revert the setting
      this.revertSiteSetting();
    });
    
    modal.querySelector('#site-change-confirm').addEventListener('click', () => {
      modal.remove();
      style.remove();
      
      console.log(`🌐 🔄 User confirmed redirect to ${targetUrl}`);
      window.location.href = targetUrl;
    });
    
    // Click backdrop to cancel
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.querySelector('#site-change-cancel').click();
      }
    });
  }

  // NEW: Revert site setting if user cancels
  revertSiteSetting() {
    const currentSite = this.detectCurrentSite();
    if (currentSite !== 'other') {
      console.log('🌐 🔄 Reverting site setting to current site:', currentSite);
      this.setSetting('system.activeSite', currentSite);
      
      // Update UI if settings modal is open
      const activeSiteSelect = document.querySelector('#active-site-select');
      if (activeSiteSelect) {
        activeSiteSelect.value = currentSite;
      }
    }
  }

  // Wait for auth system to be ready
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

  // Apply loaded settings to the dashboard (theme AND family name)
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
    
    // Apply family name to header widgets (same pattern as theme)
    const familyName = this.currentSettings.family?.familyName;
    if (familyName) {
      console.log('⚙️ 👨‍👩‍👧‍👦 Applying loaded family name:', familyName);
      try {
        await this.applyFamilyNameToWidgets(familyName);
        console.log('⚙️ ✅ Family name applied successfully');
      } catch (error) {
        console.warn('⚙️ ⚠️ Failed to apply family name:', error);
      }
    }
    
    // Apply other settings as needed
    // TODO: Add photo transition time, sleep settings, etc.
  }

  // Apply family name to widgets (mirrors theme application)
  async applyFamilyNameToWidgets(familyName) {
    // Give widgets time to load before sending family name
    setTimeout(() => {
      const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');
      
      console.log(`👨‍👩‍👧‍👦 📤 Sending family name "${familyName}" to ${headerWidgets.length} header widgets`);
      
      headerWidgets.forEach((iframe, index) => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'family-name-update',
              familyName: familyName
            }, '*');
            
            console.log(`👨‍👩‍👧‍👦 ✅ Sent family name to header widget ${index + 1}`);
          } catch (error) {
            console.warn(`👨‍👩‍👧‍👦 ⚠️ Failed to send family name to header widget ${index + 1}:`, error);
          }
        } else {
          console.warn(`👨‍👩‍👧‍👦 ⚠️ Header widget ${index + 1} contentWindow not available`);
        }
      });
      
      // Also dispatch global event
      window.dispatchEvent(new CustomEvent('dashie-family-name-loaded', {
        detail: { familyName }
      }));
      
    }, 1000); // Wait 1 second for widgets to load
  }

  // Default settings with proper user email and NEW system settings
  getDefaultSettings(userEmail = 'unknown@example.com') {
    // Detect current site for default
    const currentSite = this.detectCurrentSite();
    const defaultSite = currentSite !== 'other' ? currentSite : 'prod';
    
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
      
      // Family settings
      family: {
        familyName: 'Dashie',
        members: []
      },
      
      // NEW: System settings with site management
      system: {
        activeSite: defaultSite, // 'prod' or 'dev'
        autoRedirect: true, // Auto-redirect on startup
        debugMode: false, // Enable debug logging
        refreshInterval: 30 // seconds
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

  // Set setting with immediate application and NEW site redirect handling
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
      
      // Apply theme immediately if it's a theme setting
      if (path === 'display.theme') {
        this.applyThemeImmediate(value);
      }
      
      // Apply family name immediately if it's a family name setting
      if (path === 'family.familyName') {
        this.applyFamilyNameImmediate(value);
      }
      
      // NEW: Handle site change immediately
      if (path === 'system.activeSite') {
        this.handleSiteChange(value);
      }
      
      // Auto-save after a short delay (debounced)
      this.scheduleAutoSave();
      
      return true;
    } else {
      console.log(`⚙️ ℹ️ Setting unchanged: ${path} = ${value}`);
      return true;
    }
  }

  // NEW: Handle site change
  handleSiteChange(newSite) {
    const currentSite = this.detectCurrentSite();
    
    console.log('🌐 Site setting changed:', {
      newSite,
      currentSite,
      needsRedirect: newSite !== currentSite
    });
    
    if (newSite !== currentSite) {
      // Show confirmation and redirect
      this.performSiteRedirect(newSite, true); // true = show confirmation
    }
  }

  // Apply theme immediately when setting changes
  async applyThemeImmediate(theme) {
    try {
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
      console.log(`⚙️ 🎨 Theme applied immediately: ${theme}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Failed to apply theme immediately:', error);
    }
  }

  // Apply family name immediately when setting changes
  async applyFamilyNameImmediate(familyName) {
    try {
      await this.applyFamilyNameToWidgets(familyName);
      console.log(`⚙️ 👨‍👩‍👧‍👦 Family name applied immediately: ${familyName}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Failed to apply family name immediately:', error);
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
      
      // Check if site redirect is needed
      this.checkSiteRedirect();
      
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
