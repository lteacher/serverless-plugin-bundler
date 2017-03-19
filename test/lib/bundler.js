import _ from 'lodash';
import test from 'ava';
import {expect} from 'chai';
import log from 'loglevel';
import path from 'path';
import sinon from 'sinon';
import fs from 'fse-promise';
import Bundler from '../../lib/bundler';
import {serverless} from '../mocks';

const {getMocks} = serverless;
const FS_READ = fs.constants ? fs.constants.R_OK : fs.R_OK;

const spy = (ob, exclude = []) => _.mapValues(ob, (v, k) => {
  return !_.isFunction(ob[k]) || _.includes(exclude, k) ? v : sinon.spy(ob, k);
});

test.serial('Bundler can be instantiated', t => {
  t.truthy(new Bundler() instanceof Bundler);
});

test.serial('Bundler is initialized with expected values', t => {
  let [serverless, options] = getMocks()

  let bundler = new Bundler(serverless, options);

  t.deepEqual(bundler.serverless, serverless);
  t.deepEqual(bundler.options, options);

  expect(bundler.hooks).to.have.keys([
    'before:invoke:local:invoke',
    'after:invoke:local:invoke',
    'after:deploy:initialize',
    'after:deploy:deploy'
  ]);

  _(_.values(bundler.hooks))
    .map(_.isFunction)
    .each(r => t.true(r));
});

test('Bundler._initConfig should set config default values', t => {
  delete process.env.SLS_DEBUG;
  let bundler = new Bundler(...getMocks());
  let config = {
    logging: {
      enabled: false
    },
    clean: true
  };

  bundler._initConfig();

  t.deepEqual(bundler.config, config)
  t.is(log.getLevel(), log.levels.ERROR);
});

test.serial('Bundler._initConfig should enable logging from env variable', t => {
  process.env.SLS_DEBUG = '*';
  let bundler = new Bundler(...getMocks());
  let config = {
    logging: {
      enabled: true
    },
    clean: true
  };

  bundler._initConfig();

  t.deepEqual(bundler.config, config);
  t.is(log.getLevel(), log.levels.DEBUG);
});

test('Bundler._initConfig should respect serverless custom config', t => {
  delete process.env.SLS_DEBUG
  let [serverless] = getMocks();
  serverless.service.custom.bundler = {
    logging: { enabled: true },
    clean: false
  }

  let bundler = new Bundler(serverless);
  let config = {
    logging: {
      enabled: true
    },
    clean: false
  };

  bundler._initConfig();

  t.deepEqual(bundler.config, config);
  t.is(log.getLevel(), log.levels.DEBUG);
});

test('Bundler._initConfig should set some webpack default values', t => {
  let bundler = new Bundler(...getMocks());
  let webpack = {
    entry: './handler.js',
    target: 'node',
    output: {
      library: '',
      libraryTarget: 'umd',
      filename: 'handler.js',
      path: path.join(process.cwd(), 'dist')
    }
  };

  bundler._initConfig();

  t.deepEqual(bundler.webpack, webpack);
});

test('Bundler._initConfig should respect serverless custom webpack config', t => {
  let [serverless] = getMocks();
  let webpack = {
    entry: './kewl.js',
    output: {
      libraryTarget: 'commonjs',
      filename: 'mega.js',
      path: '/new/path'
    }
  }

  serverless.service.custom.webpack = webpack;

  let bundler = new Bundler(serverless);

  bundler._initConfig();

  t.is(bundler.webpack.entry, webpack.entry);
  t.is(bundler.webpack.output.libraryTarget, webpack.output.libraryTarget);
  t.is(bundler.webpack.output.filename, webpack.output.filename);
  t.is(bundler.webpack.output.path, webpack.output.path);
});

test('Bundler._bundle should check for webpack and execute', async t => {
  let [serverless] = getMocks();

  serverless.service.custom.webpack = {
    entry: './index.js',
    output: {
      filename: 'index.js',
      path: 'out/'
    },
    module: {
      loaders: [{
          test: /\.js$/,
          exclude: /(node_modules|dist)/,
          loader: 'babel-loader'
        }
      ]
    }
  }

  let bundler = new Bundler(serverless);

  let {_getHandler, _runWebpack} = spy(bundler);

  bundler._initConfig();
  await bundler._bundle();
  t.true(_getHandler.called);
  t.true(_runWebpack.called);
  await fs.access('out/', FS_READ);
  await fs.remove('out/');
});

