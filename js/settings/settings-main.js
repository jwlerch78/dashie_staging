// js/settings/settings-main.js - UPDATED with proper D-pad navigation and save/cancel

import { SettingsController } from './settings-controller.js';

let settingsController;
let currentCategory = 'display';
let currentFocus = { type: 'category', index: 0 }; // Track navigation focus
let isSettingsVisible = false;
let originalSettings = {}; // Store original settings for cancel functionality

// Category definitions
const categories = [
  { id: 'display', label: 'Display & Theme', icon: '🎨' },
  { id: 'sleep', label: 'Sleep Settings', icon: '😴' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'testing', label: 'Testing', icon: '🔧' }
];

// Initialize settings system
export async function initializeSettings() {
  try {
    console.log('⚙️ Initializing settings system...');
    
    // Initialize settings controller
    settingsController = new SettingsController();
    await settingsController.initialize();
    
    // Apply current theme on startup
    applyCurrentTheme();
    
    // Set up event listeners
    setupSettingsListeners();
    
    console.log('⚙️ ✅ Settings system initialized');
    return true;
  } catch (error) {
    console.error('⚙️ ❌ Failed to initialize settings:', error);
    return false;
  }
}

// Check if settings system is ready
export function isSettingsReady() {
  return settingsController && settingsController.isReady();
}

// Get a setting value
export function getSetting(path, defaultValue = null) {
  if (!settingsController) return defaultValue;
  return settingsController.getSetting(path, defaultValue);
}

// Set a setting value
export function setSetting(path, value) {
  if (!settingsController) return false;
  return settingsController.setSetting(path, value);
}

// Show settings modal
export async function showSettings(initialCategory = 'display') {
  if (isSettingsVisible) return;
  
  console.log('⚙️ 🎨 Opening settings modal...');
  
  // Store original settings for cancel functionality
  originalSettings = JSON.parse(JSON.stringify(settingsController.getAllSettings()));
  
  currentCategory = initialCategory;
  currentFocus = { type: 'category', index: categories.findIndex(c => c.id === initialCategory) };
  
  // Create modal HTML
  createSettingsModal();
  
  // Show the modal
  const overlay = document.querySelector('.settings-overlay');
  if (overlay) {
    isSettingsVisible = true;
    overlay.classList.add('active');
    
    // Focus the current category
    updateNavigationFocus();
    
    console.log('⚙️ ✅ Settings modal opened');
  }
}

// Hide settings modal
export function hideSettings() {
  const overlay = document.querySelector('.settings-overlay');
  if (overlay) {
    isSettingsVisible = false;
    overlay.classList.remove('active');
    
    // Clean up after animation
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
    
    console.log('⚙️ 👁️ Settings modal closed');
  }
}

// Handle keyboard navigation
export function handleSettingsKeyPress(event) {
  if (!isSettingsVisible) return false;
  
  const action = event.key || event;
  console.log(`⚙️ ⌨️ Settings key: ${action}`);
  
  switch (action) {
    case 'Escape':
    case 'escape':
      handleCancel();
      return true;
      
    case 'ArrowUp':
    case 'up':
      navigateUp();
      return true;
      
    case 'ArrowDown':
    case 'down':
      navigateDown();
      return true;
      
    case 'ArrowLeft':
    case 'left':
      navigateLeft();
      return true;
      
    case 'ArrowRight':
    case 'right':
      navigateRight();
      return true;
      
    case 'Enter':
    case 'enter':
      handleEnter();
      return true;
      
    default:
      return false;
  }
}

// Navigation functions
function navigateUp() {
  if (currentFocus.type === 'category') {
    // Navigate between categories
    currentFocus.index = Math.max(0, currentFocus.index - 1);
    switchToCategory(categories[currentFocus.index].id);
  } else if (currentFocus.type === 'panel') {
    // Navigate within panel
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      currentFocus.index = Math.max(0, currentFocus.index - 1);
      updatePanelFocus(focusableElements);
    }
  } else if (currentFocus.type === 'footer') {
    // Move from footer to panel
    switchToPanelFocus();
  }
  updateNavigationFocus();
}

function navigateDown() {
  if (currentFocus.type === 'category') {
    // Navigate between categories
    currentFocus.index = Math.min(categories.length - 1, currentFocus.index + 1);
    switchToCategory(categories[currentFocus.index].id);
  } else if (currentFocus.type === 'panel') {
    // Navigate within panel or move to footer
    const focusableElements = getFocusableElements();
    if (currentFocus.index >= focusableElements.length - 1) {
      // Move to footer
      currentFocus = { type: 'footer', index: 0 };
    } else {
      currentFocus.index = Math.min(focusableElements.length - 1, currentFocus.index + 1);
      updatePanelFocus(focusableElements);
    }
  } else if (currentFocus.type === 'footer') {
    // Navigate between footer buttons
    currentFocus.index = currentFocus.index === 0 ? 1 : 0;
  }
  updateNavigationFocus();
}

