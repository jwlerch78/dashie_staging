// js/settings/settings-ui-builder.js - FIXED: Family name UI with correct placeholder and description
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

export function populateFormFields(overlay, settings) {
  console.log('⚙️ Populating form fields with settings:', settings);
  
  // Theme
  const themeSelect = overlay.querySelector('#theme-select');
  if (themeSelect && settings.display?.theme) {
    themeSelect.value = settings.display.theme;
    console.log('⚙️ Set theme to:', settings.display.theme);
  }

  // Sleep settings  
  const sleepTime = overlay.querySelector('#sleep-time');
  if (sleepTime && settings.display?.sleepTime) {
    sleepTime.value = settings.display.sleepTime;
    console.log('⚙️ Set sleep time to:', settings.display.sleepTime);
  }

  const wakeTime = overlay.querySelector('#wake-time');
  if (wakeTime && settings.display?.wakeTime) {
    wakeTime.value = settings.display.wakeTime;
    console.log('⚙️ Set wake time to:', settings.display.wakeTime);
  }

  const resleepDelay = overlay.querySelector('#resleep-delay');
  if (resleepDelay && settings.display?.reSleepDelay) {
    resleepDelay.value = settings.display.reSleepDelay;
    console.log('⚙️ Set resleep delay to:', settings.display.reSleepDelay);
  }

  // Photos
  const photoTransition = overlay.querySelector('#photo-transition');
  if (photoTransition && settings.photos?.transitionTime) {
    photoTransition.value = settings.photos.transitionTime;
    console.log('⚙️ Set photo transition to:', settings.photos.transitionTime);
  }

  // FIXED: Family settings - populate the family name field
  const familyName = overlay.querySelector('#family-name');
  if (familyName) {
    // Set the value if it exists, otherwise use default
    const nameValue = settings.family?.familyName || 'Dashie';
    familyName.value = nameValue;
    console.log('⚙️ Set family name to:', nameValue);
  }

  console.log('⚙️ ✅ Form fields populated successfully');
}

export function applyTheme(overlay, theme) {
  console.log(`⚙️ 🎨 Applying theme: ${theme}`);
  
  // Apply theme to settings modal
  document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${theme}`;
  
  // Also apply to the overlay specifically
  if (overlay) {
    overlay.classList.remove('theme-dark', 'theme-light');
    overlay.classList.add(`theme-${theme}`);
  }
  
  console.log(`⚙️ ✅ Theme applied: ${theme}`);
}
