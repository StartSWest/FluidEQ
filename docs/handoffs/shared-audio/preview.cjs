/* FluidEQ — GPL-3.0-or-later. Builds only the browser design harness. */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'build');
const compiler = webpack({
  mode: 'development',
  target: 'web',
  devtool: false,
  context: root,
  entry: path.join(__dirname, 'preview.tsx'),
  output: { path: output, filename: 'preview.js', clean: true },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    modules: [path.join(root, 'src'), 'node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
              declaration: false,
              declarationMap: false,
            },
          },
        },
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.FLUIDEQ_VERSION': JSON.stringify(
        require('../../../release/app/package.json').version,
      ),
    }),
    new MiniCssExtractPlugin({ filename: 'preview.css' }),
    new HtmlWebpackPlugin({
      title: 'FluidEQ · Share Audio group preview',
      templateContent:
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FluidEQ · Share Audio group preview</title></head><body><div id="root"></div></body></html>',
    }),
  ],
  performance: false,
});

compiler.run((error, stats) => {
  if (error || !stats || stats.hasErrors()) {
    process.stderr.write(
      `${error || stats?.toString({ all: false, errors: true })}\n`,
    );
    process.exitCode = 1;
    compiler.close(() => undefined);
    return;
  }
  compiler.close(() => {
    process.stdout.write(
      'Design preview compiled. No Electron, capture or playback helpers are started.\n',
    );
    if (process.argv.includes('--build')) {
      return;
    }
    const server = http.createServer((request, response) => {
      const url = new URL(request.url || '/', 'http://localhost');
      const filename =
        url.pathname === '/' ? 'index.html' : path.basename(url.pathname);
      const target = path.join(output, filename);
      fs.readFile(target, (readError, bytes) => {
        if (readError) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
        };
        response.setHeader(
          'Content-Type',
          types[path.extname(target)] || 'application/octet-stream',
        );
        response.setHeader('Cache-Control', 'no-store');
        response.end(bytes);
      });
    });
    server.listen(4317, '127.0.0.1', () =>
      process.stdout.write('Preview: http://127.0.0.1:4317\n'),
    );
    server.on('error', (serverError) => {
      process.stderr.write(`${serverError.message}\n`);
      process.exitCode = 1;
    });
  });
});
