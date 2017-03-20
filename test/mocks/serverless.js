import _ from 'lodash';

const serverless = {
  config: {
    servicePath: '/'
  },
  service: {
    custom: {
      bundler: {},
      webpack: {}
    }
  }
}

const options = {
  functionObj: {
    handler: 'handler.hello'
  }
}

export const getMocks = () => ([
  _.cloneDeep(serverless),
  _.cloneDeep(options)
]);
