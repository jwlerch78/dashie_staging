// js/settings/settings-controller.js - Main settings controller
// Combines core functionality with features

import { SettingsControllerCore } from './settings-controller-core.js';
import { SettingsControllerFeatures } from './settings-controller-features.js';

// Create a combined class that extends core and mixes in features
export class SettingsController extends SettingsControllerCore {
  constructor() {
    super();
    
    // Mix in all methods from SettingsControllerFeatures
    const features = new SettingsControllerFeatures();
    const featureMethods = Object.getOwnPropertyNames(SettingsControllerFeatures.prototype)
      .filter(name => name !== 'constructor' && typeof features[name] === 'function');
    
    featureMethods.forEach(methodName => {
      this[methodName] = SettingsControllerFeatures.prototype[methodName].bind(this);
    });
  }
}

// Export for backward compatibility
export default SettingsController;
