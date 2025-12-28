import { logger } from './server/Logger.js';

console.log('Testing logger...');
logger.log('TEST', 'TestAgent', { message: 'This is a test log entry' });
console.log('Done.');
