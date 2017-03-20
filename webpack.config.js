var path = require('path');

module.exports = {
  entry: './index.js',
  target: 'node',
  devtool: 'source-map',
  externals: {
    webpack: 'webpack'
  },
  output: {
    library: '',
    libraryTarget: 'umd',
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    loaders: [{
        test: /\.js$/,
        exclude: /(node_modules|dist)/,
        loader: 'babel-loader'
      }
    ]
  }
};
