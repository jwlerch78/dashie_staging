// js/ui/settings.js - Complete Settings Modal & Sleep Timer Management with Supabase Integration

import { state, setConfirmDialog } from '../core/state.js';
import { getCurrentTheme, getAvailableThemes, switchTheme } from '../core/theme.js';
import { SimpleSupabaseStorage } from '../supabase/simple-supabase-storage.js';

// ---------------------
// SETTINGS STATE
// ---------------------

export const defaultSettings = {
  sleepTime: { hour: 21, minute: 30 }, // 9:30 PM
  wakeTime: { hour: 6, minute: 30 },   // 6:30 AM
  resleepDelay: 15, // minutes
  photoTransitionTime: 15, // seconds
  redirectUrl: 'https://jwlerch78.github.io/dashie/', // default URL
  theme: 'dark' // default theme
};

export let settings = { ...defaultSettings };

let settingsModal = null;
let settingsFocus = { type: 'close', index: 0 };
let sleepTimer = null;
let resleepTimer = null;
let checkInterval = null;
let expandedSections = new Set(); // Track which sections are expanded - start all collapsed

// Supabase storage instance
let supabaseStorage = null;
let realTimeUnsubscribe = null;

// ---------------------
// SUPABASE INTEGRATION
// ---------------------

export function initializeSupabaseSettings() {
  const user = window.dashieAuth?.getUser();
  if (user && user.id) {
    console.log('📊 Initializing Supabase settings for user:', user.name);
    
    // Fixed: Pass email and use correct class
    supabaseStorage = new SimpleSupabaseStorage(user.id, user.email);
    
    // Removed: ensureUserDocument() - not needed with our simplified approach
    
    loadSettings();
    setupRealTimeSync();
  } else {
    console.log('📱 No authenticated user, using local storage only');
    loadSettingsLocal();
  }
}

function setupRealTimeSync() {
  if (supabaseStorage && !realTimeUnsubscribe) {
    // Fixed: Use correct method name
    realTimeUnsubscribe = supabaseStorage.subscribeToChanges((newSettings) => {
      console.log('🔄 Settings updated from another device');
      Object.assign(settings, newSettings);
      
      if (newSettings.theme && newSettings.theme !== getCurrentTheme()) {
        switchTheme(newSettings.theme);
      }
      
      if (settingsModal) {
        updateSettingsModalValues();
      }
      
      updatePhotoWidget();
    });
  }
}
// ---------------------
// SETTINGS PERSISTENCE
// ---------------------

async function loadSettings() {
  try {
    if (supabaseStorage) {
      const savedSettings = await supabaseStorage.loadSettings();
      if (savedSettings) {
        Object.assign(settings, savedSettings);
        if (savedSettings.theme && savedSettings.theme !== getCurrentTheme()) {
          switchTheme(savedSettings.theme);
        }
        console.log('📖 Settings loaded successfully');
        return;
      }
    }
  } catch (error) {
    console.warn('Supabase settings load failed, using local fallback:', error);
  }
  
  loadSettingsLocal();
}

function loadSettingsLocal() {
  try {
    const saved = localStorage.getItem('dashie-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(settings, parsed);
      settings.theme = getCurrentTheme();
    }
  } catch (e) {
    console.warn('Failed to load local settings:', e);
    Object.assign(settings, defaultSettings);
  }
}

async function saveSettings() {
  try {
    settings.theme = getCurrentTheme();
    
    if (supabaseStorage) {
      await supabaseStorage.saveSettings(settings);
      console.log('💾 Settings saved to cloud');
    } else {
      localStorage.setItem('dashie-settings', JSON.stringify(settings));
      console.log('💾 Settings saved locally');
    }
  } catch (e) {
    console.warn('Failed to save settings:', e);
    try {
      localStorage.setItem('dashie-settings', JSON.stringify(settings));
    } catch (localError) {
      console.error('Critical: All storage methods failed!', localError);
    }
  }
}

