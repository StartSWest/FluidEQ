/**
 * Base webpack config used across other specific configs
 */

import webpack from 'webpack';
import webpackPaths from './webpack.paths';
import { dependencies as externals } from '../../release/app/package.json';

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              // Overridden here rather than in tsconfig.json, which has to
              // stay CommonJS because ts-node loads these very config files
              // with it.
              //
              // With `module: commonjs`, ts-loader turns every import in the
              // app into a `require()` call before webpack ever sees it, and
              // webpack cannot tree-shake a `require`. The whole renderer was
              // being bundled with nothing eliminated — d3 was only the most
              // visible case, dragging in geo, force, contour, delaunay,
              // hierarchy and the rest of the thirty submodules to use nine
              // symbols. Emitting ESM here leaves the import graph intact for
              // webpack to analyse.
              module: 'esnext',
            },
          },
        },
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2',
    },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
  ],
};

export default configuration;
