
export default class Bundler {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    console.log('Just constructed the awesome bundler plugin');
  }
}
