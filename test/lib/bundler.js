import _ from 'lodash';
import test from 'ava';
import {expect} from 'chai';
import Bundler from '../../lib/bundler';
import {serverless} from '../mocks';

const {getMocks} = serverless;

test('Bundler can be instantiated', t => {
  t.truthy(new Bundler() instanceof Bundler);
});

test('Bundler is initialized with expected values', t => {
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
