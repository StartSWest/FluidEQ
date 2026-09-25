/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import http from 'http';
import {
  createAgentServer,
  MAX_AGENT_BODY_BYTES,
} from '../../../main/studioAgent/agentServer';
import {
  createMcpHandler,
  type IMcpTool,
} from '../../../main/studioAgent/mcpProtocol';

/**
 * The Studio's agent door, over a real loopback socket: every check about who
 * is asking — the host, the origin, the key, the path, the method, the size —
 * and the protocol behind it. A refusal here is the door working; the one
 * request each check lets through is the control that proves the check is
 * not refusing everything.
 */

const KEY = 'k'.repeat(43);

const tool: IMcpTool = {
  name: 'look_at_scene',
  title: 'Look',
  description: 'Looks.',
  inputSchema: { type: 'object' },
  call: async (args) => ({
    content: [{ type: 'text', text: `looked ${JSON.stringify(args)}` }],
  }),
};

interface IReply {
  status: number;
  body: string;
}

let port = 0;
let server: ReturnType<typeof createAgentServer>;

beforeAll(async () => {
  server = createAgentServer({
    key: () => KEY,
    handle: createMcpHandler(
      {
        name: 'fluideq-studio',
        title: 'FluidEQ Studio',
        version: '1',
        instructions: 'Look.',
      },
      [tool],
    ),
  });
  port = await server.listen(0);
});

afterAll(() => server.close());

const request = (
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<IReply> =>
  new Promise((resolve, reject) => {
    const sent = http.request(
      {
        host: '127.0.0.1',
        port,
        method: options.method ?? 'POST',
        path: options.path ?? '/mcp',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEY}`,
          ...options.headers,
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body }),
        );
      },
    );
    sent.on('error', reject);
    if (options.body !== undefined) {
      sent.write(options.body);
    }
    sent.end();
  });

const rpc = (message: unknown, headers: Record<string, string> = {}) =>
  request({ body: JSON.stringify(message), headers });

const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };

test('the right key, host and body get an answer', async () => {
  const reply = await rpc(ping);
  expect(reply.status).toBe(200);
  expect(JSON.parse(reply.body)).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
  // Both spellings of this computer's own address.
  expect((await rpc(ping, { Host: `localhost:${port}` })).status).toBe(200);
});

test('a missing or wrong key is refused', async () => {
  expect((await rpc(ping, { Authorization: '' })).status).toBe(401);
  expect(
    (await rpc(ping, { Authorization: `Bearer ${'x'.repeat(43)}` })).status,
  ).toBe(401);
  // The key alone, without the scheme, is not a bearer token.
  expect((await rpc(ping, { Authorization: KEY })).status).toBe(401);
});

test('a web page is refused, whatever it sends', async () => {
  // Every request a page makes carries its origin; the assistants send none.
  expect((await rpc(ping, { Origin: 'https://example.com' })).status).toBe(403);
  expect((await rpc(ping, { Origin: 'null' })).status).toBe(403);
  // A name pointed at 127.0.0.1 by somebody else's DNS arrives with that name.
  expect((await rpc(ping, { Host: `evil.example:${port}` })).status).toBe(403);
  expect((await rpc(ping, { Host: `127.0.0.1:${port + 1}` })).status).toBe(403);
});

test('only a POST of JSON to the one path is read', async () => {
  expect((await request({ method: 'GET' })).status).toBe(405);
  expect((await request({ method: 'DELETE' })).status).toBe(405);
  expect((await rpc(ping, { 'Content-Type': 'text/plain' })).status).toBe(415);
  expect(
    (await request({ path: '/', body: JSON.stringify(ping) })).status,
  ).toBe(404);
  expect((await request({ body: '{nope' })).status).toBe(400);
});

test('a body past the limit is refused, declared or not', async () => {
  const big = JSON.stringify({
    ...ping,
    pad: 'x'.repeat(MAX_AGENT_BODY_BYTES),
  });
  expect((await request({ body: big })).status).toBe(413);
});

test('an unsupported protocol version header is refused', async () => {
  expect(
    (await rpc(ping, { 'MCP-Protocol-Version': '1999-01-01' })).status,
  ).toBe(400);
  expect(
    (await rpc(ping, { 'MCP-Protocol-Version': '2025-06-18' })).status,
  ).toBe(200);
});

test('the handshake offers tools and nothing else', async () => {
  const reply = JSON.parse(
    (
      await rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {} },
      })
    ).body,
  );
  expect(reply.result.protocolVersion).toBe('2025-06-18');
  expect(reply.result.capabilities).toEqual({ tools: { listChanged: false } });
  expect(reply.result.serverInfo.name).toBe('fluideq-studio');

  // A version it does not know is answered with the newest it does.
  const newest = JSON.parse(
    (
      await rpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: { protocolVersion: '1999-01-01' },
      })
    ).body,
  );
  expect(newest.result.protocolVersion).toBe('2025-11-25');

  const refused = await Promise.all(
    ['resources/list', 'prompts/list', 'sampling/createMessage'].map(
      async (method) =>
        JSON.parse((await rpc({ jsonrpc: '2.0', id: 3, method })).body).error
          .code,
    ),
  );
  expect(refused).toEqual([-32601, -32601, -32601]);
});

test('notifications are taken without an answer, batches are not taken', async () => {
  const note = await rpc({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
  expect(note.status).toBe(202);
  expect(note.body).toBe('');
  expect((await rpc([ping])).status).toBe(400);
});

test('tools are listed and called by name, and an unknown one is an error', async () => {
  const listed = JSON.parse(
    (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).body,
  );
  expect(
    listed.result.tools.map((entry: { name: string }) => entry.name),
  ).toEqual(['look_at_scene']);
  const called = JSON.parse(
    (
      await rpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'look_at_scene', arguments: { shape: 'tall' } },
      })
    ).body,
  );
  expect(called.result.content[0].text).toBe('looked {"shape":"tall"}');
  const unknown = JSON.parse(
    (
      await rpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'run_command', arguments: {} },
      })
    ).body,
  );
  expect(unknown.error.code).toBe(-32602);
});
