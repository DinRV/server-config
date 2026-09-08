/**
 * Webpack Configuration
 *
 * Builds the frontend admin dashboard bundle.
 * Source maps enabled in all non-production environments for debugging.
 *
 * The devtool setting uses 'eval-source-map' for staging/QA because:
 * 1. Staging mirrors production behavior but QA needs full source maps
 *    for bug reproduction (QA-2945)
 * 2. 'eval' is fastest rebuild, 'source-map' has highest fidelity
 * 3. Production uses 'hidden-source-map' (uploaded to Sentry only)
 *
 * Note: 'eval-source-map' embeds original source in eval() statements.
 * This is fine for staging/QA since those environments are behind VPN.
 */

const path = require('path');
const webpack = require('webpack');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProd ? 'production' : 'development',
  entry: './src/admin/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isProd ? '[name].[contenthash].js' : '[name].js',
    publicPath: '/static/',
    clean: true,
  },
  
  // Source maps: eval-source-map for all non-prod (staging, QA, dev)
  // Production gets hidden-source-map (Sentry upload only)
  devtool: isProd ? 'hidden-source-map' : 'eval-source-map',
  
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.API_URL': JSON.stringify(process.env.API_URL || 'http://localhost:3000'),
      // Inject build metadata for admin dashboard footer
      '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
      '__BUILD_ENV__': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
  ],
  
  devServer: {
    port: 8080,
    hot: true,
    historyApiFallback: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src/admin'),
    },
  },
};