// ---------------------
// TIME UTILITIES
// ---------------------

function formatTime(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function parseTimeString(timeStr) {
  const [time, period] = timeStr.split(' ');
  const [hourStr, minuteStr] = time.split(':');
  let hour = parseInt(hourStr);
  const minute = parseInt(minuteStr);
  
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  
  return { hour, minute };
}

function getCurrentTime() {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}

function timeToMinutes(hour, minute) {
  return hour * 60 + minute;
}

function isTimeInSleepPeriod() {
  const current = getCurrentTime();
  const currentMinutes = timeToMinutes(current.hour, current.minute);
  const sleepMinutes = timeToMinutes(settings.sleepTime.hour, settings.sleepTime.minute);
  const wakeMinutes = timeToMinutes(settings.wakeTime.hour, settings.wakeTime.minute);
  
  // Handle overnight sleep period (e.g., 9:30 PM to 6:30 AM)
  if (sleepMinutes > wakeMinutes) {
    return currentMinutes >= sleepMinutes || currentMinutes < wakeMinutes;
  } else {
    return currentMinutes >= sleepMinutes && currentMinutes < wakeMinutes;
  }
}

// ---------------------
// SLEEP TIMER LOGIC
// ---------------------

export function initializeSleepTimer() {
  loadSettings();
  
  // Check every minute if we should auto-sleep/wake
  checkInterval = setInterval(() => {
    if (isTimeInSleepPeriod() && !state.isAsleep) {
      console.log('Auto-sleep activated');
      import('./modals.js').then(({ enterSleepMode }) => enterSleepMode());
    } else if (!isTimeInSleepPeriod() && state.isAsleep) {
      console.log('Auto-wake activated');
      import('./modals.js').then(({ wakeUp }) => wakeUp());
    }
  }, 60000); // Check every minute
}

export function startResleepTimer() {
  if (resleepTimer) {
    clearTimeout(resleepTimer);
  }
  
  console.log(`Will re-sleep in ${settings.resleepDelay} minutes`);
  resleepTimer = setTimeout(() => {
    if (isTimeInSleepPeriod() && !state.isAsleep) {
      console.log('Re-sleep timer activated');
      import('./modals.js').then(({ enterSleepMode }) => enterSleepMode());
    }
  }, settings.resleepDelay * 60000);
}

export function cancelResleepTimer() {
  if (resleepTimer) {
    clearTimeout(resleepTimer);
    resleepTimer = null;
  }
}

// ---------------------
// SECTION MANAGEMENT
// ---------------------

function toggleSection(sectionId) {
  if (expandedSections.has(sectionId)) {
    expandedSections.delete(sectionId);
  } else {
    expandedSections.add(sectionId);
  }
  updateSectionVisibility();
}

function updateSectionVisibility() {
  const sections = ['appearance', 'sleep', 'testing', 'photos'];
  
  sections.forEach(sectionId => {
    const content = settingsModal.querySelector(`#${sectionId}-content`);
    const arrow = settingsModal.querySelector(`#${sectionId}-arrow`);
    
    if (expandedSections.has(sectionId)) {
      content.style.display = 'block';
      arrow.textContent = '▼';
    } else {
      content.style.display = 'none';
      arrow.textContent = '▶';
    }
  });
}

// ---------------------
// SETTINGS MODAL
// ---------------------

export function showSettings() {
  if (settingsModal) return; // Already showing
  
  // Get available themes
  const availableThemes = getAvailableThemes();
  const currentTheme = getCurrentTheme();
  
  // Create theme options HTML
  const themeOptionsHtml = availableThemes.map(theme => 
    `<option value="${theme.id}" ${theme.id === currentTheme ? 'selected' : ''}>${theme.name}</option>`
  ).join('');
  
  // Create settings modal
  const modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.innerHTML = `
    <div class="settings-container">
      <div class="settings-header">
        <h2 class="settings-title">Settings</h2>
        <button class="settings-close" id="settings-close">Close</button>
      </div>
      <div class="settings-content">
        
        <!-- Appearance Section -->
        <div class="settings-section">
          <h3 class="section-header" data-section="appearance">
            <span id="appearance-arrow">▶</span> Appearance
          </h3>
          <div id="appearance-content" class="section-content" style="display: none;">
            <div class="settings-row compact">
              <div class="settings-label">Theme:</div>
              <div class="settings-control">
                <select class="theme-select" id="theme-select">
                  ${themeOptionsHtml}
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Sleep Section -->
        <div class="settings-section">
          <h3 class="section-header" data-section="sleep">
            <span id="sleep-arrow">▶</span> Sleep
          </h3>
          <div id="sleep-content" class="section-content" style="display: none;">
            <div class="settings-row compact">
              <div class="settings-label">Sleep Time:</div>
              <div class="settings-control">
                <input type="number" class="time-input" id="sleep-hour" min="1" max="12" value="${settings.sleepTime.hour > 12 ? settings.sleepTime.hour - 12 : settings.sleepTime.hour === 0 ? 12 : settings.sleepTime.hour}">
                <span class="time-separator">:</span>
                <input type="number" class="time-input" id="sleep-minute" min="0" max="59" value="${settings.sleepTime.minute.toString().padStart(2, '0')}">
                <button class="time-period" id="sleep-period">${settings.sleepTime.hour >= 12 ? 'PM' : 'AM'}</button>
              </div>
            </div>
            
            <div class="settings-row compact">
              <div class="settings-label">Wake Time:</div>
              <div class="settings-control">
                <input type="number" class="time-input" id="wake-hour" min="1" max="12" value="${settings.wakeTime.hour > 12 ? settings.wakeTime.hour - 12 : settings.wakeTime.hour === 0 ? 12 : settings.wakeTime.hour}">
                <span class="time-separator">:</span>
                <input type="number" class="time-input" id="wake-minute" min="0" max="59" value="${settings.wakeTime.minute.toString().padStart(2, '0')}">
                <button class="time-period" id="wake-period">${settings.wakeTime.hour >= 12 ? 'PM' : 'AM'}</button>
              </div>
            </div>
            
            <div class="settings-row compact">
              <div class="settings-label">Re-sleep Delay:</div>
              <div class="settings-control">
                <input type="number" class="number-input" id="resleep-delay" min="1" max="60" value="${settings.resleepDelay}">
                <span class="unit-label">minutes</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Testing Section -->
        <div class="settings-section">
          <h3 class="section-header" data-section="testing">
            <span id="testing-arrow">▶</span> Testing
          </h3>
          <div id="testing-content" class="section-content" style="display: none;">
            <div class="settings-row compact">
              <div class="settings-label">Redirect URL:</div>
              <div class="settings-control">
                <select class="url-select" id="redirect-url">
                  <option value="https://jwlerch78.github.io/dashie/" ${settings.redirectUrl === 'https://jwlerch78.github.io/dashie/' ? 'selected' : ''}>Production (jwlerch78.github.io/dashie/)</option>
                  <option value="https://jwlerch78.github.io/dashie_staging/" ${settings.redirectUrl === 'https://jwlerch78.github.io/dashie_staging/' ? 'selected' : ''}>Staging (jwlerch78.github.io/dashie_staging/)</option>
                  <option value="http://localhost:3000/" ${settings.redirectUrl === 'http://localhost:3000/' ? 'selected' : ''}>Local Development (localhost:3000)</option>
                </select>
                <button class="settings-button small" id="redirect-button">Go</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Photos Section -->
        <div class="settings-section">
          <h3 class="section-header" data-section="photos">
            <span id="photos-arrow">▶</span> Photos
          </h3>
          <div id="photos-content" class="section-content" style="display: none;">
            <div class="settings-row compact">
              <div class="settings-label">Transition Time:</div>
              <div class="settings-control">
                <input type="number" class="number-input" id="photo-transition" min="5" max="60" value="${settings.photoTransitionTime}">
                <span class="unit-label">seconds</span>
              </div>
            </div>
          </div>
        </div>

      </div>
      <div class="settings-footer">
        <button class="settings-button" id="settings-cancel">Cancel</button>
        <button class="settings-button primary" id="settings-save">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  settingsModal = modal;
  
  // Set initial focus
  settingsFocus = { type: 'close', index: 0 };
  updateSettingsFocus();
  
  // Update section visibility
  updateSectionVisibility();
  
  // Add event listeners
  addSettingsEventListeners();
  
  // Click backdrop to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSettings();
    }
  });
}

function addSettingsEventListeners() {
  const modal = settingsModal;
  
  // Close button
  modal.querySelector('#settings-close').addEventListener('click', closeSettings);
  modal.querySelector('#settings-cancel').addEventListener('click', closeSettings);
  
  // Save button
  modal.querySelector('#settings-save').addEventListener('click', saveSettingsAndClose);
  
  // AM/PM toggles
  modal.querySelector('#sleep-period').addEventListener('click', () => togglePeriod('sleep-period'));
  modal.querySelector('#wake-period').addEventListener('click', () => togglePeriod('wake-period'));
  
  // Theme selection - immediate preview
  modal.querySelector('#theme-select').addEventListener('change', (e) => {
    const newTheme = e.target.value;
    console.log(`🎨 Theme selection changed to: ${newTheme}`);
    // Apply theme immediately for preview
    switchTheme(newTheme);
  });
  
  // Section headers for collapsing
  modal.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const sectionId = e.target.closest('.section-header').dataset.section;
      toggleSection(sectionId);
    });
  });
  
  // Redirect button
  modal.querySelector('#redirect-button').addEventListener('click', () => {
    const selectedUrl = modal.querySelector('#redirect-url').value;
    if (selectedUrl && selectedUrl !== window.location.href) {
      settings.redirectUrl = selectedUrl;
      saveSettings();
      window.location.href = selectedUrl;
    }
  });
  
  // Input validation
  const inputs = modal.querySelectorAll('.time-input, .number-input');
  inputs.forEach(input => {
    input.addEventListener('blur', validateInput);
    input.addEventListener('input', validateInput);
  });
}

function togglePeriod(periodId) {
  const button = settingsModal.querySelector(`#${periodId}`);
  button.textContent = button.textContent === 'AM' ? 'PM' : 'AM';
}

function validateInput(e) {
  const input = e.target;
  const value = parseInt(input.value);
  const min = parseInt(input.min);
  const max = parseInt(input.max);
  
  if (isNaN(value) || value < min || value > max) {
    input.classList.add('input-error');
  } else {
    input.classList.remove('input-error');
  }
}

function saveSettingsAndClose() {
  const modal = settingsModal;
  
  // Validate all inputs
  const inputs = modal.querySelectorAll('.time-input, .number-input');
  let isValid = true;
  
  inputs.forEach(input => {
    const value = parseInt(input.value);
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    if (isNaN(value) || value < min || value > max) {
      isValid = false;
      input.style.borderColor = '#ff6b6b';
    }
  });
  
  if (!isValid) {
    alert('Please fix the invalid values before saving.');
    return;
  }
  
  // Save sleep time
  let sleepHour = parseInt(modal.querySelector('#sleep-hour').value);
  const sleepPeriod = modal.querySelector('#sleep-period').textContent;
  if (sleepPeriod === 'PM' && sleepHour !== 12) sleepHour += 12;
  if (sleepPeriod === 'AM' && sleepHour === 12) sleepHour = 0;
  
  settings.sleepTime = {
    hour: sleepHour,
    minute: parseInt(modal.querySelector('#sleep-minute').value)
  };
  
  // Save wake time
  let wakeHour = parseInt(modal.querySelector('#wake-hour').value);
  const wakePeriod = modal.querySelector('#wake-period').textContent;
  if (wakePeriod === 'PM' && wakeHour !== 12) wakeHour += 12;
  if (wakePeriod === 'AM' && wakeHour === 12) wakeHour = 0;
  
  settings.wakeTime = {
    hour: wakeHour,
    minute: parseInt(modal.querySelector('#wake-minute').value)
  };
  
  // Save resleep delay
  settings.resleepDelay = parseInt(modal.querySelector('#resleep-delay').value);
  
  // Save redirect URL
  settings.redirectUrl = modal.querySelector('#redirect-url').value;
  
  // Save photo transition time
  settings.photoTransitionTime = parseInt(modal.querySelector('#photo-transition').value);
  
  // Theme is already saved when changed (immediate preview)
  settings.theme = getCurrentTheme();
  
  // Update photo widget if it exists
  updatePhotoWidget();
  
  saveSettings(); // Now uses Supabase!
  closeSettings();
}

function updatePhotoWidget() {
  // Send message to photo widget to update transition time
  const photoWidgets = document.querySelectorAll('iframe[src*="photos.html"]');
  photoWidgets.forEach(iframe => {
    if (iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          type: 'update-settings',
          photoTransitionTime: settings.photoTransitionTime
        }, '*');
        console.log('📸 Updated photo widget transition time:', settings.photoTransitionTime);
      } catch (error) {
        console.warn('Failed to update photo widget:', error);
      }
    }
  });
}

