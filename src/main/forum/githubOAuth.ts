import crypto from 'crypto';
import http from 'http';
import type { AddressInfo } from 'net';
import ForumError from './forumError';

/**
 * Signing in to GitHub from a desktop app, the way GitHub recommends for one.
 *
 * The authorization-code flow with PKCE and a loopback redirect (RFC 8252):
 * the system browser shows GitHub's own page, where the password is typed —
 * never in this app — and GitHub sends the browser back to a one-shot server
 * on 127.0.0.1 with a code only this process can redeem, because only it holds
 * the verifier the challenge was made from.
 *
 * Not the device flow. GitHub's guidance is to prefer this one for native
 * apps — a device code has no redirect, so it can be phished — and the device
 * flow has no signal at all for "the person finished": it can only be polled,
 * and this project does not poll. Here the finish is an HTTP request arriving,
 * which is an event.
 *
 * Nothing waits on a clock. The server is open until the browser comes back,
 * the person cancels, or the app quits; a sign-in abandoned in a browser tab
 * costs one idle socket on the loopback interface until then.
 */

export interface IGithubTokens {
  accessToken: string;
  /** Epoch ms; 0 when the app issues tokens that do not expire. */
  accessExpiresAt: number;
  /** Empty when the app issues tokens that do not expire. */
  refreshToken: string;
  refreshExpiresAt: number;
}

export interface IGithubClient {
  clientId: string;
  clientSecret: string;
}

export interface ISignInPages {
  success: string;
  failure: string;
  cancelled: string;
}

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const CALLBACK_PATH = '/callback';

const base64url = (bytes: Buffer): string => bytes.toString('base64url');

export interface IPkce {
  verifier: string;
  challenge: string;
  state: string;
}

export const createPkce = (): IPkce => {
  const verifier = base64url(crypto.randomBytes(32));
  return {
    verifier,
    challenge: base64url(crypto.createHash('sha256').update(verifier).digest()),
    state: base64url(crypto.randomBytes(24)),
  };
};

export const buildAuthorizeUrl = (
  clientId: string,
  redirectUri: string,
  pkce: IPkce,
): string => {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', pkce.state);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * GitHub answers the token endpoint with 200 even when it refuses, and puts
 * the refusal in an `error` field — so the status alone says nothing.
 */
const readTokens = (payload: unknown, now: number): IGithubTokens => {
  if (!isRecord(payload)) {
    throw new ForumError('rejected', 'GitHub sent no token.');
  }
  if (typeof payload.error === 'string') {
    const denied =
      payload.error === 'bad_refresh_token' ||
      payload.error === 'bad_verification_code';
    throw new ForumError(
      denied ? 'signed_out' : 'rejected',
      `GitHub refused the token request: ${payload.error}`,
    );
  }
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new ForumError('rejected', 'GitHub sent no token.');
  }
  const seconds = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0
      ? now + value * 1_000
      : 0;
  return {
    accessToken: payload.access_token,
    accessExpiresAt: seconds(payload.expires_in),
    refreshToken:
      typeof payload.refresh_token === 'string' ? payload.refresh_token : '',
    refreshExpiresAt: seconds(payload.refresh_token_expires_in),
  };
};

const postToken = async (
  fetchImpl: typeof fetch,
  body: Record<string, string>,
): Promise<IGithubTokens> => {
  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ForumError('network', `GitHub could not be reached: ${error}`);
  }
  if (!response.ok) {
    throw new ForumError(
      response.status >= 500 ? 'network' : 'rejected',
      `GitHub's token endpoint answered ${response.status}.`,
    );
  }
  return readTokens(await response.json(), Date.now());
};

