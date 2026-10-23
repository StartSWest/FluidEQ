/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import http from 'http';
import path from 'path';
import type { AddressInfo } from 'net';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.worklet': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

export interface IServer {
  url: string;
  close(): Promise<void>;
}

const closeServer = (server: http.Server) =>
  new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

/** The built harness over HTTP on a free local port, and nowhere else. */
export const serve = (root: string): Promise<IServer> =>
  new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const asked = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      );
      const file = path.join(root, asked === '/' ? 'index.html' : asked);
      if (!file.startsWith(root) || !fs.existsSync(file)) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
      fs.createReadStream(file).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () => closeServer(server),
      });
    });
  });