export function closeSettings() {
  if (settingsModal) {
    settingsModal.remove();
    settingsModal = null;
    settingsFocus = { type: 'close', index: 0 };
  }
}

// ---------------------
// SETTINGS NAVIGATION
// ---------------------

export function updateSettingsFocus() {
  if (!settingsModal) return;
  
  // Clear all highlights
  settingsModal.querySelectorAll('.settings-close, .time-input, .number-input, .time-period, .settings-button, .section-header, .url-select, .album-select, .theme-select')
    .forEach(el => el.classList.remove('selected'));
  
  // Get only visible/focusable elements
  const focusable = Array.from(settingsModal.querySelectorAll('.settings-close, .section-header, .time-input, .number-input, .time-period, .url-select, .album-select, .theme-select, .settings-button'))
    .filter(el => {
      // Always include close button, section headers, and footer buttons
      if (el.classList.contains('settings-close') || 
          el.classList.contains('section-header') || 
          el.closest('.settings-footer')) {
        return true;
      }
      
      // For other elements, check if their parent section is expanded
      const sectionContent = el.closest('.section-content');
      if (sectionContent) {
        return sectionContent.style.display !== 'none';
      }
      
      return true;
    });
  
  if (focusable[settingsFocus.index]) {
    focusable[settingsFocus.index].classList.add('selected');
  }
}

