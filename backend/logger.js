const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  // En producción (Railway) emite JSON por stdout — recogido por el log aggregator
  // En desarrollo, si se instala pino-pretty, se puede usar: LOG_PRETTY=1
  ...(process.env.LOG_PRETTY === '1' && {
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
  }),
});
