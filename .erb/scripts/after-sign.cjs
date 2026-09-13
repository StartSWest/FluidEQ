// electron-builder loads its hooks with a plain require, so the TypeScript
// hook is registered through ts-node here, the same way the webpack configs
// are.
require('ts-node/register/transpile-only');
module.exports = require('./after-sign.ts');
