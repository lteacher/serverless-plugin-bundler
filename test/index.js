import test from 'ava';
import Bundler from '../index';

test('bundler class is exported', t => {
  t.truthy(Bundler);
});