function navigateLeft() {
  if (currentFocus.type === 'panel' || currentFocus.type === 'footer') {
    // Move to category sidebar
    currentFocus = { type: 'category', index: categories.findIndex(c => c.id === currentCategory) };
    updateNavigationFocus();
  } else if (currentFocus.type === 'footer') {
    // Navigate between footer buttons
    currentFocus.index = currentFocus.index === 0 ? 1 : 0;
    updateNavigationFocus();
  }
}

function navigateRight() {
  if (currentFocus.type === 'category') {
    // Move to panel content
    switchToPanelFocus();
  } else if (currentFocus.type === 'footer') {
    // Navigate between footer buttons
    currentFocus.index = currentFocus.index === 0 ? 1 : 0;
    updateNavigationFocus();
  }
}

function handleEnter() {
  if (currentFocus.type === 'category') {
    // Switch category and move to panel
    switchToCategory(categories[currentFocus.index].id);
    switchToPanelFocus();
  } else if (currentFocus.type === 'panel') {
    // Activate current panel element
    const focusableElements = getFocusableElements();
    const element = focusableElements[currentFocus.index];
    if (element) {
      if (element.classList.contains('section-header')) {
        // Toggle section
        element.click();
      } else if (element.tagName === 'SELECT') {
        // Open dropdown
        element.focus();
        element.click();
      } else if (element.tagName === 'BUTTON') {
        // Click button
        element.click();
      } else {
        // Focus input for editing
        element.focus();
      }
    }
  } else if (currentFocus.type === 'footer') {
    // Click footer button
    const buttons = document.querySelectorAll('.settings-footer .settings-btn');
    if (buttons[currentFocus.index]) {
      buttons[currentFocus.index].click();
    }
  }
}

// Helper functions
function switchToPanelFocus() {
  const focusableElements = getFocusableElements();
  if (focusableElements.length > 0) {
    currentFocus = { type: 'panel', index: 0 };
    updatePanelFocus(focusableElements);
  }
}

function getFocusableElements() {
  const panel = document.querySelector('.settings-panel.active');
  if (!panel) return [];
  
  return Array.from(panel.querySelectorAll(
    '.section-header, .focusable, input, select, button'
  )).filter(el => {
    // Check if element is visible and not disabled
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !el.disabled && 
           getComputedStyle(el).visibility !== 'hidden';
  });
}

function updatePanelFocus(focusableElements) {
  // Clear previous focus
  focusableElements.forEach(el => {
    el.classList.remove('selected', 'focused');
  });
  
  // Set current focus
  if (focusableElements[currentFocus.index]) {
    focusableElements[currentFocus.index].classList.add('selected');
  }
}

function updateNavigationFocus() {
  // Clear all focus states
  document.querySelectorAll('.selected, .focused').forEach(el => {
    el.classList.remove('selected', 'focused');
  });
  
  if (currentFocus.type === 'category') {
    // Highlight current category
    const categoryElements = document.querySelectorAll('.category-item');
    if (categoryElements[currentFocus.index]) {
      categoryElements[currentFocus.index].classList.add('selected');
    }
  } else if (currentFocus.type === 'panel') {
    // Highlight current panel element
    const focusableElements = getFocusableElements();
    updatePanelFocus(focusableElements);
  } else if (currentFocus.type === 'footer') {
    // Highlight current footer button
    const buttons = document.querySelectorAll('.settings-footer .settings-btn');
    if (buttons[currentFocus.index]) {
      buttons[currentFocus.index].classList.add('selected');
    }
  }
}

function switchToCategory(categoryId) {
  if (categoryId === currentCategory) return;
  
  currentCategory = categoryId;
  
  // Update category selection
  document.querySelectorAll('.category-item').forEach((item, index) => {
    item.classList.toggle('selected', categories[index].id === categoryId);
  });
  
  // Show corresponding panel
  showPanel(categoryId);
}

