import chalk from 'chalk';

const _log = (title, message, color) => console.log(`${title}${chalk[color](message)}`);

export const logMessage = (message) => _log('Serverless Bundler: ', message, 'yellow');

export const logInfo = (message) => _log('Serverless Bundler:\n', message, 'green');

export const logError = (message) => _log('Serverless Bundler Error:\n', message, 'red');
