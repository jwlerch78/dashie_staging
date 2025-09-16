// js/settings/simplified-settings.js
// Complete fixed simplified settings system with better auth timing

export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.pendingChanges = {};
    this.keydownHandler = null;
    this.initializationAttempts = 0;
    this.maxInitAttempts = 20; // Increased attempts
    
    // Start initialization process with delay
    setTimeout(() => this.initializeController(), 500); // Give auth time to settle
  }

  async initializeController() {
    try {
      this.initializationAttempts++;
      console.log(`⚙️ Settings initialization attempt ${this.initializationAttempts}/${this.maxInitAttempts}`);
      
      // IMPROVED: Better auth detection
      const authStatus = this.checkAuthStatus();
      console.log('⚙️ Auth status check:', authStatus);
      
      if (!authStatus.ready) {
        if (this.initializationAttempts < this.maxInitAttempts) {
          console.log('⚙️ Auth not ready, retrying in 500ms...');
          setTimeout(() => this.initializeController(), 500); // Increased delay
          return;
        } else {
          console.warn('⚙️ Max initialization attempts reached, proceeding without full auth');
          // Proceed anyway - will use local storage only
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
      
      // Create a fallback controller that only uses localStorage
      this.controller = this.createFallbackController();
      console.log('⚙️ Using fallback localStorage-only controller');
    }
  }

  // IMPROVED: Better auth status checking
  checkAuthStatus() {
    // Check if dashieAuth exists and is functional
    const hasDashieAuth = window.dashieAuth && typeof window.dashieAuth.isAuthenticated === 'function';
    const isAuthenticated = hasDashieAuth ? window.dashieAuth.isAuthenticated() : false;
    const hasUser = hasDashieAuth ? !!window.dashieAuth.getUser() : false;
    
    // Check if authManager exists as fallback
    const hasAuthManager = window.authManager && window.authManager.currentUser;
    
    // Check for saved user in localStorage as final fallback
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

  // Fallback controller for when database initialization fails
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
        
        // Apply theme immediately if it's a theme setting
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
        familyName: '',
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

  // Main entry point - called from existing code
  async show() {
    if (this.isVisible) return;
    
    // Ensure controller is initialized before showing
    if (!this.controller) {
      console.log('⚙️ Controller not ready, attempting initialization...');
      await this.initializeController();
      
      // If still no controller, show error
      if (!this.controller) {
        alert('Settings system not ready. Please try again in a moment.');
        return;
      }
    }
    
    this.createSettingsUI();
    await this.loadCurrentSettings();
    this.setupEventHandlers();
    this.showOverlay();
    
    console.log('⚙️ 👁️ Simplified settings shown');
  }

  hide() {
    if (!this.isVisible) return;
    
    this.hideOverlay();
    this.cleanup();
    
    console.log('⚙️ 👁️ Simplified settings hidden');
  }

  createSettingsUI() {
    // Create the overlay with the simplified HTML structure
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.innerHTML = this.getSettingsHTML();
    
    document.body.appendChild(this.overlay);
  }

  getSettingsHTML() {
    return `
      <div class="settings-modal">
        <!-- Header with Tabs -->
        <div class="settings-header">
          <h1 class="settings-title">Settings</h1>
          <div class="settings-tabs">
            <button class="tab-button active" data-tab="display">Display</button>
            <button class="tab-button disabled" data-tab="family">Family</button>
            <button class="tab-button" data-tab="widgets">Widgets</button>
            <button class="tab-button disabled" data-tab="system">System</button>
            <button class="tab-button disabled" data-tab="about">About</button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="settings-content">
          <!-- Display Tab -->
          <div class="tab-panel active" id="display-panel">
            <div class="settings-group">
              <h3 class="group-title" data-group="theme">
                <span>Theme</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="theme-content">
                <div class="setting-row">
                  <div class="setting-label">Display Theme</div>
                  <div class="setting-control">
                    <select class="form-control" id="theme-select" data-setting="display.theme">
                      <option value="dark">Dark Theme</option>
                      <option value="light">Light Theme</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-group">
              <h3 class="group-title" data-group="sleep">
                <span>Sleep Mode</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="sleep-content">
                <div class="setting-row">
                  <div class="setting-label">
                    Sleep Time
                    <div class="setting-description">When display goes to sleep</div>
                  </div>
                  <div class="setting-control">
                    <input type="time" class="form-control" id="sleep-time" data-setting="display.sleepTime">
                  </div>
                </div>
                
                <div class="setting-row">
                  <div class="setting-label">
                    Wake Time
                    <div class="setting-description">When display wakes up</div>
                  </div>
                  <div class="setting-control">
                    <input type="time" class="form-control" id="wake-time" data-setting="display.wakeTime">
                  </div>
                </div>
                
                <div class="setting-row">
                  <div class="setting-label">
                    Re-sleep Delay
                    <div class="setting-description">Minutes before auto-sleep after wake</div>
                  </div>
                  <div class="setting-control">
                    <input type="number" class="form-control" id="resleep-delay" data-setting="display.reSleepDelay" min="1" max="120">
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-group">
              <h3 class="group-title" data-group="photos">
                <span>Photos Widget</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="photos-content">
                <div class="setting-row">
                  <div class="setting-label">
                    Transition Time
                    <div class="setting-description">Seconds between photo changes</div>
                  </div>
                  <div class="setting-control">
                    <input type="number" class="form-control" id="photo-transition" data-setting="photos.transitionTime" min="1" max="60">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Widgets Tab -->
          <div class="tab-panel" id="widgets-panel">
            <div class="settings-group">
              <h3 class="group-title" data-group="widget-config">
                <span>Widget Configuration</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="widget-config-content">
                <div class="setting-row">
                  <div class="setting-label">
                    Photo Source
                    <div class="setting-description">Choose photo album or folder</div>
                  </div>
                  <div class="setting-control">
                    <select class="form-control" data-setting="photos.source">
                      <option value="recent">Recent Photos</option>
                      <option value="family">Family Album</option>
                      <option value="vacation">Vacation 2024</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Other tabs with coming soon messages -->
          <div class="tab-panel" id="family-panel">
            <div class="coming-soon">
              <h3>Family Settings</h3>
              <p>Coming soon! This will include family member profiles and settings.</p>
            </div>
          </div>

          <div class="tab-panel" id="system-panel">
            <div class="coming-soon">
              <h3>System Settings</h3>
              <p>Developer and system configuration options coming soon.</p>
            </div>
          </div>

          <div class="tab-panel" id="about-panel">
            <div class="coming-soon">
              <h3>About Dashie</h3>
              <p>Version information and support options coming soon.</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="settings-footer">
          <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="save-btn">Save</button>
        </div>
      </div>
    `;
  }

  async loadCurrentSettings() {
    if (!this.controller) return;
    
    try {
      // Load all current settings
      const currentSettings = this.controller.getSettings();
      console.log('⚙️ Loading current settings:', currentSettings);
      
      // Populate form fields with current values
      this.populateFormFields(currentSettings);
      
      // Apply current theme
      this.applyTheme(currentSettings.display?.theme || 'dark');
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to load current settings:', error);
    }
  }

  populateFormFields(settings) {
    // Theme
    const themeSelect = this.overlay.querySelector('#theme-select');
    if (themeSelect && settings.display?.theme) {
      themeSelect.value = settings.display.theme;
    }

    // Sleep settings  
    const sleepTime = this.overlay.querySelector('#sleep-time');
    if (sleepTime && settings.display?.sleepTime) {
      sleepTime.value = settings.display.sleepTime;
    }

    const wakeTime = this.overlay.querySelector('#wake-time');
    if (wakeTime && settings.display?.wakeTime) {
      wakeTime.value = settings.display.wakeTime;
    }

    const resleepDelay = this.overlay.querySelector('#resleep-delay');
    if (resleepDelay && settings.display?.reSleepDelay) {
      resleepDelay.value = settings.display.reSleepDelay;
    }

    // Photos
    const photoTransition = this.overlay.querySelector('#photo-transition');
    if (photoTransition && settings.photos?.transitionTime) {
      photoTransition.value = settings.photos.transitionTime;
    }

    console.log('⚙️ Form fields populated with current settings');
  }

  setupEventHandlers() {
    // Initialize navigation
    this.navigation = new SimplifiedNavigation(this.overlay, {
      onThemeChange: (theme) => this.handleThemeChange(theme),
      onSettingChange: (path, value) => this.handleSettingChange(path, value),
      onSave: () => this.handleSave(),
      onCancel: () => this.handleCancel()
    });

    // CRITICAL: Add global keyboard event capture with high priority
    this.keydownHandler = (event) => {
      // Only handle if settings modal is visible and active
      if (!this.isVisible || !this.overlay.classList.contains('active')) {
        return;
      }

      console.log('⚙️ Settings captured key:', event.key);
      
      // Let the navigation handle it
      if (this.navigation.handleKeyPress(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    // Add event listener with capture=true to get events before main navigation
    document.addEventListener('keydown', this.keydownHandler, true);

    // Listen for form changes to track pending changes
    this.overlay.querySelectorAll('.form-control[data-setting]').forEach(control => {
      control.addEventListener('change', (e) => {
        const path = e.target.dataset.setting;
        const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
        this.pendingChanges[path] = value;
        console.log(`⚙️ Setting queued: ${path} = ${value}`);
      });
    });

    // Prevent clicks from bubbling to main dashboard - but allow interaction within modal
    this.overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      // Don't prevent default - allow normal click behavior within modal
    });
  }

  handleThemeChange(theme) {
    // Apply theme immediately for preview
    this.applyTheme(theme);
    
    // Track the change
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
      
      // Try to initialize one more time
      await this.initializeController();
      
      if (!this.controller) {
        alert('Settings system not available. Changes cannot be saved.');
        return;
      }
    }

    try {
      console.log('⚙️ 💾 Saving settings:', this.pendingChanges);
      
      // Apply all pending changes to the controller
      for (const [path, value] of Object.entries(this.pendingChanges)) {
        const success = this.controller.setSetting(path, value);
        if (!success) {
          console.warn(`⚙️ ⚠️ Failed to set ${path} = ${value}`);
        }
      }
      
      // Save to database/local storage
      const success = await this.controller.saveSettings();
      
      if (!success) {
        throw new Error('Save operation returned false');
      }
      
      // Apply theme to main dashboard if changed
      if (this.pendingChanges['display.theme']) {
        await this.applyThemeToMainDashboard(this.pendingChanges['display.theme']);
      }
      
      // Notify other parts of the app
      this.notifySettingsChanged();
      
      console.log('⚙️ ✅ Settings saved successfully');
      this.hide();
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  }

  handleCancel() {
    // Revert theme preview if it was changed
    if (this.pendingChanges['display.theme']) {
      const originalTheme = this.controller.getSetting('display.theme', 'dark');
      this.applyTheme(originalTheme);
    }
    
    console.log('⚙️ Settings cancelled');
    this.hide();
  }

  applyTheme(theme) {
    // Apply theme to settings modal
    document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${theme}`;
    
    // Also apply to the overlay specifically
    this.overlay.classList.remove('theme-dark', 'theme-light');
    this.overlay.classList.add(`theme-${theme}`);
  }

  async applyThemeToMainDashboard(theme) {
    try {
      // Use existing theme system
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
      console.log(`⚙️ 🎨 Applied theme to main dashboard: ${theme}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Could not apply theme to main dashboard:', error);
    }
  }

  notifySettingsChanged() {
    // Dispatch event for other parts of the app to listen to
    window.dispatchEvent(new CustomEvent('dashie-settings-changed', {
      detail: this.pendingChanges
    }));
    
    // Also update any photo widgets
    this.updatePhotoWidgets();
  }

  updatePhotoWidgets() {
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
    
    // Remove the global keyboard event listener
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    this.pendingChanges = {};
  }
}

// Simplified Navigation Class with Fixed D-pad Navigation
class SimplifiedNavigation {
  constructor(overlay, callbacks) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.focusIndex = 0;
    this.focusableElements = [];
    this.collapsedGroups = new Set(['theme', 'sleep', 'photos', 'widget-config']);
    this.currentTab = 'display';
    this.navigationZone = 'content'; // 'tabs' or 'content'
    
    this.init();
  }

  init() {
    this.updateFocusableElements();
    this.setupEventListeners();
    this.updateFocus();
  }

  updateFocusableElements() {
    // Get all focusable elements including tabs
    const tabs = Array.from(this.overlay.querySelectorAll('.tab-button:not(.disabled)'));
    const activePanel = this.overlay.querySelector('.tab-panel.active');
    const groupTitles = Array.from(activePanel.querySelectorAll('.group-title'));
    
    // Get expanded form controls
    const expandedControls = [];
    groupTitles.forEach(title => {
      const groupId = title.dataset.group;
      if (!this.collapsedGroups.has(groupId)) {
        const content = this.overlay.querySelector(`#${groupId}-content`);
        if (content) {
          expandedControls.push(...content.querySelectorAll('.form-control'));
        }
      }
    });
    
    const buttons = Array.from(this.overlay.querySelectorAll('.settings-footer .btn'));
    
    // Create complete navigation hierarchy: tabs -> groups -> controls -> buttons
    this.focusableElements = [...tabs, ...groupTitles, ...expandedControls, ...buttons];
    
    console.log(`⚙️ Updated focusable elements: ${this.focusableElements.length} (${tabs.length} tabs, ${groupTitles.length} titles, ${expandedControls.length} controls, ${buttons.length} buttons)`);
    
    // Adjust focus index if it's out of bounds
    if (this.focusIndex >= this.focusableElements.length) {
      this.focusIndex = Math.max(0, this.focusableElements.length - 1);
    }
  }

  setupEventListeners() {
    // Tab clicks
    this.overlay.querySelectorAll('.tab-button:not(.disabled)').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchTab(tab.dataset.tab);
      });
    });

    // Group title clicks
    this.overlay.querySelectorAll('.group-title').forEach(title => {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleGroup(title.dataset.group);
      });
    });

    // Form changes
    this.overlay.querySelectorAll('.form-control').forEach(control => {
      control.addEventListener('change', (e) => {
        if (control.id === 'theme-select') {
          this.callbacks.onThemeChange(e.target.value);
        } else if (control.dataset.setting) {
          const value = control.type === 'number' ? parseInt(control.value) : control.value;
          this.callbacks.onSettingChange(control.dataset.setting, value);
        }
      });
    });

    // Button clicks
    const saveBtn = this.overlay.querySelector('#save-btn');
    const cancelBtn = this.overlay.querySelector('#cancel-btn');
    
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.callbacks.onSave();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.callbacks.onCancel();
      });
    }
  }

  handleKeyPress(event) {
    const { key } = event;
    let handled = false;

    console.log(`⚙️ Navigation handling key: ${key}, current focus: ${this.focusIndex}/${this.focusableElements.length}`);

    switch (key) {
      case 'ArrowUp':
        this.moveFocus(-1);
        handled = true;
        break;
      case 'ArrowDown':
        this.moveFocus(1);
        handled = true;
        break;
      case 'ArrowLeft':
        // Only handle left/right for tabs
        if (this.isOnTabs()) {
          this.moveTabFocus(-1);
          handled = true;
        }
        break;
      case 'ArrowRight':
        // Only handle left/right for tabs
        if (this.isOnTabs()) {
          this.moveTabFocus(1);
          handled = true;
        }
        break;
      case 'Enter':
        this.activateCurrentElement();
        handled = true;
        break;
      case 'Escape':
        this.callbacks.onCancel();
        handled = true;
        break;
    }

    return handled;
  }

  isOnTabs() {
    const current = this.focusableElements[this.focusIndex];
    return current && current.classList.contains('tab-button');
  }

  moveTabFocus(direction) {
    const tabs = this.focusableElements.filter(el => el.classList.contains('tab-button'));
    const currentTab = this.focusableElements[this.focusIndex];
    const currentTabIndex = tabs.indexOf(currentTab);
    
    if (currentTabIndex !== -1) {
      const newTabIndex = Math.max(0, Math.min(tabs.length - 1, currentTabIndex + direction));
      const newTab = tabs[newTabIndex];
      this.focusIndex = this.focusableElements.indexOf(newTab);
      this.updateFocus();
    }
  }

  moveFocus(direction) {
    const oldIndex = this.focusIndex;
    this.focusIndex = Math.max(0, Math.min(this.focusableElements.length - 1, this.focusIndex + direction));
    
    // Auto-scroll to keep focused element visible
    this.scrollToFocusedElement();
    
    this.updateFocus();
    
    console.log(`⚙️ Focus moved from ${oldIndex} to ${this.focusIndex} (direction: ${direction})`);
  }

  scrollToFocusedElement() {
    const current = this.focusableElements[this.focusIndex];
    if (current) {
      // Scroll the settings content container to keep the focused element visible
      const contentContainer = this.overlay.querySelector('.settings-content');
      if (contentContainer) {
        current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }

  toggleGroup(groupId) {
    const title = this.overlay.querySelector(`[data-group="${groupId}"]`);
    const content = this.overlay.querySelector(`#${groupId}-content`);
    
    if (!title || !content) return;
    
    if (this.collapsedGroups.has(groupId)) {
      // Expanding
      this.collapsedGroups.delete(groupId);
      title.classList.add('expanded');
      content.classList.remove('collapsed');
      content.classList.add('expanded');
      console.log(`⚙️ Expanded group: ${groupId}`);
    } else {
      // Collapsing
      this.collapsedGroups.add(groupId);
      title.classList.remove('expanded');
      content.classList.remove('expanded');
      content.classList.add('collapsed');
      console.log(`⚙️ Collapsed group: ${groupId}`);
    }
    
    // Update focusable elements after toggle
    this.updateFocusableElements();
    this.updateFocus();
  }

  switchTab(tabId) {
    console.log(`⚙️ Switching to tab: ${tabId}`);
    
    this.overlay.querySelectorAll('.tab-button').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    this.overlay.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });

    this.currentTab = tabId;
    
    // Update focusable elements for new tab
    this.updateFocusableElements();
    
    // Find first non-tab element to focus on
    const firstContentElement = this.focusableElements.find(el => !el.classList.contains('tab-button'));
    if (firstContentElement) {
      this.focusIndex = this.focusableElements.indexOf(firstContentElement);
    } else {
      this.focusIndex = 0;
    }
    
    this.updateFocus();
  }

  updateFocus() {
    // Clear all focus styles
    this.focusableElements.forEach(el => {
      el.classList.remove('focused', 'selected');
    });

    const current = this.focusableElements[this.focusIndex];
    if (current) {
      current.classList.add('focused');
      
      // Add 'selected' class for form controls and buttons
      if (!current.classList.contains('group-title') && !current.classList.contains('tab-button')) {
        current.classList.add('selected');
      }
      
      console.log(`⚙️ Focused on: ${this.getElementDescription(current)}`);
    }
  }

  getElementDescription(element) {
    if (element.classList.contains('tab-button')) {
      return `Tab: ${element.textContent}`;
    } else if (element.classList.contains('group-title')) {
      return `Group: ${element.dataset.group}`;
    } else if (element.classList.contains('form-control')) {
      return `Control: ${element.id || element.dataset.setting}`;
    } else if (element.classList.contains('btn')) {
      return `Button: ${element.textContent}`;
    }
    return element.tagName + (element.id ? '#' + element.id : '');
  }

  activateCurrentElement() {
    const current = this.focusableElements[this.focusIndex];
    if (!current) return;

    console.log(`⚙️ Activating: ${this.getElementDescription(current)}`);

    if (current.classList.contains('tab-button')) {
      // Switch tabs
      if (!current.classList.contains('disabled')) {
        this.switchTab(current.dataset.tab);
      }
    } else if (current.classList.contains('group-title')) {
      // Toggle group
      this.toggleGroup(current.dataset.group);
    } else if (current.classList.contains('btn')) {
      // Click button
      current.click();
    } else if (current.classList.contains('form-control')) {
      // FIXED: Properly activate form controls
      this.activateFormControl(current);
    }
  }

  activateFormControl(control) {
    console.log(`⚙️ Activating form control: ${control.id}, type: ${control.type}`);
    
    if (control.type === 'time' || control.type === 'number') {
      // For time and number inputs, focus and select the content
      control.focus();
      control.select();
      console.log(`⚙️ Focused and selected ${control.type} input`);
    } else if (control.tagName.toLowerCase() === 'select') {
      // For select elements, focus and simulate opening
      control.focus();
      
      // Try to open the select dropdown
      try {
        // Create a synthetic click event to open dropdown
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        control.dispatchEvent(clickEvent);
        console.log(`⚙️ Focused and opened select dropdown`);
      } catch (error) {
        console.log(`⚙️ Focused select (dropdown opening not supported)`);
      }
    } else {
      // For other inputs, just focus
      control.focus();
      console.log(`⚙️ Focused input`);
    }
  }

  // Focus on first tab (for navigation from content back to tabs)
  focusOnFirstTab() {
    const firstTab = this.focusableElements.find(el => el.classList.contains('tab-button'));
    if (firstTab) {
      this.focusIndex = this.focusableElements.indexOf(firstTab);
      this.updateFocus();
      console.log(`⚙️ Focused on first tab`);
    }
  }

  destroy() {
    // Cleanup if needed
    console.log(`⚙️ Navigation destroyed`);
  }
}

// Export for integration
export { SimplifiedSettings as default };
