import _ from 'lodash';
import path from 'path';
import fs from 'fse-promise'
import {exec} from 'child_process'
import {logMessage, logInfo, logError} from './logger';

export default class Bundler {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.cli = serverless.cli;
    this.options = options;

    // TODO: Do we actually need separate events or is bundle enough for before?
    this.hooks = {
      'before:invoke:local:invoke': this.handlerFactory('before:invoke'),
      'after:invoke:local:invoke': this.handlerFactory('after:invoke')
    }
  }

  /**
   * Set the config, this is lazily evaluated because plugins are instantiated
   * before the serverless.yml is completely parsed so some dynamic properties
   * may be unset. Furthermore, some options can be set on the cli
   */
  _initConfig = () => {
    this.webpack = _.assign({
      entry: './handler.js',
      target: 'node',
      output: {
        library: '',
        libraryTarget: 'umd',
        filename: 'handler.js',
        path: path.resolve(__dirname, 'dist')
      },
      exec: path.resolve(process.cwd(), 'node_modules', '.bin', 'webpack')
    }, _.get(this.serverless.service, 'custom.webpack'));
  }

  // The plugin requires webpack in the project
  _checkWebpackExecutable = async () => {
    try {
      await fs.access(this.webpack.exec, fs.R_OK);
    } catch(err) {
      throw new Error('Webpack is missing. Maybe you need to `npm i --save-dev webpack`');
    }
  }

  // Promisify the node child_process.exec
  _exec = (...args) => new Promise((resolve) => {
    exec(...args, (error, stdout, stderr) => {
      resolve({error, stdout, stderr})
    });
  })

  // Bundle up the distribution using webpack
  _bundle = async () => {
    let webpack = this.webpack.exec;

    await this._checkWebpackExecutable();

    // TODO: Do something about these logs. No one wants to see
    // this stuff, should be using winston or similar with nice log level control
    logMessage('Executing webpack');

    let {error, stdout} = await this._exec(['node', webpack].join(' '));

    if (error) {
      logError(stdout);

      throw new Error('Serverless Bundler failed during webpack execution');
    }

    logInfo(stdout)
  }

  // Set the hooks up with a wrapper to set the webpack config
  handlerFactory = (event) => {
    switch(event) {
      case 'before:invoke': return _.flow(this._initConfig, this.before);
      case 'after:invoke': return _.flow(this._initConfig, this.after);
      case 'before:deploy': return _.flow(this._initConfig, this.before);
      case 'after:deploy': return _.flow(this._initConfig, this.after);
    }
  }

  // Event handler for before `invoke local`
  before = async () => {
    // Bundle the package
    await this._bundle();

    // Adjust the paths tracking the original service path
    this.originalPath = this.serverless.config.servicePath;
    this.serverless.config.servicePath = this.webpack.output.path;
  }

  // TODO: Anything different for invoke vs deploy? Test!
  after = async () => {
    // Clean up generated packages
    await fs.remove(this.webpack.output.path);

    // Fix up adjusted paths
    this.serverless.config.servicePath = this.originalPath;
  }
}
