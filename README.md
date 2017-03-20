### Serverless Bundler Plugin

> _Allows project bundling via webpack for serverless invoke local and deploy_

[![Build Status](https://travis-ci.org/lteacher/serverless-plugin-bundler.svg?branch=master)](https://travis-ci.org/lteacher/serverless-plugin-bundler)
[![Coverage Status](https://coveralls.io/repos/github/lteacher/serverless-plugin-bundler/badge.svg?branch=master)](https://coveralls.io/github/lteacher/serverless-plugin-bundler?branch=master)

### Install

In your serverless project, run npm or yarn install. Note that to import the webpack config you also need the [`serverless-plugin-js-import`](https://www.npmjs.com/package/serverless-plugin-js-import)

```sh
npm install --save-dev serverless-plugin-bundler serverless-plugin-js-import
```

You need to be running webpack in your project, so `npm i --save-dev webpack` if you dont have it

### Setup
Configure both plugins in the `serverless.yml` like:

```yaml
plugins:
  - serverless-plugin-bundler
  - serverless-plugin-js-import
```

### Usage

#### Option 1

Include a webpack configuration via import to an existing config file

```yaml
custom:
  webpack: ${file(./webpack.config.js)}
```

#### Option 2 - _(Experimental)_

Include a webpack configuration, also in `serverless.yml` like _(example only)_

```yaml
custom:
  webpack:
    entry: ./handler.js
    target: node
    output:
      libraryTarget: umd
      filename: handler.js
      path: dist/
    module:
      loaders:
        -
          test: /\.js$/
          exclude: /(node_modules|dist)/
          loader: babel-loader
```

### Config

The bundler has some minimal configuration here are the options which also go into the `custom` section of the yaml under `bundler` exactly as shown

```yaml
custom:
  bundler:
    logging: true # Enables logging. SLS_DEBUG=* also enables this
    clean: true   # Allows for not cleaning the output dir. Defaults to true
```
