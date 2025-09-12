// js/settings/settings-main.js
// Main settings integration - replaces existing settings.js

let settingsController = null;
let settingsNavigation = null;
let isInitialized = false;

// Initialize the new settings system
export async function initializeSettings() {
  if (isInitialized) return true;
  
  try {
    console.log('⚙️ 🚀 Initializing new settings system...');
    
    // Load CSS
    await loadSettingsCSS();
    
    // Initialize controller
    const { SettingsController } = await import('./settings-controller.js');
    settingsController = new SettingsController();
    const success = await settingsController.init();
    
    if (!success) {
      console.warn('⚙️ ⚠️ Settings controller initialization failed, continuing with defaults');
    }
    
    // Initialize navigation
    const { SettingsNavigation } = await import('./settings-navigation.js');
    settingsNavigation = new SettingsNavigation(settingsController);
    
    isInitialized = true;
    console.log('⚙️ ✅ Settings system initialized successfully');
    
    // Apply current theme on initialization
    applyCurrentTheme();
    
    return true;
    
  } catch (error) {
    console.error('⚙️ ❌ Settings initialization failed:', error);
    return false;
  }
}

// Load settings CSS files
async function loadSettingsCSS() {
  const cssFiles = [
    'js/settings/settings-layout.css',     // Fixed path
    'js/settings/settings-panel.css'      // Fixed path

  ];
  
  for (const cssFile of cssFiles) {
    if (!document.querySelector(`link[href="${cssFile}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssFile;
      document.head.appendChild(link);
      
      // Wait for CSS to load
      await new Promise((resolve) => {
        link.onload = resolve;
        link.onerror = resolve; // Continue even if CSS fails to load
      });
    }
  }
}

// Show settings (main entry point)
export async function showSettings() {
  try {
    // Initialize if not already done
    if (!isInitialized) {
      const success = await initializeSettings();
      if (!success) {
        console.error('⚙️ ❌ Cannot show settings - initialization failed');
        return;
      }
    }
    
    // Show the settings UI
    if (settingsNavigation) {
      await settingsNavigation.show();
    }
    
  } catch (error) {
    console.error('⚙️ ❌ Failed to show settings:', error);
  }
}

// Hide settings
export function hideSettings() {
  if (settingsNavigation) {
    settingsNavigation.hide();
  }
}

// Get a setting value (public API)
export function getSetting(path, defaultValue = undefined) {
  if (!settingsController) {
    console.warn('⚙️ ⚠️ Settings not initialized, returning default value');
    return defaultValue;
  }
  
  const value = settingsController.getSetting(path);
  return value !== undefined ? value : defaultValue;
}

// Set a setting value (public API)
export function setSetting(path, value) {
  if (!settingsController) {
    console.warn('⚙️ ⚠️ Settings not initialized, cannot set value');
    return false;
  }
  
  return settingsController.setSetting(path, value);
}

// Get all settings for a category (public API)
export function getCategorySettings(categoryId) {
  if (!settingsController) {
    console.warn('⚙️ ⚠️ Settings not initialized, returning empty object');
    return {};
  }
  
  return settingsController.getCategorySettings(categoryId);
}

// Set multiple settings for a category (public API)
export function setCategorySettings(categoryId, settings) {
  if (!settingsController) {
    console.warn('⚙️ ⚠️ Settings not initialized, cannot set category settings');
    return false;
  }
  
  return settingsController.setCategorySettings(categoryId, settings);
}

// Save settings immediately (public API)
export async function saveSettings() {
  if (!settingsController) {
    console.warn('⚙️ ⚠️ Settings not initialized, cannot save');
    return false;
  }
  
  return await settingsController.saveSettings();
}

// Check if settings are ready (public API)
export function isSettingsReady() {
  return isInitialized && settingsController && settingsController.isReady();
}

// Get all settings (read-only copy)
export function getAllSettings() {
  if (!settingsController) {
    console.warn('⚙️ ⚠️ Settings not initialized, returning empty object');
    return {};
  }
  
  return settingsController.getSettings();
}

// Apply current theme from settings
export function applyCurrentTheme() {
  const theme = getSetting('display.theme', 'dark');
  console.log(`⚙️ 🎨 Applying theme: ${theme}`);
  
  // Update CSS custom properties
  const root = document.documentElement;
  
  if (theme === 'light') {
    root.style.setProperty('--bg-primary', '#f5f5f5');
    root.style.setProperty('--bg-secondary', '#ffffff');
    root.style.setProperty('--text-primary', '#333333');
    root.style.setProperty('--text-secondary', '#666666');
    root.style.setProperty('--text-muted', '#999999');
  } else {
    // Dark theme (default)
    root.style.setProperty('--bg-primary', '#222222');
    root.style.setProperty('--bg-secondary', '#333333');
    root.style.setProperty('--text-primary', '#ffffff');
    root.style.setProperty('--text-secondary', '#cccccc');
    root.style.setProperty('--text-muted', '#999999');
  }
  
  // Update theme manager if available
  if (window.themeManager && window.themeManager.setTheme) {
    window.themeManager.setTheme(theme);
  }
  
  // Set data attribute for CSS targeting
  document.documentElement.setAttribute('data-theme', theme);
}

// Listen for settings updates and apply themes
function setupSettingsListeners() {
  window.addEventListener('settingsUpdated', (e) => {
    console.log('⚙️ 🔄 Settings updated from another device');
    applyCurrentTheme();
    
    // Notify other parts of the app
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: getSetting('display.theme') }
    }));
  });
}

// Legacy compatibility functions for existing code
export function getTheme() {
  return getSetting('display.theme', 'dark');
}

export function setTheme(theme) {
  const success = setSetting('display.theme', theme);
  if (success) {
    applyCurrentTheme();
  }
  return success;
}

export function getSleepTimes() {
  return {
    sleepTime: getSetting('display.sleepTime', '22:00'),
    wakeTime: getSetting('display.wakeTime', '07:00'),
    reSleepDelay: getSetting('display.reSleepDelay', 30)
  };
}

export function setSleepTimes(times) {
  let success = true;
  if (times.sleepTime !== undefined) {
    success = success && setSetting('display.sleepTime', times.sleepTime);
  }
  if (times.wakeTime !== undefined) {
    success = success && setSetting('display.wakeTime', times.wakeTime);
  }
  if (times.reSleepDelay !== undefined) {
    success = success && setSetting('display.reSleepDelay', times.reSleepDelay);
  }
  return success;
}

export function getPhotosSettings() {
  return {
    transitionTime: getSetting('photos.transitionTime', 5)
  };
}

export function setPhotosSettings(settings) {
  let success = true;
  if (settings.transitionTime !== undefined) {
    success = success && setSetting('photos.transitionTime', settings.transitionTime);
  }
  return success;
}

// Cleanup function
export async function cleanupSettings() {
  console.log('⚙️ 🧹 Cleaning up settings system...');
  
  if (settingsNavigation) {
    settingsNavigation.destroy();
    settingsNavigation = null;
  }
  
  if (settingsController) {
    await settingsController.cleanup();
    settingsController = null;
  }
  
  isInitialized = false;
  console.log('⚙️ ✅ Settings cleanup complete');
}

// Integration with existing navigation system
export function handleSettingsKeyPress(key) {
  if (!settingsNavigation || !settingsNavigation.isShown()) {
    return false;
  }
  
  // Let the settings navigation handle the key
  return settingsNavigation.handleKeyPress({ key });
}

// Export for backward compatibility
export {
  showSettings as show,
  hideSettings as hide,
  getSetting as get,
  setSetting as set,
  saveSettings as save
};

// Auto-initialize when imported (optional)
export function autoInitialize() {
  // Only auto-initialize if we have a user
  if (window.authManager && window.authManager.currentUser) {
    initializeSettings().catch(error => {
      console.warn('⚙️ ⚠️ Auto-initialization failed:', error);
    });
  }
}

// Set up listeners when module loads
setupSettingsListeners();

// Initialize migration helper for existing installations
export async function migrateFromOldSettings() {
  try {
    console.log('⚙️ 🔄 Checking for settings migration...');
    
    // Check if old settings exist in localStorage
    const oldTheme = localStorage.getItem('dashie-theme');
    const oldSleepSettings = localStorage.getItem('dashie-sleep-settings');
    const oldPhotosSettings = localStorage.getItem('dashie-photos-settings');
    
    if (!oldTheme && !oldSleepSettings && !oldPhotosSettings) {
      console.log('⚙️ ✅ No old settings found, skipping migration');
      return;
    }
    
    console.log('⚙️ 🔄 Migrating old settings...');
    
    // Migrate theme
    if (oldTheme) {
      setSetting('display.theme', oldTheme);
      localStorage.removeItem('dashie-theme');
      console.log('⚙️ ➡️ Migrated theme setting');
    }
    
    // Migrate sleep settings
    if (oldSleepSettings) {
      try {
        const sleepData = JSON.parse(oldSleepSettings);
        if (sleepData.sleepTime) setSetting('display.sleepTime', sleepData.sleepTime);
        if (sleepData.wakeTime) setSetting('display.wakeTime', sleepData.wakeTime);
        if (sleepData.reSleepDelay) setSetting('display.reSleepDelay', sleepData.reSleepDelay);
        localStorage.removeItem('dashie-sleep-settings');
        console.log('⚙️ ➡️ Migrated sleep settings');
      } catch (error) {
        console.warn('⚙️ ⚠️ Failed to migrate sleep settings:', error);
      }
    }
    
    // Migrate photos settings
    if (oldPhotosSettings) {
      try {
        const photosData = JSON.parse(oldPhotosSettings);
        if (photosData.transitionTime) setSetting('photos.transitionTime', photosData.transitionTime);
        localStorage.removeItem('dashie-photos-settings');
        console.log('⚙️ ➡️ Migrated photos settings');
      } catch (error) {
        console.warn('⚙️ ⚠️ Failed to migrate photos settings:', error);
      }
    }
    
    // Save migrated settings
    await saveSettings();
    console.log('⚙️ ✅ Settings migration complete');
    
  } catch (error) {
    console.error('⚙️ ❌ Settings migration failed:', error);
  }
}

// Auto-run migration on import
migrateFromOldSettings();
