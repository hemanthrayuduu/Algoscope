// Background script for LeetVision extension

// Configuration object for the extension
const config = {
  apiKey: '',
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
  supportedDomains: ['leetcode.com', 'hackerrank.com']
};

// Store API key securely using Chrome's storage API
chrome.storage.sync.get('apiKey', (data) => {
  if (data.apiKey) {
    config.apiKey = data.apiKey;
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeProblem') {
    analyzeProblem(request.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates asynchronous response
  }
  
  if (request.action === 'saveApiKey') {
    chrome.storage.sync.set({ apiKey: request.apiKey }, () => {
      config.apiKey = request.apiKey;
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Analyzes a coding problem using an LLM and generates visualization code
 * @param {Object} problemData - The extracted problem data
 * @returns {Promise<Object>} - The LLM response with visualization details
 */
async function analyzeProblem(problemData) {
  if (!config.apiKey) {
    throw new Error('API key not configured. Please set your API key in the extension settings.');
  }
  
  const prompt = generatePrompt(problemData);
  
  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a specialized algorithm visualization expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return parseResponse(data);
  } catch (error) {
    console.error('Error calling LLM API:', error);
    throw error;
  }
}

/**
 * Generates a prompt for the LLM based on the problem data
 * @param {Object} problemData - The extracted problem data
 * @returns {string} - The formatted prompt
 */
function generatePrompt(problemData) {
  return `You are a specialized algorithm visualization expert. Analyze this coding problem and generate D3.js code to visualize it:

PROBLEM TITLE: ${problemData.title}
DESCRIPTION: ${problemData.description}
EXAMPLES: ${problemData.examples.join('\n')}
CONSTRAINTS: ${problemData.constraints.join('\n')}

Your task:
1. Identify the key data structure and algorithm concepts in this problem
2. Determine the most effective visualization approach
3. Generate complete, working D3.js code that:
   - Creates an interactive visualization of the problem
   - Shows how the algorithm would process the input
   - Highlights key insights and patterns
   - Includes step-by-step animation capabilities
4. Provide explanatory annotations for each visualization element

Your response should be valid JSON with these fields:
{
  "problemType": "array|tree|graph|dp|string|other",
  "approach": "Brief explanation of the algorithmic approach",
  "visualizationType": "Type of visualization used",
  "d3Code": "Complete D3.js code to render the visualization",
  "explanation": "Step-by-step explanation to accompany the visualization",
  "complexity": {"time": "O(n)", "space": "O(n)"}
}

Ensure that your D3.js code is complete, self-contained, and uses D3.js v7 syntax. The visualization should be interactive and educational.`;
}

/**
 * Parses the LLM response to extract the visualization data
 * @param {Object} response - The raw LLM response
 * @returns {Object} - The parsed visualization data
 */
function parseResponse(response) {
  try {
    const content = response.choices[0].message.content;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)```|```([\s\S]*?)```|({[\s\S]*})/);
    
    if (jsonMatch) {
      const jsonString = jsonMatch[1] || jsonMatch[2] || jsonMatch[3];
      return JSON.parse(jsonString.trim());
    }
    
    // If no JSON block is found, try parsing the entire content
    return JSON.parse(content.trim());
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    throw new Error('Failed to parse LLM response. The response format was unexpected.');
  }
} 