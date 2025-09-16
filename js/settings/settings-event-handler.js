// js/settings/settings-event-handler.js
// Event handling and global keyboard capture for settings

export function setupEventHandlers(overlay, settingsManager) {
  console.log('⚙️ Setting up event handlers');
  
  // CRITICAL: Add global keyboard event capture with high priority
  settingsManager.keydownHandler = (event) => {
    // Only handle if settings modal is visible and active
    if (!settingsManager.isVisible || !overlay.classList.contains('active')) {
      return;
    }

    console.log('⚙️ Settings captured key:', event.key);
    
    // Let the navigation handle it
    if (settingsManager.navigation && settingsManager.navigation.handleKeyPress(event)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  };

  // Add event listener with capture=true to get events before main navigation
  document.addEventListener('keydown', settingsManager.keydownHandler, true);

  // Listen for form changes to track pending changes
  overlay.querySelectorAll('.form-control[data-setting]').forEach(control => {
    control.addEventListener('change', (e) => {
      const path = e.target.dataset.setting;
      const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
      settingsManager.pendingChanges[path] = value;
      console.log(`⚙️ Setting queued: ${path} = ${value}`);
    });
  });

  // Prevent clicks from bubbling to main dashboard - but allow interaction within modal
  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
    // Don't prevent default - allow normal click behavior within modal
  });

  console.log('⚙️ ✅ Event handlers set up successfully');
}

export function removeEventHandlers(settingsManager) {
  console.log('⚙️ Removing event handlers');
  
  // Remove the global keyboard event listener
  if (settingsManager.keydownHandler) {
    document.removeEventListener('keydown', settingsManager.keydownHandler, true);
    settingsManager.keydownHandler = null;
    console.log('⚙️ ✅ Global keyboard handler removed');
  }
}
