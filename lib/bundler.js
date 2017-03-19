import _ from 'lodash';
import path from 'path';
import fs from 'fse-promise'
import {exec} from 'child_process'
import log from 'loglevel';
import webpack from 'webpack';
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
    let defaultHandler = `${this._getHandler().path}.js`;

    this.config = _.assign({
      logging: {
        enabled: !!process.env.SLS_DEBUG
      },
      clean: true
    }, _.get(this.serverless.service, 'custom.bundler'));

    this.webpack = _.assign({
      entry: `./${defaultHandler}`,
      target: 'node',
      output: {
        library: '',
        libraryTarget: 'umd',
        filename: defaultHandler,
        path: path.resolve(process.cwd(), 'dist')
      }
    }, _.get(this.serverless.service, 'custom.webpack'));

    if (this.config.logging.enabled) {
      log.setLevel(log.levels.DEBUG);
    } else {
      log.setLevel(log.levels.ERROR);
    }
  }

  // TODO: Remove? Promisify the node child_process.exec
  // _exec = (...args) => new Promise((resolve) => {
  //   exec(...args, (error, stdout, stderr) => {
  //     resolve({error, stdout, stderr})
  //   });
  // })

  _runWebpack = () => new Promise((resolve, reject) => {
    webpack(this.webpack, (err, stats) => err ? reject(err) : resolve(stats));
  });

  _getHandler = () => {
    let [path, func] = _.split(_.get(this.options, 'functionObj.handler'), '.');

    return {path, func};
  }

  // Bundle up the distribution using webpack
  _bundle = async () => {
    log.debug(yellow('Bundler:'), 'running webpack');
    let stats = await this._runWebpack()

    let info = stats.toJson();

    let message = stats.toString({ colors: true });

    if (stats.hasErrors()) throw new Error(message);

    log.debug(message);
  }

  // Set the hooks up with a wrapper to set the webpack config
  handlerFactory = (handler) => _.flow(this._initConfig, this[handler]);

  // Prepare the before command execution by bundling and moving dir
  build = async () => {
    try {
      // Bundle the package
      await this._bundle();

      // Adjust the paths tracking the original service path
      this.originalPath = this.serverless.config.servicePath;
      this.serverless.config.servicePath = this.webpack.output.path;
    } catch(err) {
      log.error(err);
    }
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
    this.originalPath = undefined;
  }
}
