const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/background.js',
    content: './src/content/content.js',
    popup: './src/popup/popup.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'src/[name]/[name].js',
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