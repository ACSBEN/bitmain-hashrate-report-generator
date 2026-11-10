'use strict';

const { createApp } = require('./src/app');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;

createApp().listen(PORT, HOST, () => {
  console.log(`Report manager running at http://${HOST}:${PORT}`);
});
