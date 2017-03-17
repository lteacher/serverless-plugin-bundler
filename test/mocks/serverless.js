import _ from 'lodash';

const serverless = {
  config: {
    servicePath: '/'
  }
}

const options = { random: 'unused' }

export const getMocks = (serverlessMixin, optionsMixin) => ([
  _.assign({}, serverless, serverlessMixin),
  _.assign({}, options, optionsMixin)
]);
