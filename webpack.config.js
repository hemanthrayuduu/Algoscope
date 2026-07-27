const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const ENTRY_OUTPUT_PATHS = {
  background: 'background/background.js',
  popup: 'popup/popup.js',
  content: 'content/content.js',
  stepVisualizer: 'content/stepVisualizer.js',
};

module.exports = {
  entry: {
    background: './src/background/background.js',
    content: './src/content/content.js',
    popup: './src/popup/popup.js',
    stepVisualizer: './src/content/stepVisualizer.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) => `src/${ENTRY_OUTPUT_PATHS[pathData.chunk.name]}`,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "." },
        { from: "assets", to: "assets" },
        { from: "src/popup/popup.html", to: "src/popup" },
        { from: "src/content/styles.css", to: "src/content" },
        { from: "src/content/extractors.js", to: "src/content" },
        { from: "src/content/visualization.js", to: "src/content" },
      ],
    }),
  ],
}; 