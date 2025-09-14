// js/settings/test-settings.js
// Fixed test script that properly simulates events

async function testSettingsSystem() {
  console.log('🧪 Testing Settings System...');
  
  try {
    // Test 1: Import and initialize
    console.log('📦 Test 1: Importing settings main...');
    const settingsMain = await import('./settings-main.js');
    console.log('✅ Settings main imported successfully');
    
    // Test 2: Check initialization
    console.log('🚀 Test 2: Initializing settings...');
    const initSuccess = await settingsMain.initializeSettings();
    console.log(`✅ Settings initialization: ${initSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    // Test 3: Check if settings are ready
    console.log('⏰ Test 3: Checking if settings are ready...');
    const isReady = settingsMain.isSettingsReady();
    console.log(`✅ Settings ready: ${isReady}`);
    
    // Test 4: Get/Set basic settings
    console.log('📝 Test 4: Testing get/set operations...');
    const originalTheme = settingsMain.getSetting('display.theme', 'dark');
    console.log(`📖 Current theme: ${originalTheme}`);
    
    const setSuccess = settingsMain.setSetting('display.theme', 'light');
    console.log(`📝 Set theme to light: ${setSuccess}`);
    
    const newTheme = settingsMain.getSetting('display.theme');
    console.log(`📖 New theme: ${newTheme}`);
    
    // Restore original theme
    settingsMain.setSetting('display.theme', originalTheme);
    console.log(`🔄 Restored original theme: ${originalTheme}`);
    
    // Test 5: Show settings UI
    console.log('🎨 Test 5: Testing settings UI...');
    await settingsMain.showSettings();
    console.log('✅ Settings UI should now be visible');
    
    // Test 6: Check DOM elements
    console.log('🔍 Test 6: Checking DOM elements...');
    const overlay = document.querySelector('.settings-overlay');
    const container = document.querySelector('.settings-container');
    const sidebar = document.querySelector('.settings-sidebar');
    const main = document.querySelector('.settings-main');
    
    console.log(`Settings overlay: ${overlay ? '✅ Found' : '❌ Missing'}`);
    console.log(`Settings container: ${container ? '✅ Found' : '❌ Missing'}`);
    console.log(`Settings sidebar: ${sidebar ? '✅ Found' : '❌ Missing'}`);
    console.log(`Settings main: ${main ? '✅ Found' : '❌ Missing'}`);
    
    // Test 7: Test keyboard navigation - FIXED
    console.log('⌨️ Test 7: Testing keyboard navigation...');
    // Create a proper event-like object
    const mockEvent = {
      key: 'ArrowDown',
      preventDefault: () => {},
      stopPropagation: () => {},
      stopImmediatePropagation: () => {}
    };
    const navTest = settingsMain.handleSettingsKeyPress(mockEvent);
    console.log(`Keyboard navigation test: ${navTest ? '✅ Handled' : '❌ Not handled'}`);
    
    // Test 8: Hide settings
    console.log('👁️ Test 8: Hiding settings UI...');
    settingsMain.hideSettings();
    
    setTimeout(() => {
      const overlayAfterHide = document.querySelector('.settings-overlay.active');
      console.log(`Settings hidden: ${!overlayAfterHide ? '✅ Success' : '❌ Still visible'}`);
    }, 500);
    
    console.log('🎉 All tests completed! Check console for results.');
    
    return {
      success: true,
      message: 'Settings system tests completed',
      functions: settingsMain
    };
    
  } catch (error) {
    console.error('❌ Settings test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for manual testing
window.testSettingsSystem = testSettingsSystem;

export { testSettingsSystem };
