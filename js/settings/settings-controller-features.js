// js/settings/settings-controller-features.js - Feature methods for settings
// Local-only settings, site redirect, theme/family name application

export class SettingsControllerFeatures {
  // Merge local-only settings from localStorage
  mergeLocalOnlySettings() {
    try {
      const localSettingsJson = localStorage.getItem('dashie-local-settings');
      
      if (!localSettingsJson) {
        this.ensureLocalOnlyDefaults();
        return;
      }
      
      const localSettings = JSON.parse(localSettingsJson);
      
      // Merge each local-only setting
      this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
        const value = this.getNestedValue(localSettings, settingPath);
        if (value !== undefined) {
          this.setNestedValue(this.currentSettings, settingPath, value);
        }
      });
      
      // Ensure any missing local-only settings have defaults
      this.ensureLocalOnlyDefaults();
      
    } catch (error) {
      console.error('Failed to load local-only settings:', error);
      this.ensureLocalOnlyDefaults();
    }
  }

  // Ensure local-only settings have default values
  ensureLocalOnlyDefaults() {
    const defaults = {
      'system.autoRedirect': false,
      'system.debugMode': false
    };
    
    this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
      const currentValue = this.getNestedValue(this.currentSettings, settingPath);
      if (currentValue === undefined) {
        const defaultValue = defaults[settingPath];
        if (defaultValue !== undefined) {
          this.setNestedValue(this.currentSettings, settingPath, defaultValue);
        }
      }
    });
  }

  // Helper to get nested object values using dot notation
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  // Helper to set nested object values using dot notation
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let target = obj;
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
  }

  // Save settings to database with local-only filtering
  async saveSettings() {
    if (!this.isDirty) {
      return true;
    }

    // Save local-only settings to localStorage first
    await this.saveLocalOnlySettings();

    if (!this.storage) {
      try {
        localStorage.setItem('dashie-settings', JSON.stringify(this.currentSettings));
        this.isDirty = false;
        return true;
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
        return false;
      }
    }

    try {
      // Filter out local-only settings before saving to database
      const databaseSettings = this.filterOutLocalOnlySettings(this.currentSettings);
      
      await this.storage.saveSettings(databaseSettings);
      this.isDirty = false;
      return true;
      
    } catch (error) {
      console.error('Failed to save settings to storage:', error);
      return false;
    }
  }

  // Save local-only settings to localStorage
  async saveLocalOnlySettings() {
    try {
      const localSettings = {};
      
      // Extract local-only settings
      this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
        const value = this.getNestedValue(this.currentSettings, settingPath);
        if (value !== undefined) {
          this.setNestedValue(localSettings, settingPath, value);
        }
      });
      
      localStorage.setItem('dashie-local-settings', JSON.stringify(localSettings));
      
    } catch (error) {
      console.error('Failed to save local-only settings:', error);
    }
  }

  // Filter out local-only settings from an object
  filterOutLocalOnlySettings(settings) {
    const filtered = JSON.parse(JSON.stringify(settings)); // Deep clone
    
    this.LOCAL_ONLY_SETTINGS.forEach(settingPath => {
      this.deleteNestedValue(filtered, settingPath);
    });
    
    return filtered;
  }

  // Helper to delete nested values using dot notation
  deleteNestedValue(obj, path) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      return current && current[key] ? current[key] : null;
    }, obj);
    
    if (target && lastKey in target) {
      delete target[lastKey];
    }
  }

  // Apply loaded settings with site redirect check FIRST
  async applyLoadedSettings() {
    if (!this.currentSettings) {
      return;
    }
    
    // FIRST: Check site redirect before applying anything else
    const redirected = await this.checkSiteRedirectSync();
    if (redirected) {
      return; // Don't apply other settings if we're redirecting
    }
    
    // Apply theme if it exists (only if not redirecting)
    const theme = this.currentSettings.display?.theme;
    if (theme) {
      try {
        const { switchTheme } = await import('../core/theme.js');
        switchTheme(theme);
      } catch (error) {
        console.warn('Failed to apply theme:', error);
      }
    }
    
    // Apply family name to header widgets (only if not redirecting)
    const familyName = this.currentSettings.family?.familyName;
    if (familyName) {
      try {
        await this.applyFamilyNameToWidgets(familyName);
      } catch (error) {
        console.warn('Failed to apply family name:', error);
      }
    }
  }

  // Site redirect functionality with bypass parameter support
  async checkSiteRedirectSync() {
    try {
      // NEW: Check for noredirect parameter first
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('noredirect') === 'true') {
        console.log('🌐 Redirect bypassed due to ?noredirect=true parameter');
        return false;
      }

      const autoRedirect = this.currentSettings.system?.autoRedirect;
      const targetSite = this.currentSettings.system?.activeSite || 'prod';
      const currentSite = this.detectCurrentSite();
      
      if (autoRedirect && targetSite !== currentSite) {
        console.log(`🌐 Auto-redirecting from ${currentSite} to ${targetSite}`);
        this.performSiteRedirect(targetSite, false);
        return true; // Redirect happening
      }
      
      return false; // No redirect
    } catch (error) {
      console.error('Site redirect check failed:', error);
      return false;
    }
  }

  // Detect current site
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

  // Perform site redirect
  performSiteRedirect(targetSite, showConfirmation = true) {
    const urls = {
      prod: 'https://dashieapp.com',
      dev: 'https://dev.dashieapp.com'
    };
    
    const targetUrl = urls[targetSite];
    if (!targetUrl) {
      console.error('Invalid target site:', targetSite);
      return;
    }
    
    const currentSite = this.detectCurrentSite();
    if (currentSite === targetSite) {
      return;
    }
    
    if (showConfirmation) {
      this.showSiteChangeConfirmation(targetSite, targetUrl);
    } else {
      console.log(`Redirecting to ${targetUrl}`);
      window.location.href = targetUrl;
    }
  }

  // Handle site change
  handleSiteChange(newSite) {
    const currentSite = this.detectCurrentSite();
    
    if (newSite !== currentSite) {
      this.performSiteRedirect(newSite, true); // true = show confirmation
    }
  }

  // Show site change confirmation modal
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
      this.revertSiteSetting();
    });
    
    modal.querySelector('#site-change-confirm').addEventListener('click', () => {
      modal.remove();
      style.remove();
      window.location.href = targetUrl;
    });
    
    // Click backdrop to cancel
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.querySelector('#site-change-cancel').click();
      }
    });
  }

  // Revert site setting if user cancels
  revertSiteSetting() {
    const currentSite = this.detectCurrentSite();
    if (currentSite !== 'other') {
      this.setSetting('system.activeSite', currentSite);
      
      // Update UI if settings modal is open
      const activeSiteSelect = document.querySelector('#active-site-select');
      if (activeSiteSelect) {
        activeSiteSelect.value = currentSite;
      }
    }
  }

  // Apply theme immediately when setting changes
  async applyThemeImmediate(theme) {
    try {
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
    } catch (error) {
      console.warn('Failed to apply theme immediately:', error);
    }
  }

  // Apply family name immediately when setting changes
  async applyFamilyNameImmediate(familyName) {
    try {
      await this.applyFamilyNameToWidgets(familyName);
    } catch (error) {
      console.warn('Failed to apply family name immediately:', error);
    }
  }

  // Apply family name to widgets
  async applyFamilyNameToWidgets(familyName) {
    setTimeout(() => {
      const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');
      
      headerWidgets.forEach((iframe, index) => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'family-name-update',
              familyName: familyName
            }, '*');
          } catch (error) {
            console.warn(`Failed to send family name to header widget ${index + 1}:`, error);
          }
        }
      });
      
      // Also dispatch global event
      window.dispatchEvent(new CustomEvent('dashie-family-name-loaded', {
        detail: { familyName }
      }));
      
    }, 1000); // Wait 1 second for widgets to load
  }
}
