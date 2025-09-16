// js/settings/settings-main.js - UPDATED to use modular system
// Main entry point for settings system

import SimplifiedSettings from './settings-simple-manager.js';

// Global settings instance
let settingsInstance = null;

// Initialize the settings system
export async function initializeSettings() {
  if (!settingsInstance) {
    settingsInstance = new SimplifiedSettings();
    console.log('⚙️ ✅ Modular settings system initialized');
  }
  return true;
}

// Show settings (main entry point - called from navigation.js)
export async function showSettings() {
  if (!settingsInstance) {
    await initializeSettings();
  }
  
  await settingsInstance.show();
}

// Hide settings
export function hideSettings() {
  if (settingsInstance) {
    settingsInstance.hide();
  }
}

// Check if settings are ready
export function isSettingsReady() {
  return !!settingsInstance;
}

// Handle keyboard events from main navigation (for compatibility)
export function handleSettingsKeyPress(event) {
  // The modular system handles its own keyboard events
  // This is just for compatibility with existing navigation code
  return false;
}

// LEGACY COMPATIBILITY: Keep existing API for backward compatibility
export function getSetting(path, defaultValue = undefined) {
  if (!settingsInstance?.controller) {
    return defaultValue;
  }
  return settingsInstance.controller.getSetting(path) ?? defaultValue;
}

export function setSetting(path, value) {
  if (!settingsInstance?.controller) {
    return false;
  }
  return settingsInstance.controller.setSetting(path, value);
}

export async function saveSettings() {
  if (!settingsInstance?.controller) {
    return false;
  }
  return await settingsInstance.controller.saveSettings();
}

export function getAllSettings() {
  if (!settingsInstance?.controller) {
    return {};
  }
  return settingsInstance.controller.getSettings();
}

// Theme helpers for backward compatibility
export function getTheme() {
  return getSetting('display.theme', 'dark');
}

export function setTheme(theme) {
  return setSetting('display.theme', theme);
}

export function getSleepTimes() {
  return {
    sleepTime: getSetting('display.sleepTime', '22:00'),
    wakeTime: getSetting('display.wakeTime', '07:00'),
    reSleepDelay: getSetting('display.reSleepDelay', 30)
  };
}

export function getPhotosSettings() {
  return {
    transitionTime: getSetting('photos.transitionTime', 5)
  };
}

// Auto-initialize when auth is ready
export function autoInitialize() {
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
  
  if (!checkAuth()) {
    document.addEventListener('dashie-auth-ready', () => {
      checkAuth();
    });
    
    setTimeout(() => {
      checkAuth();
    }, 2000);
  }
}

// Auto-initialize
autoInitialize();

// Export aliases for compatibility
export {
  showSettings as show,
  hideSettings as hide,
  getSetting as get,
  setSetting as set,
  saveSettings as save
};
