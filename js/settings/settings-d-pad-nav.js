// js/settings/settings-d-pad-nav.js - FIXED: Text input editing problems
// D-pad navigation logic for settings interface

export class SimplifiedNavigation {
  constructor(overlay, callbacks) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.focusIndex = 0;
    this.focusableElements = [];
    this.collapsedGroups = new Set(['theme', 'sleep', 'photos', 'widget-config', 'family-info', 'family-members']);
    this.currentTab = 'display';
    
    this.init();
  }

  init() {
    this.updateFocusableElements();
    this.setupEventListeners();
    this.updateFocus();
  }

  updateFocusableElements() {
    // Get all focusable elements in the correct order
    const tabs = Array.from(this.overlay.querySelectorAll('.tab-button:not(.disabled)'));
    const activePanel = this.overlay.querySelector('.tab-panel.active');
    const groupTitles = Array.from(activePanel.querySelectorAll('.group-title'));
    
    // FIXED: Build proper navigation order - groups and their controls together
    const contentElements = [];
    groupTitles.forEach(title => {
      // Always add the group title
      contentElements.push(title);
      
      // Add form controls if this group is expanded
      const groupId = title.dataset.group;
      if (!this.collapsedGroups.has(groupId)) {
        const content = this.overlay.querySelector(`#${groupId}-content`);
        if (content) {
          const controls = Array.from(content.querySelectorAll('.form-control'));
          contentElements.push(...controls);
        }
      }
    });
    
    const buttons = Array.from(this.overlay.querySelectorAll('.settings-footer .btn'));
    
    // Create proper navigation hierarchy: tabs -> content (groups+controls) -> buttons
    this.focusableElements = [...tabs, ...contentElements, ...buttons];
    
    console.log(`⚙️ Updated focusable elements: ${this.focusableElements.length} (${tabs.length} tabs, ${contentElements.length} content, ${buttons.length} buttons)`);
    
    // Adjust focus index if it's out of bounds
    if (this.focusIndex >= this.focusableElements.length) {
      this.focusIndex = Math.max(0, this.focusableElements.length - 1);
    }
  }

  setupEventListeners() {
    // Tab clicks
    this.overlay.querySelectorAll('.tab-button:not(.disabled)').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchTab(tab.dataset.tab);
      });
    });

    // Group title clicks
    this.overlay.querySelectorAll('.group-title').forEach(title => {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleGroup(title.dataset.group);
      });
    });

    // Form changes
    this.overlay.querySelectorAll('.form-control').forEach(control => {
      control.addEventListener('change', (e) => {
        if (control.id === 'theme-select') {
          this.callbacks.onThemeChange(e.target.value);
        } else if (control.dataset.setting) {
          const value = control.type === 'number' ? parseInt(control.value) : control.value;
          this.callbacks.onSettingChange(control.dataset.setting, value);
        }
      });
    });

    // Button clicks
    const saveBtn = this.overlay.querySelector('#save-btn');
    const cancelBtn = this.overlay.querySelector('#cancel-btn');
    
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.callbacks.onSave();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.callbacks.onCancel();
      });
    }
  }

  handleKeyPress(event) {
    const { key } = event;
    let handled = false;

    console.log(`⚙️ Navigation handling key: ${key}, current focus: ${this.focusIndex}/${this.focusableElements.length}`);

    switch (key) {
      case 'ArrowUp':
        this.moveFocus(-1);
        handled = true;
        break;
      case 'ArrowDown':
        // FIXED: Always move down, even on tabs
        this.moveFocus(1);
        handled = true;
        break;
      case 'ArrowLeft':
        // Only handle left/right for tabs
        if (this.isOnTabs()) {
          this.moveTabFocus(-1);
          handled = true;
        }
        break;
      case 'ArrowRight':
        // Only handle left/right for tabs
        if (this.isOnTabs()) {
          this.moveTabFocus(1);
          handled = true;
        }
        break;
      case 'Enter':
        this.activateCurrentElement();
        handled = true;
        break;
      case 'Escape':
        this.callbacks.onCancel();
        handled = true;
        break;
    }

    return handled;
  }

  isOnTabs() {
    const current = this.focusableElements[this.focusIndex];
    return current && current.classList.contains('tab-button');
  }

  moveTabFocus(direction) {
    const tabs = this.focusableElements.filter(el => el.classList.contains('tab-button'));
    const currentTab = this.focusableElements[this.focusIndex];
    const currentTabIndex = tabs.indexOf(currentTab);
    
    if (currentTabIndex !== -1) {
      const newTabIndex = Math.max(0, Math.min(tabs.length - 1, currentTabIndex + direction));
      const newTab = tabs[newTabIndex];
      this.focusIndex = this.focusableElements.indexOf(newTab);
      this.updateFocus();
    }
  }

  moveFocus(direction) {
    const oldIndex = this.focusIndex;
    this.focusIndex = Math.max(0, Math.min(this.focusableElements.length - 1, this.focusIndex + direction));
    
    // Auto-scroll to keep focused element visible
    this.scrollToFocusedElement();
    
    this.updateFocus();
    
    console.log(`⚙️ Focus moved from ${oldIndex} to ${this.focusIndex} (direction: ${direction})`);
  }

  scrollToFocusedElement() {
    const current = this.focusableElements[this.focusIndex];
    if (current) {
      // Scroll the settings content container to keep the focused element visible
      const contentContainer = this.overlay.querySelector('.settings-content');
      if (contentContainer) {
        current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }

  toggleGroup(groupId) {
    const title = this.overlay.querySelector(`[data-group="${groupId}"]`);
    const content = this.overlay.querySelector(`#${groupId}-content`);
    
    if (!title || !content) return;
    
    if (this.collapsedGroups.has(groupId)) {
      // Expanding
      this.collapsedGroups.delete(groupId);
      title.classList.add('expanded');
      content.classList.remove('collapsed');
      content.classList.add('expanded');
      console.log(`⚙️ Expanded group: ${groupId}`);
    } else {
      // Collapsing
      this.collapsedGroups.add(groupId);
      title.classList.remove('expanded');
      content.classList.remove('expanded');
      content.classList.add('collapsed');
      console.log(`⚙️ Collapsed group: ${groupId}`);
    }
    
    // Update focusable elements after toggle
    this.updateFocusableElements();
    this.updateFocus();
  }

  switchTab(tabId) {
    console.log(`⚙️ Switching to tab: ${tabId}`);
    
    this.overlay.querySelectorAll('.tab-button').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    this.overlay.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });

    this.currentTab = tabId;
    
    // Update focusable elements for new tab
    this.updateFocusableElements();
    
    // Find first non-tab element to focus on
    const firstContentElement = this.focusableElements.find(el => !el.classList.contains('tab-button'));
    if (firstContentElement) {
      this.focusIndex = this.focusableElements.indexOf(firstContentElement);
    } else {
      this.focusIndex = 0;
    }
    
    this.updateFocus();
  }

  updateFocus() {
    // Clear all focus styles
    this.focusableElements.forEach(el => {
      el.classList.remove('focused', 'selected');
    });

    const current = this.focusableElements[this.focusIndex];
    if (current) {
      current.classList.add('focused');
      
      // Add 'selected' class for form controls and buttons
      if (!current.classList.contains('group-title') && !current.classList.contains('tab-button')) {
        current.classList.add('selected');
      }
      
      console.log(`⚙️ Focused on: ${this.getElementDescription(current)}`);
    }
  }

  getElementDescription(element) {
    if (element.classList.contains('tab-button')) {
      return `Tab: ${element.textContent}`;
    } else if (element.classList.contains('group-title')) {
      return `Group: ${element.dataset.group}`;
    } else if (element.classList.contains('form-control')) {
      return `Control: ${element.id || element.dataset.setting}`;
    } else if (element.classList.contains('btn')) {
      return `Button: ${element.textContent}`;
    }
    return element.tagName + (element.id ? '#' + element.id : '');
  }

  activateCurrentElement() {
    const current = this.focusableElements[this.focusIndex];
    if (!current) return;

    console.log(`⚙️ Activating: ${this.getElementDescription(current)}`);

    if (current.classList.contains('tab-button')) {
      // Switch tabs
      if (!current.classList.contains('disabled')) {
        this.switchTab(current.dataset.tab);
      }
    } else if (current.classList.contains('group-title')) {
      // Toggle group
      this.toggleGroup(current.dataset.group);
    } else if (current.classList.contains('btn')) {
      // Click button
      current.click();
    } else if (current.classList.contains('form-control')) {
      // FIXED: Properly activate form controls
      this.activateFormControl(current);
    }
  }

  // FIXED: Better text input handling
  activateFormControl(control) {
    console.log(`⚙️ Activating form control: ${control.id}, type: ${control.type}`);
    
    if (control.type === 'text') {
      // FIXED: Special handling for text inputs
      control.focus();
      
      // Position cursor at end of text
      setTimeout(() => {
        control.setSelectionRange(control.value.length, control.value.length);
      }, 10);
      
      console.log(`⚙️ Text input activated for editing`);
      
      // FIXED: Properly disable D-pad navigation for text editing
      this.temporarilyDisableNavigation(control);
      
    } else if (control.type === 'time' || control.type === 'number') {
      // For time/number inputs, focus and select content
      control.focus();
      if (control.type !== 'time') {
        // Don't select time inputs as it interferes with the picker
        control.select();
      }
      console.log(`⚙️ Focused and selected ${control.type} input`);
      
      this.temporarilyDisableNavigation(control);
      
    } else if (control.tagName.toLowerCase() === 'select') {
      // For select elements, focus first then simulate space bar or click
      control.focus();
      
      setTimeout(() => {
        try {
          // Method 1: Simulate space key (works on many browsers)
          const spaceEvent = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            keyCode: 32,
            bubbles: true,
            cancelable: true
          });
          control.dispatchEvent(spaceEvent);
          console.log(`⚙️ Sent space key to open select`);
          
          // Method 2: Also try click as fallback
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          control.dispatchEvent(clickEvent);
          console.log(`⚙️ Sent click event to select`);
          
        } catch (error) {
          console.log(`⚙️ Select activation failed:`, error);
        }
      }, 100);
      
    } else {
      // For other inputs, just focus
      control.focus();
      console.log(`⚙️ Focused input`);
      
      this.temporarilyDisableNavigation(control);
    }
  }

  // FIXED: Much better navigation disabling for text editing
  temporarilyDisableNavigation(control) {
    // Store reference to this navigation instance
    const navigation = this;
    let isNavigationDisabled = true;
    
    console.log(`⚙️ 🚫 Navigation disabled for text editing on ${control.id}`);
    
    // Override handleKeyPress while editing
    const originalHandleKeyPress = this.handleKeyPress;
    this.handleKeyPress = function(event) {
      if (isNavigationDisabled && document.activeElement === control) {
        console.log(`⚙️ 📝 Text editing key: ${event.key}`);
        
        // FIXED: Allow ALL normal text editing keys
        const textEditingKeys = [
          'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 
          'Tab', ' ', 'Enter'  // Added Enter for text inputs
        ];
        
        // Allow single characters (letters, numbers, symbols)
        const isSingleChar = event.key.length === 1;
        
        // Allow text editing keys and single characters
        if (textEditingKeys.includes(event.key) || isSingleChar) {
          console.log(`⚙️ ✅ Allowing text editing key: "${event.key}"`);
          return false; // Don't handle, let browser handle normally
        }
        
        // ONLY block D-pad navigation keys (up/down)
        if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
          console.log(`⚙️ 🚫 Blocking D-pad navigation key while editing: ${event.key}`);
          return true; // Block the key
        }
        
        // Handle Escape to exit editing
        if (event.key === 'Escape') {
          console.log(`⚙️ 🏃 Escape pressed - exiting text editing mode`);
          control.blur();
          return true; // Handle escape
        }
      }
      
      // For all other cases, use original handler
      return originalHandleKeyPress.call(this, event);
    };
    
    // Re-enable navigation when done editing
    const enableNavigation = () => {
      console.log(`⚙️ ✅ Re-enabling D-pad navigation after text edit`);
      isNavigationDisabled = false;
      navigation.handleKeyPress = originalHandleKeyPress;
      
      // Remove event listeners
      control.removeEventListener('blur', enableNavigation);
      control.removeEventListener('change', enableNavigation);
    };
    
    // Auto-enable navigation when leaving the input
    control.addEventListener('blur', enableNavigation);
    control.addEventListener('change', enableNavigation);
    
    console.log(`⚙️ 📝 Text editing mode active - use normal keys, Escape or click away to exit`);
  }

  destroy() {
    // Cleanup if needed
    console.log(`⚙️ Navigation destroyed`);
  }
}
