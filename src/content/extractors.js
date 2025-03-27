// Extractors for different coding problem platforms

/**
 * Factory function to get the appropriate extractor based on the current URL
 * @returns {Object} - The appropriate extractor object
 */
function getExtractor() {
  const url = window.location.href;
  
  if (url.includes('leetcode.com')) {
    return leetcodeExtractor;
  } else if (url.includes('hackerrank.com')) {
    return hackerrankExtractor;
  }
  
  throw new Error('Unsupported platform');
}

/**
 * Extractor for LeetCode problems
 */
const leetcodeExtractor = {
  /**
   * Extracts problem data from a LeetCode problem page
   * @returns {Object} - The extracted problem data
   */
  extractProblem() {
    try {
      // Extract problem title
      const titleElement = document.querySelector('[data-cy="question-title"]');
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      // Extract problem description
      const descriptionElement = document.querySelector('[data-cy="question-content"] .content__1Y2H');
      const description = descriptionElement ? this.cleanupText(descriptionElement.textContent) : '';
      
      // Extract examples
      const examples = [];
      const exampleBlocks = document.querySelectorAll('[data-cy="question-content"] pre');
      exampleBlocks.forEach(block => {
        examples.push(block.textContent.trim());
      });
      
      // Extract constraints
      const constraints = [];
      const paragraphs = document.querySelectorAll('[data-cy="question-content"] p');
      for (const p of paragraphs) {
        const text = p.textContent.trim();
        if (text.includes('Constraints:') || text.includes('constraints:')) {
          // Extract the constraints from this paragraph and possibly following ones
          constraints.push(text);
          
          // Look for list items after this paragraph
          let nextElement = p.nextElementSibling;
          while (nextElement && (nextElement.tagName === 'UL' || nextElement.tagName === 'LI')) {
            if (nextElement.tagName === 'UL') {
              const items = nextElement.querySelectorAll('li');
              items.forEach(item => constraints.push(item.textContent.trim()));
            } else if (nextElement.tagName === 'LI') {
              constraints.push(nextElement.textContent.trim());
            }
            nextElement = nextElement.nextElementSibling;
          }
          break;
        }
      }
      
      return {
        title,
        description,
        examples,
        constraints
      };
    } catch (error) {
      console.error('Error extracting LeetCode problem:', error);
      throw new Error('Failed to extract problem from LeetCode');
    }
  },
  
  /**
   * Cleans up text by removing excessive whitespace
   * @param {string} text - The text to clean
   * @returns {string} - The cleaned text
   */
  cleanupText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }
};

/**
 * Extractor for HackerRank problems
 */
const hackerrankExtractor = {
  /**
   * Extracts problem data from a HackerRank problem page
   * @returns {Object} - The extracted problem data
   */
  extractProblem() {
    try {
      // Extract problem title
      const titleElement = document.querySelector('.challenge-title');
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      // Extract problem description
      const descriptionElement = document.querySelector('.challenge-text');
      const description = descriptionElement ? this.cleanupText(descriptionElement.textContent) : '';
      
      // Extract examples
      const examples = [];
      const exampleBlocks = document.querySelectorAll('.challenge-body-html pre');
      exampleBlocks.forEach(block => {
        examples.push(block.textContent.trim());
      });
      
      // Extract constraints
      const constraints = [];
      const constraintsElements = document.querySelectorAll('.challenge-body-html p');
      for (const el of constraintsElements) {
        const text = el.textContent.trim();
        if (text.includes('Constraints:') || text.includes('constraints:')) {
          constraints.push(text);
          
          // Look for list items after this paragraph
          let nextElement = el.nextElementSibling;
          while (nextElement && (nextElement.tagName === 'UL' || nextElement.tagName === 'LI')) {
            if (nextElement.tagName === 'UL') {
              const items = nextElement.querySelectorAll('li');
              items.forEach(item => constraints.push(item.textContent.trim()));
            } else if (nextElement.tagName === 'LI') {
              constraints.push(nextElement.textContent.trim());
            }
            nextElement = nextElement.nextElementSibling;
          }
          break;
        }
      }
      
      return {
        title,
        description,
        examples,
        constraints
      };
    } catch (error) {
      console.error('Error extracting HackerRank problem:', error);
      throw new Error('Failed to extract problem from HackerRank');
    }
  },
  
  /**
   * Cleans up text by removing excessive whitespace
   * @param {string} text - The text to clean
   * @returns {string} - The cleaned text
   */
  cleanupText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }
};

// Export extractors
window.LeetVision = window.LeetVision || {};
window.LeetVision.extractors = {
  getExtractor
}; 