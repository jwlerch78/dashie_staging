// js/settings/settings-ui-builder.js - FIXED: Updated System tab with Auto Redirect structure
// HTML generation and form population for settings interface

export function buildSettingsUI() {
  return `
    <div class="settings-modal">
      <!-- Header with Tabs -->
      <div class="settings-header">
        <h1 class="settings-title">Settings</h1>
        <div class="settings-tabs">
          <button class="tab-button active" data-tab="display">Display</button>
          <button class="tab-button" data-tab="family">Family</button>
          <button class="tab-button" data-tab="widgets">Widgets</button>
          <button class="tab-button" data-tab="system">System</button>
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

        <!-- Family Tab -->
        <div class="tab-panel" id="family-panel">
          <div class="settings-group">
            <h3 class="group-title" data-group="family-info">
              <span>Family Information</span>
              <span class="expand-arrow">▶</span>
            </h3>
            <div class="group-content collapsed" id="family-info-content">
              <div class="setting-row">
                <div class="setting-label">
                  Family Name
                  <div class="setting-description">Just your family name (e.g. "Smith")</div>
                </div>
                <div class="setting-control">
                  <input type="text" class="form-control" id="family-name" data-setting="family.familyName" placeholder="Dashie">
                </div>
              </div>
            </div>
          </div>
          
          <div class="settings-group">
            <h3 class="group-title" data-group="family-members">
              <span>Family Members</span>
              <span class="expand-arrow">▶</span>
            </h3>
            <div class="group-content collapsed" id="family-members-content">
              <div class="coming-soon">
                <p>Family member management coming soon!</p>
                <p>This will include adding/editing family member profiles.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- System Tab -->
        <div class="tab-panel" id="system-panel">
          <div class="settings-group">
            <h3 class="group-title" data-group="auto-redirect">
              <span>Auto Redirect</span>
              <span class="expand-arrow">▶</span>
            </h3>
            <div class="group-content collapsed" id="auto-redirect-content">
              <div class="setting-row">
                <div class="setting-label">
                  Auto Redirect
                  <div class="setting-description">Auto redirect can be overridden by adding "/?noredirect=true" to the url.</div>
                </div>
                <div class="setting-control">
                  <select class="form-control" id="auto-redirect-select" data-setting="system.autoRedirect">
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">
                  Redirect Site
                  <div class="setting-description">Which site to redirect to when auto redirect is enabled</div>
                </div>
                <div class="setting-control">
                  <select class="form-control" id="active-site-select" data-setting="system.activeSite">
                    <option value="prod">Production (dashieapp.com)</option>
                    <option value="dev">Development (dev.dashieapp.com)</option>
                  </select>
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">
                  Current Site
                  <div class="setting-description">The site you are currently on</div>
                </div>
                <div class="setting-control">
                  <span class="current-site-indicator" id="current-site-indicator">Detecting...</span>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-title" data-group="developer">
              <span>Developer Options</span>
              <span class="expand-arrow">▶</span>
            </h3>
            <div class="group-content collapsed" id="developer-content">
              <div class="setting-row">
                <div class="setting-label">
                  Debug Mode
                  <div class="setting-description">Enable additional console logging</div>
                </div>
                <div class="setting-control">
                  <select class="form-control" id="debug-mode-select" data-setting="system.debugMode">
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </div>
              </div>
            </div>
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

export function populateFormFields(overlay, settings) {
  console.log('⚙️ Populating form fields with settings:', settings);
  
  // Theme
  const themeSelect = overlay.querySelector('#theme-select');
  if (themeSelect && settings.display?.theme) {
    themeSelect.value = settings.display.theme;
  }

  // Sleep settings  
  const sleepTime = overlay.querySelector('#sleep-time');
  if (sleepTime && settings.display?.sleepTime) {
    sleepTime.value = settings.display.sleepTime;
  }

  const wakeTime = overlay.querySelector('#wake-time');
  if (wakeTime && settings.display?.wakeTime) {
    wakeTime.value = settings.display.wakeTime;
  }

  const resleepDelay = overlay.querySelector('#resleep-delay');
  if (resleepDelay && settings.display?.reSleepDelay) {
    resleepDelay.value = settings.display.reSleepDelay;
  }

  // Photos
  const photoTransition = overlay.querySelector('#photo-transition');
  if (photoTransition && settings.photos?.transitionTime) {
    photoTransition.value = settings.photos.transitionTime;
  }

  // Family settings
  const familyName = overlay.querySelector('#family-name');
  if (familyName) {
    const nameValue = settings.family?.familyName || 'Dashie';
    familyName.value = nameValue;
  }

  // System settings
  const activeSiteSelect = overlay.querySelector('#active-site-select');
  if (activeSiteSelect && settings.system?.activeSite) {
    activeSiteSelect.value = settings.system.activeSite;
  }

  const autoRedirectSelect = overlay.querySelector('#auto-redirect-select');
  if (autoRedirectSelect && settings.system?.autoRedirect !== undefined) {
    autoRedirectSelect.value = settings.system.autoRedirect.toString();
  }

  const debugModeSelect = overlay.querySelector('#debug-mode-select');
  if (debugModeSelect && settings.system?.debugMode !== undefined) {
    debugModeSelect.value = settings.system.debugMode.toString();
  }

  // Update current site indicator
  updateCurrentSiteIndicator(overlay);
}

// Function to update current site indicator
function updateCurrentSiteIndicator(overlay) {
  const currentSiteIndicator = overlay.querySelector('#current-site-indicator');
  
  if (currentSiteIndicator) {
    const currentSite = detectCurrentSite();
    
    if (currentSite === 'prod') {
      currentSiteIndicator.textContent = 'Production (dashieapp.com)';
      currentSiteIndicator.style.color = '#51cf66'; // Green
    } else if (currentSite === 'dev') {
      currentSiteIndicator.textContent = 'Development (dev.dashieapp.com)';
      currentSiteIndicator.style.color = '#ffd43b'; // Yellow
    } else {
      currentSiteIndicator.textContent = `Other (${window.location.hostname})`;
      currentSiteIndicator.style.color = '#9e9e9e'; // Gray
    }
  }
}

// Function to detect current site
function detectCurrentSite() {
  const hostname = window.location.hostname;
  
  if (hostname === 'dashieapp.com' || hostname === 'www.dashieapp.com') {
    return 'prod';
  } else if (hostname === 'dev.dashieapp.com') {
    return 'dev';
  } else {
    return 'other';
  }
}

export function applyTheme(overlay, theme) {
  // Apply theme to settings modal
  document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${theme}`;
  
  // Also apply to the overlay specifically
  if (overlay) {
    overlay.classList.remove('theme-dark', 'theme-light');
    overlay.classList.add(`theme-${theme}`);
  }
}

// Export helper functions
export { updateCurrentSiteIndicator, detectCurrentSite };