export function moveSettingsFocus(direction) {
  if (!settingsModal) return;
  
  // Get only visible/focusable elements
  const focusable = Array.from(settingsModal.querySelectorAll('.settings-close, .section-header, .time-input, .number-input, .time-period, .url-select, .album-select, .theme-select, .settings-button'))
    .filter(el => {
      // Always include close button, section headers, and footer buttons
      if (el.classList.contains('settings-close') || 
          el.classList.contains('section-header') || 
          el.closest('.settings-footer')) {
        return true;
      }
      
      // For other elements, check if their parent section is expanded
      const sectionContent = el.closest('.section-content');
      if (sectionContent) {
        return sectionContent.style.display !== 'none';
      }
      
      return true;
    });
  
  if (direction === 'up' && settingsFocus.index > 0) {
    settingsFocus.index--;
  } else if (direction === 'down' && settingsFocus.index < focusable.length - 1) {
    settingsFocus.index++;
  } else if (direction === 'left' && settingsFocus.index > 0) {
    settingsFocus.index--;
  } else if (direction === 'right' && settingsFocus.index < focusable.length - 1) {
    settingsFocus.index++;
  }
  
  updateSettingsFocus();
}

export function handleSettingsEnter() {
  if (!settingsModal) return;
  
  // Get only visible/focusable elements
  const focusable = Array.from(settingsModal.querySelectorAll('.settings-close, .section-header, .time-input, .number-input, .time-period, .url-select, .album-select, .theme-select, .settings-button'))
    .filter(el => {
      // Always include close button, section headers, and footer buttons
      if (el.classList.contains('settings-close') || 
          el.classList.contains('section-header') || 
          el.closest('.settings-footer')) {
        return true;
      }
      
      // For other elements, check if their parent section is expanded
      const sectionContent = el.closest('.section-content');
      if (sectionContent) {
        return sectionContent.style.display !== 'none';
      }
      
      return true;
    });
  
  const focused = focusable[settingsFocus.index];
  if (!focused) return;
  
  if (focused.classList.contains('section-header')) {
    // Toggle section
    const sectionId = focused.dataset.section;
    toggleSection(sectionId);
  } else if (focused.classList.contains('time-period')) {
    // Toggle AM/PM
    togglePeriod(focused.id);
  } else if (focused.tagName === 'BUTTON') {
    // Click button
    focused.click();
  } else if (focused.tagName === 'SELECT') {
    // For selects, we could implement dropdown navigation
    // For now, just focus it
    focused.focus();
  } else if (focused.tagName === 'INPUT') {
    // Focus input for editing
    focused.focus();
    focused.select();
  }
}

