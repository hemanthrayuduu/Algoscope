# LeetVision

A Chrome extension that visualizes coding problems from platforms like LeetCode and HackerRank using interactive D3.js visualizations.

## Features

- Detects when a user is viewing a coding problem on supported platforms
- Extracts problem statements, examples, constraints, and input/output formats
- Analyzes problems using an LLM
- Renders interactive D3.js visualizations to help understand the problem conceptually
- Allows users to interact with the visualization to understand algorithms step-by-step

## Core Components

1. **Problem Extraction**: Extracts problem details from supported coding platforms
2. **LLM Integration**: Analyzes problems and generates visualization code
3. **D3.js Visualizations**: Creates interactive visualizations for different algorithm types
4. **User Interface**: Provides controls and settings for the visualization experience

## Supported Platforms

- LeetCode
- HackerRank

## Supported Problem Types

- Array problems
- String problems
- (More to be added in future updates)

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build
```

## License

MIT 