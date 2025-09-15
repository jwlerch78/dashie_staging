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
    
    // Initialize controller - FIXED: Correct import path
    const { SettingsController } = await import('./settings-controller.js');
    settingsController = new SettingsController();
    const success = await settingsController.init();
    
    if (!success) {
      console.warn('⚙️ ⚠️ Settings controller initialization failed, continuing with defaults');
    }
    
    // Initialize navigation - FIXED: Correct import path  
    const { SettingsNavigation } = await import('./settings-navigation.js');
    settingsNavigation = new SettingsNavigation(settingsController);
    
    isInitialized = true;
    console.log('⚙️ ✅ Settings system initialized successfully');
    
    // Apply current theme on initialization
    await applyCurrentTheme();
    
    return true;
    
  } catch (error) {
    console.error('⚙️ ❌ Settings initialization failed:', error);
    return false;
  }
}

// Load settings CSS files
async function loadSettingsCSS() {
  const cssFiles = [
    'js/settings/settings-layout.css',     // FIXED: Correct path
    'js/settings/settings-panel.css'      // FIXED: Correct path
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
    console.log('⚙️ 👁️ Showing settings interface...');
    
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
      console.log('⚙️ ✅ Settings interface displayed');
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

// ENHANCED: Better error handling and fallbacks for getting settings
export function getSetting(path, defaultValue = undefined) {
  if (!settingsController || !settingsController.isReady()) {
    console.warn('⚙️ ⚠️ Settings not ready, returning default value for:', path);
    return defaultValue;
  }
  
  const value = settingsController.getSetting(path);
  return value !== undefined ? value : defaultValue;
}

// Set a setting value (public API)
export function setSetting(path, value) {
  if (!settingsController || !settingsController.isReady()) {
    console.warn('⚙️ ⚠️ Settings not ready, cannot set value:', path);
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

// ENHANCED: Apply current theme from settings with better integration
export async function applyCurrentTheme() {
  const theme = getSetting('display.theme', 'dark');
  console.log(`⚙️ 🎨 Applying theme: ${theme}`);
  
  // Try to use existing theme manager first
  try {
    const { switchTheme } = await import('../core/theme.js');
    switchTheme(theme);
    console.log('⚙️ ✅ Applied theme via theme manager');
    return;
  } catch (error) {
    console.warn('⚙️ Theme manager not available, using fallback');
  }
  
  // Fallback: Update CSS custom properties directly
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
  
  // Set data attribute for CSS targeting
  document.documentElement.setAttribute('data-theme', theme);
  console.log('⚙️ ✅ Applied theme via fallback method');
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

// INTEGRATION: Handle keyboard events from main navigation system
export function handleSettingsKeyPress(event) {
  if (!settingsNavigation || !settingsNavigation.isShown()) {
    return false;
  }
  
  // Create a proper event-like object if we just got a key string
  let eventObj = event;
  if (typeof event === 'string') {
    eventObj = { 
      key: event,
      preventDefault: () => {},
      stopPropagation: () => {},
      stopImmediatePropagation: () => {}
    };
  } else if (event && !event.preventDefault) {
    // Handle objects like { key: 'ArrowDown' }
    eventObj = {
      ...event,
      preventDefault: () => {},
      stopPropagation: () => {},
      stopImmediatePropagation: () => {}
    };
  }
  
  // Let the settings navigation handle the key
  return settingsNavigation.handleKeyPress(eventObj);
}

// LEGACY COMPATIBILITY: Functions for existing code
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

// Export for backward compatibility
export {
  showSettings as show,
  hideSettings as hide,
  getSetting as get,
  setSetting as set,
  saveSettings as save
};

// Auto-initialize when auth is ready
export function autoInitialize() {
  // Check if we have authentication ready
  const checkAuth = () => {
    if ((window.authManager && window.authManager.currentUser) || 
        (window.dashieAuth && window.dashieAuth.isAuthenticated())) {
      initializeSettings().catch(error => {
        console.warn('⚙️ ⚠️ Auto-initialization failed:', error);
      });
      return true;
    }
    return false;
  };
  
  // Try immediately
  if (!checkAuth()) {
    // Wait for auth to be ready
    document.addEventListener('dashie-auth-ready', () => {
      checkAuth();
    });
    
    // Also try again after a short delay
    setTimeout(() => {
      checkAuth();
    }, 2000);
  }
}

// Set up listeners when module loads
setupSettingsListeners();

// NEW: Called from existing settings integration
export async function initializeSupabaseSettings() {
  console.log('⚙️ 🔄 Legacy initializeSupabaseSettings called, redirecting to new system...');
  return await initializeSettings();
}

// Auto-initialize (this replaces the old manual initialization)
autoInitialize();
