import http from 'http';
import { createHash, timingSafeEqual } from 'crypto';
import {
  isSupportedMcpVersion,
  RPC_PARSE_ERROR,
  type IMcpReply,
} from './mcpProtocol';

/**
 * The Studio's agent door: an MCP endpoint over Streamable HTTP, on this
 * computer only, for the member's own AI assistant.
 *
 * Every check about WHO is asking lives here, in the order a request meets
 * them, and each refuses before any byte of the body is read:
 *
 * - Bound to 127.0.0.1 alone. Nothing on the network can connect, and there
 *   is no setting that changes that.
 * - `Host` must name that address or `localhost` at this port. A web page
 *   that points a name it controls at 127.0.0.1 (DNS rebinding) arrives with
 *   its own name here, and is refused.
 * - No `Origin` at all. Browsers send one with every request a page makes;
 *   the assistants this is for are programs and send none. The protocol's
 *   own specification requires a local server to refuse a foreign Origin,
 *   and here every Origin is foreign.
 * - `Authorization: Bearer <key>`, compared in constant time. The key is 256
 *   random bits the member copies into their assistant's own settings, so
 *   another account on the same computer, or any program that was not given
 *   it, is refused.
 * - POST of JSON to `/mcp` only, the body at most 64 KB, and at most two
 *   calls in flight: the tools answer small requests, and each capture is a
 *   GPU draw the member's own window pays for.
 *
 * The door is shut until the member opens it in the Studio, and shut again
 * the moment they close it (`studioAgentDoor.ts`).
 */

/** Far above any tool call; a body this size is not one. */
export const MAX_AGENT_BODY_BYTES = 64 * 1024;

/**
 * Two, not one: a client's `ping` must not wait behind a capture. More than
 * that is a loop, not an assistant looking at its work.
 */
export const MAX_AGENT_CALLS_IN_FLIGHT = 2;

export const AGENT_PATH = '/mcp';

export const AGENT_HOST = '127.0.0.1';

/** Constant-time on the digests, so the key's length is not given away either. */
const sameKey = (offered: string, key: string) =>
  timingSafeEqual(
    createHash('sha256').update(offered).digest(),
    createHash('sha256').update(key).digest(),
  );

const bearerOf = (header: string | undefined) => {
  const match = /^Bearer ([A-Za-z0-9_-]{16,256})$/.exec(header ?? '');
  return match ? match[1] : undefined;
};

const send = (
  response: http.ServerResponse,
  status: number,
  body?: Record<string, unknown>,
  extra: Record<string, string> = {},
) => {
  const text = body ? JSON.stringify(body) : '';
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    'Content-Length': String(Buffer.byteLength(text)),
    ...extra,
  });
  response.end(text);
};

/**
 * Refuses without reading the body, with no JSON-RPC id, as the transport
 * allows for any status. `Connection: close` has Node end the socket once the
 * answer is out, so whatever the caller is still sending is never read.
 */
const refuse = (
  response: http.ServerResponse,
  status: number,
  message?: string,
  extra: Record<string, string> = {},
) =>
  send(
    response,
    status,
    message
      ? { jsonrpc: '2.0', id: null, error: { code: -32000, message } }
      : undefined,
    { Connection: 'close', ...extra },
  );

/**
 * Whether the request's `Host` is this server's own address. Only the two
 * spellings a client configured with the address FluidEQ shows would send.
 */
export const isOwnHost = (host: string | undefined, port: number) =>
  host === `${AGENT_HOST}:${port}` || host === `localhost:${port}`;

export interface IAgentServerDeps {
  /** The member's key; read on every request, so a new one applies at once. */
  key: () => string;
  handle: (message: unknown) => Promise<IMcpReply>;
  logger?: { warn(message: string): void };
}

export const createAgentServer = ({
  key,
  handle,
  logger,
}: IAgentServerDeps) => {
  let inFlight = 0;

  const server = http.createServer((request, response) => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : -1;
    if (!isOwnHost(request.headers.host, port)) {
      refuse(response, 403, 'Wrong host.');
      return;
    }
    if (request.headers.origin !== undefined) {
      refuse(response, 403, 'Web pages may not use this.');
      return;
    }
    if ((request.url ?? '').split('?')[0] !== AGENT_PATH) {
      refuse(response, 404, 'Not here.');
      return;
    }
    const offered = bearerOf(request.headers.authorization);
    if (!offered || !sameKey(offered, key())) {
      refuse(response, 401, 'The Studio key is missing or wrong.', {
        'WWW-Authenticate': 'Bearer',
      });
      return;
    }
    if (request.method !== 'POST') {
      // No stream of our own to offer, and no sessions to end.
      refuse(response, 405, undefined, { Allow: 'POST' });
      return;
    }
    const version = request.headers['mcp-protocol-version'];
    if (typeof version === 'string' && !isSupportedMcpVersion(version)) {
      refuse(response, 400, 'Unsupported protocol version.');
      return;
    }
    if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) {
      refuse(response, 415, 'Send JSON.');
      return;
    }
    if (Number(request.headers['content-length'] ?? 0) > MAX_AGENT_BODY_BYTES) {
      refuse(response, 413, 'Too large.');
      return;
    }
    if (inFlight >= MAX_AGENT_CALLS_IN_FLIGHT) {
      refuse(response, 429, 'FluidEQ is still answering.');
      return;
    }

    inFlight += 1;
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        inFlight -= 1;
      }
    };
    // A client that hangs up has its call finish anyway — every tool ends on
    // its own — but it no longer counts against the next one.
    response.on('close', done);

    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      if (response.writableEnded) {
        return;
      }
      size += chunk.length;
      if (size > MAX_AGENT_BODY_BYTES) {
        // A body that lied about its length, or declared none.
        refuse(response, 413, 'Too large.');
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (response.writableEnded) {
        return;
      }
      let message: unknown;
      try {
        message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        send(response, 400, {
          jsonrpc: '2.0',
          id: null,
          error: { code: RPC_PARSE_ERROR, message: 'Not JSON.' },
        });
        return;
      }
      handle(message)
        .then((reply) => {
          if (!response.writableEnded && !response.destroyed) {
            send(response, reply.status, reply.body);
          }
          return undefined;
        })
        .catch((error: unknown) => {
          logger?.warn(`The Studio's agent door failed: ${String(error)}`);
          if (!response.writableEnded && !response.destroyed) {
            refuse(response, 500, 'FluidEQ could not answer.');
          }
        })
        .finally(done);
    });
  });
  // A handful of assistants at most; nothing here is built for a crowd.
  server.maxConnections = 8;

  return {
    /**
     * Listens on `port`, or on any free port when that one is taken or is
     * zero; resolves with the port it got.
     */
    listen: (port: number) =>
      new Promise<number>((resolve, reject) => {
        const listening = () => {
          const address = server.address();
          if (typeof address === 'object' && address) {
            resolve(address.port);
          } else {
            reject(new Error('The agent door has no port.'));
          }
        };
        const onError = (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE' && port !== 0) {
            server.once('error', reject);
            server.listen({ host: AGENT_HOST, port: 0 }, listening);
            return;
          }
          reject(error);
        };
        server.once('error', onError);
        server.listen({ host: AGENT_HOST, port }, () => {
          server.removeListener('error', onError);
          listening();
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Open keep-alive sockets would hold `close` until they time out.
        server.closeAllConnections();
      }),
  };
};