// Check if settings modal is open
export function isSettingsOpen() {
  return settingsModal !== null;
}

// ---------------------
// NEW FIREBASE FUNCTIONS
// ---------------------

export function initializeSettings() {
  if (window.dashieAuth && window.dashieAuth.isAuthenticated()) {
    initializeSupabaseSettings();
  } else {
    document.addEventListener('dashie-auth-ready', () => {
      initializeSupabaseSettings();
    });
    loadSettingsLocal();
  }
}

export function getSettings() {
  return { ...settings };
}

export function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
}

function updateSettingsModalValues() {
  if (!settingsModal) return;
  
  const themeSelect = settingsModal.querySelector('#theme-select');
  if (themeSelect) themeSelect.value = settings.theme;
  
  // Update sleep time
  const sleepHour = settingsModal.querySelector('#sleep-hour');
  const sleepMinute = settingsModal.querySelector('#sleep-minute');
  if (sleepHour && sleepMinute) {
    const displayHour = settings.sleepTime.hour > 12 ? settings.sleepTime.hour - 12 : 
                      settings.sleepTime.hour === 0 ? 12 : settings.sleepTime.hour;
    sleepHour.value = displayHour;
    sleepMinute.value = settings.sleepTime.minute;
  }
  
  // Update wake time
  const wakeHour = settingsModal.querySelector('#wake-hour');
  const wakeMinute = settingsModal.querySelector('#wake-minute');
  if (wakeHour && wakeMinute) {
    const displayHour = settings.wakeTime.hour > 12 ? settings.wakeTime.hour - 12 : 
                      settings.wakeTime.hour === 0 ? 12 : settings.wakeTime.hour;
    wakeHour.value = displayHour;
    wakeMinute.value = settings.wakeTime.minute;
  }
  
  // Update other fields
  const resleepDelay = settingsModal.querySelector('#resleep-delay');
  if (resleepDelay) resleepDelay.value = settings.resleepDelay;
  
  const redirectUrl = settingsModal.querySelector('#redirect-url');
  if (redirectUrl) redirectUrl.value = settings.redirectUrl;
  
  const photoTransition = settingsModal.querySelector('#photo-transition');
  if (photoTransition) photoTransition.value = settings.photoTransitionTime;
}

export function cleanupSettings() {
  if (realTimeUnsubscribe) {
    realTimeUnsubscribe();
    realTimeUnsubscribe = null;
  }
  
  if (supabaseStorage) {
    supabaseStorage.unsubscribeAll();
    supabaseStorage = null;
  }
}
