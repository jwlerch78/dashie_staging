// js/settings/panels/settings-display.js
// FIXED: Updated import path and enhanced theme integration

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
              <span class="setting-
