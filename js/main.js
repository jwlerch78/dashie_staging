// js/main.js - App Initialization & Orchestration with Centralized Settings

import { initializeEvents } from './core/events.js';
import { updateFocus, initializeHighlightTimeout } from './core/navigation.js';
import { renderGrid, renderSidebar } from './ui/grid.js';
import { initializeSleepTimer } from './ui/settings/settings-main.js';
import { initializeThemeSystem } from './core/theme.js';

// ---------------------
// EARLY THEME APPLICATION
// ---------------------

// Import and apply theme as early as possible to prevent flash
async function preApplyTheme() {
  try {
    const { applyThemeBeforeLoad } = await import('./core/theme.js');
    applyThemeBeforeLoad();
  } catch (error) {
    console.warn('Early theme application failed:', error);
  }
}

// ---------------------
// APP INITIALIZATION
// ---------------------

function initializeApp() {
  console.log("Initializing Dashie Dashboard...");

 
  // Initialize theme system first (before any UI rendering)
  // Note: Early theme application already happened above
  initializeThemeSystem();
  
  // Set up event listeners
  initializeEvents();
  
  // Initialize sleep timer system (this loads LOCAL settings only)
  initializeSleepTimer();
  
  // Initialize navigation highlight timeout system
  initializeHighlightTimeout();
  
  // Render initial UI
  renderSidebar();
  renderGrid();
  
  // Handle authenticated state when ready
  setTimeout(() => {
    if (window.dashieAuth && window.dashieAuth.isAuthenticated()) {
      document.getElementById('app').classList.add('authenticated');
      console.log('🔐 App marked as authenticated');
    }
  }, 1000); 
  
  console.log("Dashie Dashboard initialized successfully!");
}

// Pre-apply theme immediately when script loads
preApplyTheme();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