function showPanel(categoryId) {
  // Hide all panels
  document.querySelectorAll('.settings-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  // Show target panel
  const targetPanel = document.querySelector(`[data-panel="${categoryId}"]`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  } else {
    // Create panel if it doesn't exist
    createPanel(categoryId);
  }
}

function createPanel(categoryId) {
  const main = document.querySelector('.settings-main');
  if (!main) return;
  
  const panel = document.createElement('div');
  panel.className = 'settings-panel active';
  panel.setAttribute('data-panel', categoryId);
  
  panel.innerHTML = getPanelContent(categoryId);
  main.appendChild(panel);
  
  // Add event listeners for the new panel
  addPanelEventListeners(panel);
}

function getPanelContent(categoryId) {
  const settings = settingsController.getAllSettings();
  
  switch (categoryId) {
    case 'display':
      return `
        <div class="panel-header">
          <h2>🎨 Display & Theme</h2>
          <p class="panel-description">Customize the appearance and theme of your dashboard</p>
        </div>
        <div class="panel-content">
          <div class="settings-section">
            <h3>Theme Settings</h3>
            <div class="settings-row compact">
              <div class="settings-label">Theme:</div>
              <div class="settings-control">
                <select class="theme-select focusable" data-setting="display.theme">
                  <option value="dark" ${settings.display?.theme === 'dark' ? 'selected' : ''}>Dark</option>
                  <option value="light" ${settings.display?.theme === 'light' ? 'selected' : ''}>Light</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      `;
      
    case 'sleep':
      return `
        <div class="panel-header">
          <h2>😴 Sleep Settings</h2>
          <p class="panel-description">Configure when your dashboard goes to sleep and wakes up</p>
        </div>
        <div class="panel-content">
          <div class="settings-section">
            <h3 class="section-header focusable" data-section="sleep-schedule">
              <span>▶</span> Sleep Schedule
            </h3>
            <div class="section-content" style="display: block;">
              <div class="settings-row compact">
                <div class="settings-label">Sleep Time:</div>
                <div class="settings-control">
                  <div class="time-container">
                    <input type="number" class="time-input focusable" min="1" max="12" value="${settings.sleep?.sleepTime?.hour > 12 ? settings.sleep.sleepTime.hour - 12 : settings.sleep?.sleepTime?.hour || 11}">
                    <span class="time-separator">:</span>
                    <input type="number" class="time-input focusable" min="0" max="59" value="${(settings.sleep?.sleepTime?.minute || 0).toString().padStart(2, '0')}">
                    <button class="time-period focusable">${(settings.sleep?.sleepTime?.hour || 23) >= 12 ? 'PM' : 'AM'}</button>
                  </div>
                </div>
              </div>
              <div class="settings-row compact">
                <div class="settings-label">Wake Time:</div>
                <div class="settings-control">
                  <div class="time-container">
                    <input type="number" class="time-input focusable" min="1" max="12" value="${settings.sleep?.wakeTime?.hour > 12 ? settings.sleep.wakeTime.hour - 12 : settings.sleep?.wakeTime?.hour || 7}">
                    <span class="time-separator">:</span>
                    <input type="number" class="time-input focusable" min="0" max="59" value="${(settings.sleep?.wakeTime?.minute || 0).toString().padStart(2, '0')}">
                    <button class="time-period focusable">${(settings.sleep?.wakeTime?.hour || 7) >= 12 ? 'PM' : 'AM'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
    case 'photos':
      return `
        <div class="panel-header">
          <h2>📸 Photos</h2>
          <p class="panel-description">Configure photo slideshow settings</p>
        </div>
        <div class="panel-content">
          <div class="settings-section">
            <h3>Slideshow Settings</h3>
            <div class="settings-row compact">
              <div class="settings-label">Transition Time:</div>
              <div class="settings-control">
                <input type="number" class="number-input focusable" min="5" max="60" value="${settings.photos?.transitionTime || 30}">
                <span class="unit-label">seconds</span>
              </div>
            </div>
          </div>
        </div>
      `;
      
    case 'testing':
      return `
        <div class="panel-header">
          <h2>🔧 Testing</h2>
          <p class="panel-description">Development and testing options</p>
        </div>
        <div class="panel-content">
          <div class="settings-section">
            <h3>Environment Settings</h3>
            <div class="settings-row compact">
              <div class="settings-label">Redirect URL:</div>
              <div class="settings-control">
                <select class="url-select focusable" data-setting="testing.redirectUrl">
                  <option value="https://jwlerch78.github.io/dashie/">Production</option>
                  <option value="https://jwlerch78.github.io/dashie_staging/" ${settings.testing?.redirectUrl?.includes('staging') ? 'selected' : ''}>Staging</option>
                  <option value="http://localhost:3000/">Local Development</option>
                </select>
                <button class="settings-button small focusable">Go</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
    default:
      return `<div class="panel-header"><h2>Panel not found</h2></div>`;
  }
}

function addPanelEventListeners(panel) {
  // Theme change listener
  const themeSelect = panel.querySelector('[data-setting="display.theme"]');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      setSetting('display.theme', e.target.value);
      applyTheme(e.target.value);
    });
  }
  
  // Section header toggles
  panel.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const sectionId = header.dataset.section;
      const content = panel.querySelector(`[data-section="${sectionId}"] + .section-content`);
      if (content) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        const arrow = header.querySelector('span');
        if (arrow) {
          arrow.textContent = isVisible ? '▶' : '▼';
        }
      }
    });
  });
  
  // Input change listeners
  panel.querySelectorAll('input, select').forEach(input => {
    const eventType = input.type === 'number' || input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventType, (e) => {
      const settingPath = e.target.dataset.setting;
      if (settingPath) {
        let value = e.target.value;
        if (e.target.type === 'number') {
          value = parseInt(value, 10);
        }
        setSetting(settingPath, value);
      }
    });
  });
}

