// js/settings/panels/settings-display.js
// Complete Display Settings Panel

export class DisplaySettingsPanel {
  constructor(settingsController) {
    this.controller = settingsController;
    this.element = null;
    this.focusableElements = [];
    this.currentFocus = 0;
    
    // Setting paths for easy reference
    this.settings = {
      theme: 'display.theme',
      sleepTime: 'display.sleepTime', 
      wakeTime: 'display.wakeTime',
      reSleepDelay: 'display.reSleepDelay',
      photosTransition: 'photos.transitionTime'
    };
  }

  // Create the panel HTML
  render() {
    const container = document.createElement('div');
    container.className = 'settings-panel display-panel';
    
    // Get current values
    const theme = this.controller.getSetting(this.settings.theme) || 'dark';
    const sleepTime = this.controller.getSetting(this.settings.sleepTime) || '22:00';
    const wakeTime = this.controller.getSetting(this.settings.wakeTime) || '07:00';
    const reSleepDelay = this.controller.getSetting(this.settings.reSleepDelay) || 30;
    const photosTransition = this.controller.getSetting(this.settings.photosTransition) || 5;
    
    container.innerHTML = `
      <div class="panel-header">
        <h2>🎨 Display & Photos</h2>
        <p class="panel-description">Configure theme, sleep settings, and photo transitions</p>
      </div>
      
      <div class="panel-content">
        <!-- Theme Selection -->
        <div class="settings-section">
          <h3>Theme</h3>
          <div class="settings-row">
            <label class="settings-label">Display Theme</label>
            <div class="settings-control">
              <select class="theme-select focusable" data-setting="${this.settings.theme}">
                <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark Theme</option>
                <option value="light" ${theme === 'light' ? 'selected' : ''}>Light Theme</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Sleep Settings -->
        <div class="settings-section">
          <h3>Sleep Mode</h3>
          <div class="settings-row">
            <label class="settings-label">Sleep Time</label>
            <div class="settings-control">
              <input type="time" 
                     class="time-input focusable" 
                     data-setting="${this.settings.sleepTime}"
                     value="${sleepTime}">
              <span class="setting-description">When display goes to sleep</span>
            </div>
          </div>
          
          <div class="settings-row">
            <label class="settings-label">Wake Time</label>
            <div class="settings-control">
              <input type="time" 
                     class="time-input focusable" 
                     data-setting="${this.settings.wakeTime}"
                     value="${wakeTime}">
              <span class="setting-description">When display wakes up</span>
            </div>
          </div>
          
          <div class="settings-row">
            <label class="settings-label">Re-sleep Delay</label>
            <div class="settings-control">
              <input type="number" 
                     class="number-input focusable" 
                     data-setting="${this.settings.reSleepDelay}"
                     value="${reSleepDelay}"
                     min="1" 
                     max="120"
                     step="1">
              <span class="setting-description">Minutes before auto-sleep after wake</span>
            </div>
          </div>
        </div>

        <!-- Photos Settings -->
        <div class="settings-section">
          <h3>Photos Widget</h3>
          <div class="settings-row">
            <label class="settings-label">Transition Time</label>
            <div class="settings-control">
              <input type="number" 
                     class="number-input focusable" 
                     data-setting="${this.settings.photosTransition}"
                     value="${photosTransition}"
                     min="1" 
                     max="60"
                     step="1">
              <span class="setting-description">Seconds between photo changes</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.element = container;
    this.setupEventListeners();
    this.updateFocusableElements();
    
    return container;
  }

  // Set up event listeners for the panel
  setupEventListeners() {
    if (!this.element) return;

    // Handle input changes
    const inputs = this.element.querySelectorAll('.focusable');
    inputs.forEach(input => {
      const eventType = input.type === 'select-one' ? 'change' : 'input';
      
      input.addEventListener(eventType, (e) => {
        const settingPath = e.target.dataset.setting;
        let value = e.target.value;
        
        // Convert number inputs to actual numbers
        if (e.target.type === 'number') {
          value = parseInt(value, 10);
          if (isNaN(value)) return;
        }
        
        // Update the setting
        this.controller.setSetting(settingPath, value);
        console.log(`🎨 Updated ${settingPath} = ${value}`);
        
        // Apply theme immediately if theme changed
        if (settingPath === this.settings.theme) {
          this.applyTheme(value);
        }
      });

      // Handle focus events for D-pad navigation
      input.addEventListener('focus', () => {
        this.currentFocus = this.focusableElements.indexOf(input);
        this.updateFocusStyles();
      });
    });

    // Listen for settings updates from other devices
    window.addEventListener('settingsUpdated', (e) => {
      this.refreshFromSettings(e.detail.settings);
    });
  }

  // Update the list of focusable elements
  updateFocusableElements() {
    if (!this.element) return;
    
    this.focusableElements = Array.from(
      this.element.querySelectorAll('.focusable')
    ).filter(el => !el.disabled);
  }

  // Handle D-pad navigation within the panel
  handleNavigation(direction) {
    if (!this.element || this.focusableElements.length === 0) return false;

    let handled = false;
    
    switch (direction) {
      case 'up':
        if (this.currentFocus > 0) {
          this.currentFocus--;
          handled = true;
        }
        break;
        
      case 'down':
        if (this.currentFocus < this.focusableElements.length - 1) {
          this.currentFocus++;
          handled = true;
        }
        break;
        
      case 'left':
      case 'right':
        // Handle left/right for select elements and number inputs
        const currentElement = this.focusableElements[this.currentFocus];
        if (currentElement) {
          if (currentElement.type === 'select-one') {
            this.adjustSelectValue(currentElement, direction);
            handled = true;
          } else if (currentElement.type === 'number') {
            this.adjustNumberValue(currentElement, direction);
            handled = true;
          }
        }
        break;
        
      case 'enter':
        const element = this.focusableElements[this.currentFocus];
        if (element) {
          element.click();
          handled = true;
        }
        break;
    }
    
    if (handled) {
      this.updateFocus();
    }
    
    return handled;
  }

  // Adjust select value with left/right
  adjustSelectValue(selectElement, direction) {
    const options = Array.from(selectElement.options);
    const currentIndex = selectElement.selectedIndex;
    
    let newIndex;
    if (direction === 'right' && currentIndex < options.length - 1) {
      newIndex = currentIndex + 1;
    } else if (direction === 'left' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else {
      return; // No change
    }
    
    selectElement.selectedIndex = newIndex;
    selectElement.dispatchEvent(new Event('change'));
  }

  // Adjust number value with left/right
  adjustNumberValue(numberElement, direction) {
    const current = parseInt(numberElement.value, 10);
    const min = parseInt(numberElement.min, 10) || 1;
    const max = parseInt(numberElement.max, 10) || 999;
    const step = parseInt(numberElement.step, 10) || 1;
    
    let newValue;
    if (direction === 'right' && current < max) {
      newValue = Math.min(current + step, max);
    } else if (direction === 'left' && current > min) {
      newValue = Math.max(current - step, min);
    } else {
      return; // No change
    }
    
    numberElement.value = newValue;
    numberElement.dispatchEvent(new Event('input'));
  }

  // Update focus to current element
  updateFocus() {
    if (this.focusableElements[this.currentFocus]) {
      this.focusableElements[this.currentFocus].focus();
    }
  }

  // Update focus styles
  updateFocusStyles() {
    // Remove selected class from all elements
    this.focusableElements.forEach(el => el.classList.remove('selected'));
    
    // Add selected class to current element
    if (this.focusableElements[this.currentFocus]) {
      this.focusableElements[this.currentFocus].classList.add('selected');
    }
  }

  // Apply theme change immediately
  async applyTheme(theme) {
    console.log(`🎨 Applying theme: ${theme}`);
    
    try {
      // Try to use the main theme system first
      const { switchTheme } = await import('../../core/theme.js');
      switchTheme(theme);
      console.log('🎨 ✅ Applied theme via theme manager');
      return;
    } catch (error) {
      console.warn('🎨 Theme manager not available, using fallback');
    }
    
    // Fallback: Update CSS custom properties directly
    const root = document.documentElement;
    
    if (theme === 'light') {
      root.style.setProperty('--bg-primary', '#FCFCFF');
      root.style.setProperty('--bg-secondary', '#FCFCFF');
      root.style.setProperty('--text-primary', '#424242');
      root.style.setProperty('--text-secondary', '#616161');
      root.style.setProperty('--text-muted', '#9e9e9e');
      root.style.setProperty('--grid-gap-color', '#9eb4fe');
    } else {
      // Dark theme (default)
      root.style.setProperty('--bg-primary', '#222');
      root.style.setProperty('--bg-secondary', '#333');
      root.style.setProperty('--text-primary', '#fff');
      root.style.setProperty('--text-secondary', '#ccc');
      root.style.setProperty('--text-muted', '#999');
      root.style.setProperty('--grid-gap-color', '#333');
    }
    
    // Set data attribute for CSS targeting
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Refresh panel from updated settings
  refreshFromSettings(newSettings) {
    if (!this.element) return;
    
    // Update all input values
    Object.keys(this.settings).forEach(key => {
      const settingPath = this.settings[key];
      const value = this.getNestedValue(newSettings, settingPath);
      const input = this.element.querySelector(`[data-setting="${settingPath}"]`);
      
      if (input && value !== undefined) {
        input.value = value;
        
        // Apply theme if it changed
        if (settingPath === this.settings.theme) {
          this.applyTheme(value);
        }
      }
    });
  }

  // Get nested value from object using dot notation
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj
    );
  }

  // Show the panel
  show() {
    if (this.element) {
      this.element.style.display = 'block';
      this.updateFocusableElements();
      
      // Focus first element
      this.currentFocus = 0;
      this.updateFocus();
    }
  }

  // Hide the panel
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  // Cleanup
  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.focusableElements = [];
  }

  // Get current focus index for external navigation
  getCurrentFocus() {
    return this.currentFocus;
  }

  // Set focus to specific index
  setFocus(index) {
    if (index >= 0 && index < this.focusableElements.length) {
      this.currentFocus = index;
      this.updateFocus();
    }
  }

  // Check if panel can handle navigation in a direction
  canNavigate(direction) {
    switch (direction) {
      case 'up':
        return this.currentFocus > 0;
      case 'down':
        return this.currentFocus < this.focusableElements.length - 1;
      case 'left':
      case 'right':
        const currentElement = this.focusableElements[this.currentFocus];
        return currentElement && (currentElement.type === 'select-one' || currentElement.type === 'number');
      default:
        return false;
    }
  }
}
