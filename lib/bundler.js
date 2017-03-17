import _ from 'lodash';
import path from 'path';
import fs from 'fse-promise'
import {exec} from 'child_process'
import log from 'loglevel';
import {yellow, green, red} from 'chalk';

export default class Bundler {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:invoke:local:invoke': this.handlerFactory('build'),
      'after:invoke:local:invoke': this.handlerFactory('clean'),
      'after:deploy:initialize': this.handlerFactory('build'),
      'after:deploy:deploy': this.handlerFactory('clean')
    }
  }

  /**
   * Set the config, this is lazily evaluated because plugins are instantiated
   * before the serverless.yml is completely parsed so some dynamic properties
   * may be unset. Furthermore, some options can be set on the cli
   */
  _initConfig = () => {
    this.config = _.assign({
      logging: {
        enabled: !!process.env.SLS_DEBUG
      },
      clean: true
    }, _.get(this.serverless.service, 'custom.bundler'));
    this.webpack = _.assign({
      entry: './handler.js',
      target: 'node',
      output: {
        library: '',
        libraryTarget: 'umd',
        filename: 'handler.js',
        path: path.resolve(process.cwd(), 'dist')
      },
      exec: path.resolve(process.cwd(), 'node_modules', '.bin', 'webpack')
    }, _.get(this.serverless.service, 'custom.webpack'));

    if (this.config.logging.enabled) {
      log.setLevel(log.levels.DEBUG);
    } else {
      log.setLevel(log.levels.SILENT);
    }
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

    log.debug(yellow('Bundler:'), 'checking for local webpack');
    await this._checkWebpackExecutable();

    log.debug(yellow('Bundler:'), 'executing webpack');

    let {error, stdout} = await this._exec(['node', webpack].join(' '));

    if (error) {
      log.error(yellow('Bundler:'), red('webpack error'));
      throw new Error(stdout);
    }

    log.debug(yellow('Bundler:\n'), green(stdout));
  }

  // Set the hooks up with a wrapper to set the webpack config
  handlerFactory = (handler) => _.flow(this._initConfig, this[handler]);

  // Prepare the before command execution by bundling and moving dir
  build = async () => {
    // Bundle the package
    await this._bundle();

    // Adjust the paths tracking the original service path
    this.originalPath = this.serverless.config.servicePath;
    this.serverless.config.servicePath = this.webpack.output.path;
  }

  // Clean up and reset configurations after command execution
  clean = async () => {
    if (this.config.clean) {
      log.debug(
        yellow('Bundler:'),
        `cleaning output dir(${this.webpack.output.path})`
      );
      await fs.remove(this.webpack.output.path);
    }
    // Fix up adjusted paths
    this.serverless.config.servicePath = this.originalPath;
  }
}
