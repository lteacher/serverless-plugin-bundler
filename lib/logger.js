import chalk from 'chalk';

const log = (title, message, color) => {
  console.log(`${title}${chalk[color](message)}`);
}

export const logMessage = (message) => log('Serverless Bundler: ', message, 'yellow');

export const logInfo = (message) => log('Serverless Bundler:\n', message, 'green');

export const logError = (message) => log('Serverless Bundler Error:\n', message, 'red');
