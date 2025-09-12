// js/ui/settings/settings-navigation.js
// Navigation controller for two-panel settings interface

export class SettingsNavigation {
  constructor(settingsController) {
    this.controller = settingsController;
    this.element = null;
    this.currentPanel = 'categories'; // 'categories' or 'settings'
    this.currentCategoryIndex = 0;
    this.panels = new Map(); // Store panel instances
    this.isVisible = false;
    
    // Categories configuration
    this.categories = [
      { 
        id: 'accounts', 
        label: '🔐 Accounts', 
        icon: '🔐',
        enabled: true,
        description: 'Manage your account and connected services'
      },
      { 
        id: 'family', 
        label: '👨‍👩‍👧‍👦 Family', 
        icon: '👨‍👩‍👧‍👦',
        enabled: false,
        description: 'Family member profiles and settings'
      },
      { 
        id: 'widgets', 
        label: '🖼️ Widgets', 
        icon: '🖼️',
        enabled: true,
        description: 'Configure dashboard widgets'
      },
      { 
        id: 'display', 
        label: '🎨 Display', 
        icon: '🎨',
        enabled: true,
        description: 'Theme, sleep settings, and photos'
      },
      { 
        id: 'system', 
        label: '🔧 System', 
        icon: '🔧',
        enabled: false,
        description: 'System and developer settings'
      },
      { 
        id: 'about', 
        label: 'ℹ️ About', 
        icon: 'ℹ️',
        enabled: false,
        description: 'Version info and support'
      }
    ];
    
    // Set default category to first enabled one
    this.currentCategoryIndex = this.categories.findIndex(cat => cat.enabled);
    if (this.currentCategoryIndex === -1) this.currentCategoryIndex = 0;
    
    // Bind methods
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleCategoryClick = this.handleCategoryClick.bind(this);
    this.handleCloseClick = this.handleCloseClick.bind(this);
  }

  // Create the settings UI
  async render() {
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    
    overlay.innerHTML = `
      <div class="settings-container">
        <!-- Left Panel - Categories -->
        <div class="settings-sidebar">
          <div class="settings-sidebar-header">
            <h1>⚙️ Settings</h1>
            <button class="close-btn" title="Close Settings">×</button>
          </div>
          <div class="settings-categories">
            ${this.renderCategories()}
          </div>
        </div>
        
        <!-- Right Panel - Settings Content -->
        <div class="settings-main">
          <div class="settings-panel-container">
            <div class="settings-welcome">
              <div class="settings-welcome-icon">⚙️</div>
              <h2>Welcome to Settings</h2>
              <p>Select a category from the left to configure your dashboard settings. Changes are saved automatically.</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.element = overlay;
    this.setupEventListeners();
    await this.loadPanels();
    
    return overlay;
  }

  // Render categories list
  renderCategories() {
    return this.categories.map((category, index) => {
      const isSelected = index === this.currentCategoryIndex && this.currentPanel === 'categories';
      const isActive = this.getCurrentCategory()?.id === category.id;
      
      return `
        <div class="category-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''} ${!category.enabled ? 'disabled' : ''}" 
             data-category="${category.id}" 
             data-index="${index}">
          <span class="category-icon">${category.icon}</span>
          <div class="category-content">
            <div class="category-label">${category.label.replace(category.icon + ' ', '')}</div>
            <div class="category-description">${category.description}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Set up event listeners
  setupEventListeners() {
    if (!this.element) return;

    // Category clicks
    const categoryItems = this.element.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
      item.addEventListener('click', this.handleCategoryClick);
    });

