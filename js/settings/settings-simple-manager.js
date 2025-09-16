// js/settings/settings-simple-manager.js
// Main orchestrator for simplified settings system

import { buildSettingsUI, populateFormFields, applyTheme } from './settings-ui-builder.js';
import { SimplifiedNavigation } from './settings-d-pad-nav.js';
import { setupEventHandlers } from './settings-event-handler.js';

export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.pendingChanges = {};
    this.keydownHandler = null;
    this.initializationAttempts = 0;
    this.maxInitAttempts = 20;
    
    // Start initialization process with delay
    setTimeout(() => this.initializeController(), 500);
  }

  async initializeController() {
    try {
      this.initializationAttempts++;
      console.log(`⚙️ Settings initialization attempt ${this.initializationAttempts}/${this.maxInitAttempts}`);
      
      const authStatus = this.checkAuthStatus();
      console.log('⚙️ Auth status check:', authStatus);
      
      if (!authStatus.ready) {
        if (this.initializationAttempts < this.maxInitAttempts) {
          console.log('⚙️ Auth not ready, retrying in 500ms...');
          setTimeout(() => this.initializeController(), 500);
          return;
        } else {
          console.warn('⚙️ Max initialization attempts reached, proceeding without full auth');
        }
      }
      
      // Initialize the controller
      const { SettingsController } = await import('./settings-controller.js');
      this.controller = new SettingsController();
      
      const initSuccess = await this.controller.init();
      
      if (initSuccess) {
        console.log('⚙️ ✅ Settings controller initialized successfully');
      } else {
        console.warn('⚙️ ⚠️ Settings controller initialized with fallback mode');
      }
      
    } catch (error) {
      console.error('⚙️ ❌ Settings controller initialization failed:', error);
      this.controller = this.createFallbackController();
      console.log('⚙️ Using fallback localStorage-only controller');
    }
  }

  checkAuthStatus() {
    const hasDashieAuth = window.dashieAuth && typeof window.dashieAuth.isAuthenticated === 'function';
    const isAuthenticated = hasDashieAuth ? window.dashieAuth.isAuthenticated() : false;
    const hasUser = hasDashieAuth ? !!window.dashieAuth.getUser() : false;
    const hasAuthManager = window.authManager && window.authManager.currentUser;
    
    let hasSavedUser = false;
    try {
      const savedUser = localStorage.getItem('dashie-user');
      hasSavedUser = !!savedUser;
    } catch (e) {
      // Ignore localStorage errors
    }
    
    const ready = (hasDashieAuth && isAuthenticated && hasUser) || 
                  hasAuthManager || 
                  hasSavedUser;
    
    return {
      ready,
      hasDashieAuth,
      isAuthenticated,
      hasUser,
      hasAuthManager,
      hasSavedUser,
      userEmail: hasUser ? window.dashieAuth.getUser().email : 
                hasAuthManager ? window.authManager.currentUser.email : 
                'unknown'
    };
  }

  createFallbackController() {
    const userEmail = this.checkAuthStatus().userEmail;
    
    return {
      isInitialized: true,
      currentSettings: this.getDefaultSettings(userEmail),
      
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
      },
      
      setSetting(path, value) {
        const keys = path.split('.');
        let current = this.currentSettings;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
          }
          current = current[key];
        }
        current[keys[keys.length - 1]] = value;
        
        if (path === 'display.theme') {
          this.applyThemeImmediate(value);
        }
        
        return true;
      },
      
      async applyThemeImmediate(theme) {
        try {
          const { switchTheme } = await import('../core/theme.js');
          switchTheme(theme);
          console.log(`⚙️ 🎨 Fallback: Theme applied: ${theme}`);
        } catch (error) {
          console.warn('⚙️ ⚠️ Fallback: Failed to apply theme:', error);
        }
      },
      
      async saveSettings() {
        try {
          localStorage.setItem('dashie-settings', JSON.stringify(this.currentSettings));
          console.log('⚙️ 💾 Fallback: Saved to localStorage');
          return true;
        } catch (error) {
          console.error('⚙️ ❌ Fallback: Failed to save to localStorage:', error);
          return false;
        }
      },
      
      getSettings() {
        return { ...this.currentSettings };
      },
      
      isReady() {
        return true;
      }
    };
  }

  getDefaultSettings(userEmail = 'unknown@example.com') {
    return {
      photos: { transitionTime: 5 },
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
        familyName: 'The Dashie Family',
        members: []
      },
      system: {
        refreshInterval: 30,
        developer: {
          defaultEnvironment: 'prod',
          autoRedirect: false
        }
      },
      version: '2.0.0',
      lastModified: Date.now()
    };
  }

  async show() {
    if (this.isVisible) return;
    
    if (!this.controller) {
      console.log('⚙️ Controller not ready, attempting initialization...');
      await this.initializeController();
      
      if (!this.controller) {
        alert('Settings system not ready. Please try again in a moment.');
        return;
      }
    }
    
    // Create UI using the UI builder
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.innerHTML = buildSettingsUI();
    document.body.appendChild(this.overlay);
    
    // Load and populate current settings
    await this.loadCurrentSettings();
    
    // Set up event handlers
    setupEventHandlers(this.overlay, this);
    
    // Initialize navigation
    this.navigation = new SimplifiedNavigation(this.overlay, {
      onThemeChange: (theme) => this.handleThemeChange(theme),
      onSettingChange: (path, value) => this.handleSettingChange(path, value),
      onSave: () => this.handleSave(),
      onCancel: () => this.handleCancel()
    });
    
    this.showOverlay();
    console.log('⚙️ 👁️ Simplified settings shown');
  }

  async loadCurrentSettings() {
    if (!this.controller) return;
    
    try {
      const currentSettings = this.controller.getSettings();
      console.log('⚙️ Loading current settings:', currentSettings);
      
      populateFormFields(this.overlay, currentSettings);
      applyTheme(this.overlay, currentSettings.display?.theme || 'dark');
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to load current settings:', error);
    }
  }

  handleThemeChange(theme) {
    applyTheme(this.overlay, theme);
    this.pendingChanges['display.theme'] = theme;
    console.log(`⚙️ Theme previewed: ${theme}`);
  }

  handleSettingChange(path, value) {
    this.pendingChanges[path] = value;
    console.log(`⚙️ Setting changed: ${path} = ${value}`);
  }

  async handleSave() {
    if (!this.controller) {
      console.error('⚙️ ❌ No settings controller available');
      await this.initializeController();
      
      if (!this.controller) {
        alert('Settings system not available. Changes cannot be saved.');
        return;
      }
    }

    try {
      console.log('⚙️ 💾 Saving settings:', this.pendingChanges);
      
      for (const [path, value] of Object.entries(this.pendingChanges)) {
        const success = this.controller.setSetting(path, value);
        if (!success) {
          console.warn(`⚙️ ⚠️ Failed to set ${path} = ${value}`);
        }
      }
      
      const success = await this.controller.saveSettings();
      
      if (!success) {
        throw new Error('Save operation returned false');
      }
      
      if (this.pendingChanges['display.theme']) {
        await this.applyThemeToMainDashboard(this.pendingChanges['display.theme']);
      }
      
      this.notifySettingsChanged();
      
      console.log('⚙️ ✅ Settings saved successfully');
      this.hide();
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  }

  handleCancel() {
    if (this.pendingChanges['display.theme']) {
      const originalTheme = this.controller.getSetting('display.theme', 'dark');
      applyTheme(this.overlay, originalTheme);
    }
    
    console.log('⚙️ Settings cancelled');
    this.hide();
  }

  async applyThemeToMainDashboard(theme) {
    try {
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
      console.log(`⚙️ 🎨 Applied theme to main dashboard: ${theme}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Could not apply theme to main dashboard:', error);
    }
  }

  notifySettingsChanged() {
    window.dispatchEvent(new CustomEvent('dashie-settings-changed', {
      detail: this.pendingChanges
    }));
    
    // Update photo widgets
    if (this.pendingChanges['photos.transitionTime']) {
      const photoWidgets = document.querySelectorAll('iframe[src*="photos.html"]');
      photoWidgets.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'update-settings',
              photoTransitionTime: this.pendingChanges['photos.transitionTime']
            }, '*');
          } catch (error) {
            console.warn('⚙️ ⚠️ Failed to update photo widget:', error);
          }
        }
      });
    }
    
    // NEW: Update header widget with family name
    if (this.pendingChanges['family.familyName']) {
      const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');
      headerWidgets.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'family-name-update',
              familyName: this.pendingChanges['family.familyName']
            }, '*');
            console.log('👨‍👩‍👧‍👦 Sent family name update to header:', this.pendingChanges['family.familyName']);
          } catch (error) {
            console.warn('⚙️ ⚠️ Failed to update header widget:', error);
          }
        }
      });
      
      // Also send global event for widgets that listen to it
      const headerFrames = document.querySelectorAll('iframe[src*="header.html"]');
      headerFrames.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'dashie-settings-changed',
              detail: this.pendingChanges
            }, '*');
          } catch (error) {
            console.warn('⚙️ ⚠️ Failed to send settings change to header:', error);
          }
        }
      });
    }
  }

  hide() {
    if (!this.isVisible) return;
    
    this.hideOverlay();
    this.cleanup();
    
    console.log('⚙️ 👁️ Simplified settings hidden');
  }

  showOverlay() {
    this.overlay.classList.add('active');
    this.isVisible = true;
  }

  hideOverlay() {
    this.overlay.classList.remove('active');
    this.isVisible = false;
  }

  cleanup() {
    if (this.navigation) {
      this.navigation.destroy();
      this.navigation = null;
    }
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    this.pendingChanges = {};
  }
}

export { SimplifiedSettings as default };
