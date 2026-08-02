const { app } = require('electron');

app.setName('FluidEQ');
require('ts-node/register/transpile-only');
require('./src/main/main.ts');