    // Close button
    const closeBtn = this.element.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', this.handleCloseClick);
    }

    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyPress);

    // Click outside to close
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.hide();
      }
    });
  }

  // Load panel instances
  async loadPanels() {
    try {
      // Load display panel (the only one we have for now)
      const { DisplaySettingsPanel } = await import('./panels/settings-display.js');
      const displayPanel = new DisplaySettingsPanel(this.controller);
      const displayElement = displayPanel.render();
      
      // Add to container
      const container = this.element.querySelector('.settings-panel-container');
      container.appendChild(displayElement);
      
      // Store panel instance
      this.panels.set('display', displayPanel);
      this.panels.set('widgets', displayPanel); // Use display panel for widgets too since it has photos
      
      console.log('⚙️ 🎨 Display panel loaded');
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to load settings panels:', error);
    }
  }

  // Handle keyboard navigation
  handleKeyPress(event) {
    if (!this.isVisible) return;

    const { key } = event;
    let handled = false;

    // Always handle Escape to close
    if (key === 'Escape') {
      this.hide();
      return;
    }

    if (this.currentPanel === 'categories') {
      handled = this.handleCategoryNavigation(key);
    } else if (this.currentPanel === 'settings') {
      handled = this.handleSettingsNavigation(key);
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Handle navigation within categories panel
  handleCategoryNavigation(key) {
    const enabledCategories = this.categories.filter(cat => cat.enabled);
    const currentEnabledIndex = enabledCategories.findIndex(cat => 
      cat === this.categories[this.currentCategoryIndex]
    );
    
    switch (key) {
      case 'ArrowUp':
        if (currentEnabledIndex > 0) {
          const prevCategory = enabledCategories[currentEnabledIndex - 1];
          this.currentCategoryIndex = this.categories.indexOf(prevCategory);
          this.updateCategoryFocus();
        }
        return true;
        
      case 'ArrowDown':
        if (currentEnabledIndex < enabledCategories.length - 1) {
          const nextCategory = enabledCategories[currentEnabledIndex + 1];
          this.currentCategoryIndex = this.categories.indexOf(nextCategory);
          this.updateCategoryFocus();
        }
        return true;
        
      case 'ArrowRight':
      case 'Enter':
        const selectedCategory = this.categories[this.currentCategoryIndex];
        if (selectedCategory && selectedCategory.enabled) {
          this.selectCategory(selectedCategory.id);
        }
        return true;
        
      default:
        return false;
    }
  }

  // Handle navigation within settings panel
  handleSettingsNavigation(key) {
    const currentCategory = this.getCurrentCategory();
    const panel = this.panels.get(currentCategory?.id);
    
    if (panel && panel.handleNavigation) {
      const handled = panel.handleNavigation(key);
      if (handled) return true;
    }
    
    // Handle panel-level navigation
    switch (key) {
      case 'ArrowLeft':
        // Go back to categories
        this.currentPanel = 'categories';
        this.updatePanelFocus();
        return true;
        
      default:
        return false;
    }
  }

  // Handle category click
  handleCategoryClick(event) {
    const categoryId = event.currentTarget.dataset.category;
    const categoryIndex = parseInt(event.currentTarget.dataset.index);
    const category = this.categories[categoryIndex];
    
    if (category && category.enabled) {
      this.currentCategoryIndex = categoryIndex;
      this.selectCategory(categoryId);
    }
  }

  // Handle close button click
  handleCloseClick() {
    this.hide();
  }

  // Select a category and show its panel
  selectCategory(categoryId) {
    const category = this.categories.find(cat => cat.id === categoryId);
    if (!category || !category.enabled) return;

    console.log(`⚙️ 📂 Selecting category: ${categoryId}`);

    // Hide welcome message
    const welcome = this.element.querySelector('.settings-welcome');
    if (welcome) welcome.style.display = 'none';

    // Hide all panels
    this.hideAllPanels();

    // Show selected panel
    const panel = this.panels.get(categoryId);
    if (panel) {
      panel.show();
      this.currentPanel = 'settings';
      this.updatePanelFocus();
    } else {
      console.warn(`⚙️ ⚠️ No panel found for category: ${categoryId}`);
      // Show welcome message if no panel
      if (welcome) welcome.style.display = 'flex';
    }

    // Update category visual state
    this.updateCategorySelection(categoryId);
  }

  // Hide all panels
  hideAllPanels() {
    this.panels.forEach(panel => {
      if (panel.hide) panel.hide();
    });
  }

  // Update category selection visual state
  updateCategorySelection(selectedId) {
    const categoryItems = this.element.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
      const categoryId = item.dataset.category;
      item.classList.toggle('active', categoryId === selectedId);
    });
  }

  // Update category focus
  updateCategoryFocus() {
    const categoryItems = this.element.querySelectorAll('.category-item');
    categoryItems.forEach((item, index) => {
      item.classList.toggle('selected', index === this.currentCategoryIndex);
    });
  }

  // Update panel focus
  updatePanelFocus() {
    if (this.currentPanel === 'categories') {
      this.updateCategoryFocus();
      
      // Remove focus from close button
      const closeBtn = this.element.querySelector('.close-btn');
      if (closeBtn) closeBtn.classList.remove('selected');
      
    } else if (this.currentPanel === 'settings') {
      // Remove category selection
      const categoryItems = this.element.querySelectorAll('.category-item');
      categoryItems.forEach(item => item.classList.remove('selected'));
      
      // Focus on current panel's first element
      const currentCategory = this.getCurrentCategory();
      const panel = this.panels.get(currentCategory?.id);
      if (panel && panel.setFocus) {
        panel.setFocus(0);
      }
    }
  }

  // Get current category
  getCurrentCategory() {
    return this.categories[this.currentCategoryIndex];
  }

  // Show settings
  async show() {
    if (!this.element) {
      await this.render();
      document.body.appendChild(this.element);
    }

    this.isVisible = true;
    this.element.classList.add('active');
    
    // Reset to categories panel
    this.currentPanel = 'categories';
    this.updatePanelFocus();
    
    console.log('⚙️ 👁️ Settings UI shown');
  }

  // Hide settings
  hide() {
    if (this.element) {
      this.element.classList.remove('active');
      
      setTimeout(() => {
        this.isVisible = false;
      }, 300); // Wait for transition
    }
    
    console.log('⚙️ 👁️ Settings UI hidden');
    
    // Notify that settings were closed
    window.dispatchEvent(new CustomEvent('settingsClosed'));
  }

  // Cleanup
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyPress);
    
    // Destroy panels
    this.panels.forEach(panel => {
      if (panel.destroy) panel.destroy();
    });
    this.panels.clear();
    
    // Remove element
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    this.isVisible = false;
    console.log('⚙️ 🧹 Settings navigation destroyed');
  }

  // Check if settings is currently visible
  isShown() {
    return this.isVisible;
  }

  // Get current panel type
  getCurrentPanel() {
    return this.currentPanel;
  }
}