test('Bundler._bundle should throw webpack error', async t => {
  let [serverless] = getMocks();

  serverless.service.custom.webpack = {
    entry: './indexz.js',
    output: {
      filename: 'index.js',
      path: 'out/'
    }
  }

  let bundler = new Bundler(serverless);

  bundler._initConfig();

  let error = await t.throws(bundler._bundle());
  t.regex(error, /Entry module not found/);
});

test('Bundler.build should call bundle and change servicePath', async t => {
  let [serverless] = getMocks();

  serverless.service.custom.webpack = {
    entry: './index.js',
    output: {
      filename: 'index.js',
      path: 'out/'
    },
    module: {
      loaders: [{
          test: /\.js$/,
          exclude: /(node_modules|dist)/,
          loader: 'babel-loader'
        }
      ]
    }
  }

  let bundler = new Bundler(serverless);

  let {_initConfig, _getHandler, _runWebpack, _bundle} = spy(bundler);

  bundler._initConfig();
  await bundler.build();
  t.true(_getHandler.called);
  t.true(_runWebpack.called);
  t.true(_bundle.called);
  t.is(bundler.serverless.config.servicePath, 'out/');
  t.is(bundler.originalPath, '/');
  await fs.access('out/', FS_READ);
  await fs.remove('out/');
});

test('Bundler.build should handle webpack error via log and not bundle', async t => {
  let [serverless] = getMocks();

  serverless.service.custom.webpack = {
    entry: './indexz.js',
    output: {
      filename: 'index.js',
      path: 'out/'
    }
  }

  let bundler = new Bundler(serverless);

  let {_initConfig, _getHandler, _runWebpack, _bundle} = spy(bundler);

  bundler._initConfig();
  await bundler.build();
  t.true(_getHandler.called);
  t.true(_runWebpack.called);
  t.true(_bundle.called);
  t.is(bundler.serverless.config.servicePath, '/');
  t.true(_.isUndefined(bundler.originalPath));
});

test('Bundler.clean should remove output directory and reset path', async t => {
  let [serverless] = getMocks();

  serverless.service.custom.webpack = {
    entry: './index.js',
    output: {
      filename: 'index.js',
      path: 'outputDir/'
    },
    module: {
      loaders: [{
          test: /\.js$/,
          exclude: /(node_modules|dist)/,
          loader: 'babel-loader'
        }
      ]
    }
  }

  let bundler = new Bundler(serverless);

  let {_initConfig, _getHandler, _runWebpack, _bundle} = spy(bundler);

  bundler._initConfig();
  await bundler.build();
  t.true(_getHandler.called);
  t.true(_runWebpack.called);
  t.true(_bundle.called);
  t.is(bundler.serverless.config.servicePath, 'outputDir/');
  t.is(bundler.originalPath, '/');
  await fs.access('outputDir/', FS_READ);

  await bundler.clean();
  t.is(bundler.serverless.config.servicePath, '/');
  t.true(_.isUndefined(bundler.originalPath));
  try {
    await fs.access('outputDir/', FS_READ);

    t.fail(); // The dir should be cleaned
  } catch(err) {
    t.pass();
  }
});

test('Bundler.clean should respect configuration options', async t => {
  let [serverless] = getMocks();

  serverless.service.custom.webpack = {
    entry: './index.js',
    output: {
      filename: 'index.js',
      path: 'outputDir/'
    },
    module: {
      loaders: [{
          test: /\.js$/,
          exclude: /(node_modules|dist)/,
          loader: 'babel-loader'
        }
      ]
    }
  }

  serverless.service.custom.bundler = {
    clean: false
  }

  let bundler = new Bundler(serverless);

  let {_initConfig, _getHandler, _runWebpack, _bundle} = spy(bundler);

  bundler._initConfig();
  await bundler.build();
  t.true(_getHandler.called);
  t.true(_runWebpack.called);
  t.true(_bundle.called);
  t.is(bundler.serverless.config.servicePath, 'outputDir/');
  t.is(bundler.originalPath, '/');
  await fs.access('outputDir/', FS_READ);

  await bundler.clean();
  t.is(bundler.serverless.config.servicePath, '/');
  t.true(_.isUndefined(bundler.originalPath));
  await fs.access('outputDir/', FS_READ);
  await fs.remove('outputDir/');
});

// TODO: Can't get sinon to find the class props so fix later
test.skip('Bundler.hooks#deploy should run build / clean', t => {
  t.pass();
});

// TODO: Per above... Sinon cant spy on the lodash#flow wrapped hooks
test.skip('Bundler.hooks#invoke should run build / clean', t => {
  t.pass();
});
