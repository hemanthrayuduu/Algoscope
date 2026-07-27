// Main content script for LeetVision

// Initialize namespace if it doesn't exist
window.LeetVision = window.LeetVision || {};

// Main controller class
class LeetVisionController {
  constructor() {
    this.initialized = false;
    this.problemData = null;
    this.visualizationData = null;
    this.uiElements = {};
  }
  
  /**
   * Initializes the extension on the current page
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Check if we're on a supported problem page
      if (!this.isProblemPage()) {
        console.log('Not a supported problem page');
        return;
      }
      
      console.log('LeetVision: Initializing on problem page');
      
      // Extract problem data
      const extractor = window.LeetVision.extractors.getExtractor();
      this.problemData = extractor.extractProblem();
      
      // Create UI elements
      this.createUI();
      
      // Mark as initialized
      this.initialized = true;
      
      // Check if we need to automatically analyze the problem
      chrome.storage.sync.get('autoAnalyze', (data) => {
        if (data.autoAnalyze) {
          this.analyzeProblem();
        }
      });
    } catch (error) {
      console.error('Error initializing LeetVision:', error);
    }
  }
  
  /**
   * Checks if the current page is a supported problem page
   * @returns {boolean} - Whether the current page is a supported problem page
   */
  isProblemPage() {
    const url = window.location.href;
    return (
      (url.includes('leetcode.com/problems/') && !url.includes('/solution')) ||
      (url.includes('hackerrank.com/challenges/') && !url.includes('/leaderboard'))
    );
  }
  
  /**
   * Creates the UI elements for the extension
   */
  createUI() {
    // Create container for the visualization
    const container = document.createElement('div');
    container.id = 'leetvision-container';
    container.className = 'leetvision-container';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'leetvision-header';
    header.innerHTML = `
      <h3>LeetVision - Algorithm Visualizer</h3>
      <div class="leetvision-controls">
        <button id="leetvision-analyze-btn" class="leetvision-btn">Visualize Problem</button>
        <button id="leetvision-steptrough-btn" class="leetvision-btn">Step Through My Code</button>
        <button id="leetvision-toggle-btn" class="leetvision-btn">Hide</button>
      </div>
    `;
    container.appendChild(header);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'leetvision-content';
    
    // Create loading indicator
    const loading = document.createElement('div');
    loading.className = 'leetvision-loading';
    loading.innerHTML = '<div class="leetvision-spinner"></div><p>Analyzing problem and generating visualization...</p>';
    loading.style.display = 'none';
    content.appendChild(loading);
    
    // Create error display
    const error = document.createElement('div');
    error.className = 'leetvision-error';
    error.style.display = 'none';
    content.appendChild(error);
    
    // Create visualization area
    const visualization = document.createElement('div');
    visualization.id = 'leetvision-visualization';
    visualization.className = 'leetvision-visualization';
    visualization.style.display = 'none';
    content.appendChild(visualization);
    
    // Create explanation panel
    const explanation = document.createElement('div');
    explanation.className = 'leetvision-explanation';
    explanation.style.display = 'none';
    content.appendChild(explanation);
    
    container.appendChild(content);
    
    // Store UI elements for later reference
    this.uiElements = {
      container,
      loading,
      error,
      visualization,
      explanation,
      analyzeBtn: header.querySelector('#leetvision-analyze-btn'),
      stepThroughBtn: header.querySelector('#leetvision-steptrough-btn'),
      toggleBtn: header.querySelector('#leetvision-toggle-btn')
    };

    // Add event listeners
    this.uiElements.analyzeBtn.addEventListener('click', () => this.analyzeProblem());
    this.uiElements.stepThroughBtn.addEventListener('click', () => this.openStepVisualizer());
    this.uiElements.toggleBtn.addEventListener('click', () => this.toggleVisibility());
    
    // Add container to the page
    this.injectContainerToPage(container);
  }
  
  /**
   * Injects the container into the page at the appropriate location
   * @param {HTMLElement} container - The container element to inject
   */
  injectContainerToPage(container) {
    const url = window.location.href;
    
    if (url.includes('leetcode.com')) {
      // For LeetCode
      const targetElement = document.querySelector('[data-cy="question-content"]');
      if (targetElement) {
        targetElement.parentNode.insertBefore(container, targetElement.nextSibling);
      } else {
        // Fallback
        document.body.appendChild(container);
      }
    } else if (url.includes('hackerrank.com')) {
      // For HackerRank
      const targetElement = document.querySelector('.challenge-body-html');
      if (targetElement) {
        targetElement.parentNode.insertBefore(container, targetElement.nextSibling);
      } else {
        // Fallback
        document.body.appendChild(container);
      }
    }
  }
  
