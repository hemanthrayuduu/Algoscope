// Popup script for LeetVision

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  loadSettings();
  
  // Add event listeners
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('auto-analyze').addEventListener('change', saveAutoAnalyze);
});

/**
 * Loads saved settings from Chrome storage
 */
function loadSettings() {
  chrome.storage.sync.get(['apiKey', 'autoAnalyze'], (data) => {
    // Load API key if it exists
    if (data.apiKey) {
      document.getElementById('api-key').value = data.apiKey;
    }
    
    // Load auto-analyze setting
    document.getElementById('auto-analyze').checked = !!data.autoAnalyze;
  });
}

/**
 * Saves API key to Chrome storage
 */
function saveSettings() {
  const apiKey = document.getElementById('api-key').value.trim();
  const statusElement = document.getElementById('settings-status');
  
  if (!apiKey) {
    // Show error if API key is empty
    statusElement.textContent = 'Please enter a valid API key';
    statusElement.className = 'status error';
    return;
  }
  
  // Save API key to Chrome storage
  chrome.runtime.sendMessage(
    { action: 'saveApiKey', apiKey },
    (response) => {
      if (response.success) {
        // Show success message
        statusElement.textContent = 'Settings saved successfully';
        statusElement.className = 'status success';
        
        // Hide message after 3 seconds
        setTimeout(() => {
          statusElement.className = 'status';
        }, 3000);
      } else {
        // Show error message
        statusElement.textContent = 'Failed to save settings';
        statusElement.className = 'status error';
      }
    }
  );
}

/**
 * Saves auto-analyze setting to Chrome storage
 */
function saveAutoAnalyze() {
  const autoAnalyze = document.getElementById('auto-analyze').checked;
  
  chrome.storage.sync.set({ autoAnalyze }, () => {
    console.log('Auto-analyze setting saved:', autoAnalyze);
  });
} 