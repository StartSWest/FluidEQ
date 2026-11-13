/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { createServer, type Server, type ServerResponse } from 'node:http';

/**
 * Where Google's answer comes back to: a server on this computer's loopback
 * address, on a port the system picks, for exactly one answer — the way RFC
 * 8252 asks a desktop app to take an OAuth redirect. No address outside this
 * computer can reach it, and it is gone the moment the answer has landed or
 * the sign-in is cancelled.
 *
 * Waits on the request itself, never on a clock: somebody choosing a Google
 * account takes as long as it takes, and Cancel in the panel is how the wait
 * ends without an answer (the `signal`).
 */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

export type TOAuthAnswer =
  { kind: 'code'; code: string } | { kind: 'error'; reason: string };

export interface IOAuthLoopback {
  /** Where the sign-in service is told to send the browser back to. */
  redirectTo: string;
  /** The one answer: a code to trade, or why there is none. */
  answer: Promise<TOAuthAnswer>;
}

/** The page the browser shows once the answer has landed, as finished HTML. */
export interface IOAuthPages {
  done: string;
  failed: string;
}

const respond = (
  response: ServerResponse,
  status: number,
  body: string,
  then?: () => void,
) => {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    // The address carries the code until this page replaces it: nothing on
    // the page may send it anywhere, and there is nothing on it to load.
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    Connection: 'close',
  });
  response.end(body, then);
};

export const startOAuthLoopback = (
  signal: AbortSignal,
  pages: IOAuthPages,
): Promise<IOAuthLoopback> => {
  let settle: (answer: TOAuthAnswer) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const answer = new Promise<TOAuthAnswer>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // Read only once the start has resolved; a failure before then is the
  // start's to report, and must not also surface as unhandled here.
  answer.catch(() => undefined);

  return new Promise((resolve, reject) => {
    let finished = false;
    const holder: { server?: Server } = {};

    const close = () => {
      holder.server?.close();
      holder.server?.closeAllConnections();
    };
    const onAbort = () => {
      finished = true;
      close();
      const error = new Error('Signing in with Google was cancelled.');
      error.name = 'AbortError';
      fail(error);
      reject(error);
    };
    const finish = () => {
      signal.removeEventListener('abort', onAbort);
      close();
    };

    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      // A browser asks for a favicon too, and anything else on this computer
      // can knock: only the one answer, once, at the one path counts.
      if (
        finished ||
        request.method !== 'GET' ||
        url.pathname !== OAUTH_CALLBACK_PATH
      ) {
        respond(response, 404, '');
        return;
      }
      const code = url.searchParams.get('code');
      const reason =
        url.searchParams.get('error_description') ??
        url.searchParams.get('error');
      if (!code && !reason) {
        respond(response, 400, '');
        return;
      }
      finished = true;
      // Closed once the page has gone out, so the browser gets all of it.
      respond(response, 200, code ? pages.done : pages.failed, finish);
      settle(
        code ? { kind: 'code', code } : { kind: 'error', reason: reason ?? '' },
      );
    });
    holder.server = server;

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort);
    server.on('error', (error) => {
      finished = true;
      finish();
      fail(error);
      reject(error);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        const error = new Error('The loopback server has no port.');
        finish();
        fail(error);
        reject(error);
        return;
      }
      resolve({
        redirectTo: `http://127.0.0.1:${address.port}${OAUTH_CALLBACK_PATH}`,
        answer,
      });
    });
  });
};