  /**
   * Toggles the visibility of the visualization container
   */
  toggleVisibility() {
    const content = this.uiElements.container.querySelector('.leetvision-content');
    const isVisible = content.style.display !== 'none';
    
    content.style.display = isVisible ? 'none' : 'block';
    this.uiElements.toggleBtn.textContent = isVisible ? 'Show' : 'Hide';
  }
  
  /**
   * Opens the local step-through execution visualizer for the current problem.
   * Runs entirely in this content script; no network/LLM calls involved.
   */
  openStepVisualizer() {
    if (!window.LeetVision.stepVisualizer) {
      this.showError('Step visualizer failed to load.');
      return;
    }
    window.LeetVision.stepVisualizer.open(this.problemData);
  }

  /**
   * Sends the problem data to the background script for analysis
   */
  async analyzeProblem() {
    try {
      // Show loading indicator
      this.uiElements.loading.style.display = 'flex';
      this.uiElements.error.style.display = 'none';
      this.uiElements.visualization.style.display = 'none';
      this.uiElements.explanation.style.display = 'none';
      
      // Send message to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'analyzeProblem', data: this.problemData },
          (response) => resolve(response)
        );
      });
      
      // Hide loading indicator
      this.uiElements.loading.style.display = 'none';
      
      if (response.success) {
        this.visualizationData = response.data;
        this.renderVisualization();
      } else {
        this.showError(response.error || 'An unknown error occurred');
      }
    } catch (error) {
      this.uiElements.loading.style.display = 'none';
      this.showError(error.message || 'An unknown error occurred');
    }
  }
  
  /**
   * Renders the visualization using the data from the LLM
   */
  renderVisualization() {
    try {
      // Show visualization area
      this.uiElements.visualization.style.display = 'block';
      this.uiElements.explanation.style.display = 'block';
      
      // Add the explanation
      this.uiElements.explanation.innerHTML = `
        <h4>Approach: ${this.visualizationData.approach}</h4>
        <div class="leetvision-explanation-text">${this.visualizationData.explanation}</div>
        <div class="leetvision-complexity">
          <p>Time Complexity: ${this.visualizationData.complexity.time}</p>
          <p>Space Complexity: ${this.visualizationData.complexity.space}</p>
        </div>
      `;
      
      // Add the D3.js visualization
      const visualizationCode = this.visualizationData.d3Code;
      
      // Create a sandbox iframe to run the D3 code
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '500px';
      iframe.style.border = 'none';
      
      this.uiElements.visualization.innerHTML = '';
      this.uiElements.visualization.appendChild(iframe);
      
      // Add D3.js to the iframe
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <script src="https://d3js.org/d3.v7.min.js"></script>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            #visualization {
              width: 100%;
              height: 100%;
            }
            .controls {
              position: absolute;
              bottom: 10px;
              left: 50%;
              transform: translateX(-50%);
              display: flex;
              gap: 10px;
              background: rgba(255, 255, 255, 0.9);
              padding: 5px 10px;
              border-radius: 4px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            button {
              padding: 5px 10px;
              border: none;
              background: #0078d7;
              color: white;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background: #005a9e;
            }
            button:disabled {
              background: #cccccc;
              cursor: not-allowed;
            }
          </style>
        </head>
        <body>
          <div id="visualization"></div>
          <script>
            ${visualizationCode}
          </script>
        </body>
        </html>
      `;
      
      iframe.srcdoc = html;
    } catch (error) {
      console.error('Error rendering visualization:', error);
      this.showError(`Error rendering visualization: ${error.message}`);
    }
  }
  
  /**
   * Shows an error message
   * @param {string} message - The error message to display
   */
  showError(message) {
    this.uiElements.error.style.display = 'block';
    this.uiElements.error.innerHTML = `
      <div class="leetvision-error-icon">⚠️</div>
      <div class="leetvision-error-message">
        <h4>Error</h4>
        <p>${message}</p>
      </div>
    `;
  }
}

// Allow the popup to trigger the local step-through visualizer without
// needing to read back the controller's in-memory problem data.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openStepVisualizer') {
    const controller = window.LeetVision && window.LeetVision.controller;
    if (controller && controller.initialized) {
      controller.openStepVisualizer();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not on a supported problem page' });
    }
  }
});

// Initialize controller when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for dynamic content to load
  setTimeout(() => {
    const controller = new LeetVisionController();
    window.LeetVision.controller = controller;
    controller.initialize();
  }, 1000);
});

// Re-initialize on navigation (for single-page applications)
let previousUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== previousUrl) {
    previousUrl = window.location.href;
    
    // Wait a bit for the new page to load
    setTimeout(() => {
      if (window.LeetVision && window.LeetVision.controller) {
        window.LeetVision.controller.initialize();
      }
    }, 1000);
  }
});

observer.observe(document, { subtree: true, childList: true }); 