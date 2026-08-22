/* eslint import/no-unresolved: off, import/no-self-import: off */

// The named export, not the default: the default is now an array of two
// compilers (renderer + DSP worklet) and ESLint wants one config.
module.exports = require('./webpack.config.renderer.dev').rendererDevConfig;