function createSettingsModal() {
  // Remove existing modal if any
  const existing = document.querySelector('.settings-overlay');
  if (existing) {
    existing.remove();
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  
  overlay.innerHTML = `
    <div class="settings-container">
      <div class="settings-sidebar">
        <div class="settings-sidebar-header">
          <h1>Settings</h1>
          <button class="close-btn">×</button>
        </div>
        <div class="settings-categories">
          ${categories.map((cat, index) => `
            <div class="category-item ${cat.id === currentCategory ? 'selected' : ''}" data-category="${cat.id}">
              <span class="category-icon">${cat.icon}</span>
              <span class="category-label">${cat.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="settings-main">
        <!-- Panels will be dynamically created -->
      </div>
      <div class="settings-footer">
        <button class="settings-btn">Cancel</button>
        <button class="settings-btn primary">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add event listeners
  setupModalEventListeners(overlay);
  
  // Show initial panel
  showPanel(currentCategory);
}

function setupModalEventListeners(overlay) {
  // Close button
  overlay.querySelector('.close-btn').addEventListener('click', handleCancel);
  
  // Category clicks
  overlay.querySelectorAll('.category-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      const categoryId = item.dataset.category;
      currentFocus = { type: 'category', index };
      switchToCategory(categoryId);
      updateNavigationFocus();
    });
  });
  
  // Footer buttons
  const cancelBtn = overlay.querySelector('.settings-footer .settings-btn:not(.primary)');
  const saveBtn = overlay.querySelector('.settings-footer .settings-btn.primary');
  
  cancelBtn.addEventListener('click', handleCancel);
  saveBtn.addEventListener('click', handleSave);
  
  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      handleCancel();
    }
  });
}

function handleSave() {
  try {
    // Save settings to storage
    settingsController.saveToStorage();
    
    // Apply current theme
    applyCurrentTheme();
    
    // Dispatch settings update event
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { settings: settingsController.getAllSettings() }
    }));
    
    console.log('⚙️ ✅ Settings saved successfully');
    hideSettings();
  } catch (error) {
    console.error('⚙️ ❌ Failed to save settings:', error);
    // Could show an error message to user here
  }
}

function handleCancel() {
  // Restore original settings
  if (originalSettings && settingsController) {
    settingsController.restoreSettings(originalSettings);
    applyCurrentTheme(); // Revert theme changes
  }
  
  console.log('⚙️ ↩️ Settings cancelled, reverted to original');
  hideSettings();
}

// Apply theme
function applyTheme(theme) {
  try {
    // Try to use existing theme manager first
    import('../core/theme.js').then(({ switchTheme }) => {
      switchTheme(theme);
      console.log('⚙️ ✅ Applied theme via theme manager:', theme);
    }).catch(() => {
      // Fallback: Update body class
      document.body.className = document.body.className.replace(/theme-\w+/g, '');
      document.body.classList.add(`theme-${theme}`);
      console.log('⚙️ ✅ Applied theme via fallback method:', theme);
    });
  } catch (error) {
    console.warn('⚙️ ⚠️ Failed to apply theme:', error);
  }
}

function applyCurrentTheme() {
  const currentTheme = getSetting('display.theme', 'dark');
  applyTheme(currentTheme);
}

function setupSettingsListeners() {
  window.addEventListener('settingsUpdated', (e) => {
    console.log('⚙️ 🔄 Settings updated from another device');
    applyCurrentTheme();
  });
}