export const exchangeCode = (
  fetchImpl: typeof fetch,
  client: IGithubClient,
  code: string,
  redirectUri: string,
  verifier: string,
): Promise<IGithubTokens> =>
  postToken(fetchImpl, {
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

export const refreshTokens = (
  fetchImpl: typeof fetch,
  client: IGithubClient,
  refreshToken: string,
): Promise<IGithubTokens> =>
  postToken(fetchImpl, {
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

/**
 * Tells GitHub the token is finished with, so signing out here signs out
 * there too rather than leaving a working token in a file that was deleted.
 * Only this token: the person's authorization of the app stays, so signing in
 * again does not ask them to approve it a second time.
 */
export const revokeToken = async (
  fetchImpl: typeof fetch,
  client: IGithubClient,
  accessToken: string,
): Promise<void> => {
  const basic = Buffer.from(
    `${client.clientId}:${client.clientSecret}`,
  ).toString('base64');
  const response = await fetchImpl(
    `https://api.github.com/applications/${encodeURIComponent(client.clientId)}/token`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ access_token: accessToken }),
    },
  );
  // 404 is a token GitHub no longer has, which is what was wanted.
  if (!response.ok && response.status !== 404) {
    throw new Error(`GitHub answered ${response.status} to the revocation.`);
  }
};

export interface ICallbackServer {
  redirectUri: string;
  /** Settles when GitHub sends the browser back, or the sign-in is aborted. */
  code: Promise<string>;
  /** Answers the waiting browser tab and closes the server. */
  finish(page: string, status?: number): void;
}

/**
 * The one-shot server GitHub redirects to.
 *
 * Bound to 127.0.0.1 on a port the system picks, and GitHub accepts any port
 * on a loopback callback, so nothing about this collides with anything else
 * listening. Only `/callback` carrying this attempt's `state` is taken; a
 * request with another state is somebody else's page, or a stale tab, and is
 * refused without ending the wait.
 */
export const openCallbackServer = async (
  pkce: IPkce,
  pages: ISignInPages,
  signal: AbortSignal,
): Promise<ICallbackServer> => {
  let settle: { resolve(code: string): void; reject(error: Error): void } = {
    resolve: () => undefined,
    reject: () => undefined,
  };
  const code = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject };
  });
  // Every rejection path is also handled by whoever awaits `code`; this keeps
  // an abort that lands before anyone awaits from surfacing as unhandled.
  code.catch(() => undefined);

  // Every answer closes its connection. A browser keeps sockets alive for the
  // next request by default, and a kept-alive socket is what would hold this
  // server open after the one request it exists for.
  const answer = (response: http.ServerResponse, status: number, page = '') => {
    response
      .writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'close',
      })
      .end(page);
  };

  let pending: http.ServerResponse | undefined;
  let answered = false;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
      answer(response, 404);
      return;
    }
    if (url.searchParams.get('state') !== pkce.state || pending || answered) {
      answer(response, 400, pages.failure);
      return;
    }
    const error = url.searchParams.get('error');
    const received = url.searchParams.get('code');
    if (error || !received) {
      answered = true;
      answer(response, 200, pages.cancelled);
      settle.reject(
        new ForumError('cancelled', `GitHub returned ${error ?? 'no code'}.`),
      );
      return;
    }
    // Held open until the code is redeemed, so the page the person is looking
    // at says what actually happened rather than what was hoped.
    pending = response;
    settle.resolve(received);
  });

  const close = () => {
    server.close();
    server.closeIdleConnections();
  };

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  let detach = () => {};
  const finish = (page: string, status = 200) => {
    detach();
    if (pending) {
      answer(pending, status, page);
      pending = undefined;
    }
    answered = true;
    close();
  };

  // Cancelled from the app while the browser may still be waiting on us: the
  // tab is told so, rather than spinning on a server that has gone.
  const onAbort = () => {
    settle.reject(new ForumError('cancelled', 'Sign-in cancelled.'));
    finish(pages.cancelled);
  };
  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener('abort', onAbort, { once: true });
    detach = () => signal.removeEventListener('abort', onAbort);
  }

  const { port } = server.address() as AddressInfo;
  return {
    redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`,
    code,
    finish,
  };
};
