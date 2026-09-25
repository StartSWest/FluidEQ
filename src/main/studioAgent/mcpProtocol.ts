/**
 * The Model Context Protocol, as much of it as the Studio's agent door needs:
 * the handshake, `ping`, and the two tools in `studioTools.ts`. Nothing else
 * is offered — no resources, no prompts, no sampling, no server-to-client
 * requests — so there is nothing else for a caller to reach.
 *
 * Transport-free on purpose. `agentServer.ts` carries the bytes and does every
 * check that is about who is asking; this is only about what was asked, and
 * takes an already-parsed body so it can be tested without a socket.
 *
 * Written by hand rather than with the SDK: the surface is four methods, and a
 * dependency here would be a dependency of the one part of the app that
 * listens to other programs.
 */

/** Newest first. The first is what a client asking for anything else gets. */
export const MCP_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

/**
 * What a request without the version header is taken to speak, as the
 * transport specification says a server should assume.
 */
export const MCP_ASSUMED_VERSION = '2025-03-26';

export const isSupportedMcpVersion = (version: string) =>
  (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(version);

/** JSON-RPC's own codes, the only ones this ever answers with. */
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

export type TMcpContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export interface IMcpToolResult {
  content: TMcpContent[];
  /**
   * The tool ran and did not get what was asked — a scene that does not
   * build, a folder that is not a Studio project. Told to the model as a
   * result, not a protocol error, so it can read it and correct itself.
   */
  isError?: boolean;
}

export interface IMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  call: (args: Record<string, unknown>) => Promise<IMcpToolResult>;
}

export interface IMcpServerInfo {
  name: string;
  title: string;
  version: string;
  /** Read by the client's model before anything else; how to use the tools. */
  instructions: string;
}

type TRpcId = string | number;

/** What the transport sends back: a status, and a body when there is one. */
export interface IMcpReply {
  status: 200 | 202 | 400;
  body?: Record<string, unknown>;
}

const rpcError = (
  id: TRpcId | null,
  code: number,
  message: string,
): Record<string, unknown> => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * JSON-RPC allows a string or a number; a fractional or enormous number is
 * still a number to it, and nothing here needs to be stricter than that.
 */
const isRpcId = (value: unknown): value is TRpcId =>
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value));

export const createMcpHandler = (
  server: IMcpServerInfo,
  tools: readonly IMcpTool[],
) => {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  const listed = tools.map(
    ({ name, title, description, inputSchema, annotations }) => ({
      name,
      title,
      description,
      inputSchema,
      ...(annotations ? { annotations } : {}),
    }),
  );

  const initialize = (params: Record<string, unknown>) => {
    const asked = params.protocolVersion;
    return {
      protocolVersion:
        typeof asked === 'string' && isSupportedMcpVersion(asked)
          ? asked
          : MCP_PROTOCOL_VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: server.name,
        title: server.title,
        version: server.version,
      },
      instructions: server.instructions,
    };
  };

  const callTool = async (
    id: TRpcId,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const tool = typeof params.name === 'string' && byName.get(params.name);
    if (!tool) {
      return rpcError(id, RPC_INVALID_PARAMS, 'There is no such tool.');
    }
    const args = params.arguments ?? {};
    if (!isRecord(args)) {
      return rpcError(id, RPC_INVALID_PARAMS, 'Arguments must be an object.');
    }
    try {
      return { jsonrpc: '2.0', id, result: await tool.call(args) };
    } catch (error) {
      // The member's own log keeps the detail; the caller learns only that
      // it failed, never a stack or a path out of the app.
      console.error(`The Studio tool ${tool.name} failed:`, error);
      return rpcError(id, RPC_INTERNAL_ERROR, 'FluidEQ could not do that.');
    }
  };

  const answer = async (
    id: TRpcId,
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    switch (method) {
      case 'initialize':
        return { jsonrpc: '2.0', id, result: initialize(params) };
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: listed } };
      case 'tools/call':
        return callTool(id, params);
      default:
        return rpcError(id, RPC_METHOD_NOT_FOUND, 'Not offered here.');
    }
  };

  /** One message, already parsed; what the transport should send back. */
  return async (message: unknown): Promise<IMcpReply> => {
    if (Array.isArray(message)) {
      // Batches left the protocol in 2025-06-18, and a batch is N calls for
      // the price of one request against a door that serves one at a time.
      return {
        status: 400,
        body: rpcError(null, RPC_INVALID_REQUEST, 'Batches are not accepted.'),
      };
    }
    if (!isRecord(message) || message.jsonrpc !== '2.0') {
      return {
        status: 400,
        body: rpcError(null, RPC_INVALID_REQUEST, 'Not a JSON-RPC message.'),
      };
    }
    const { id, method } = message;
    const params = message.params ?? {};
    if (typeof method !== 'string') {
      // A response to a request of ours. This server never asks anything,
      // so there is nothing for it to answer; it is accepted and dropped.
      return 'result' in message || 'error' in message
        ? { status: 202 }
        : {
            status: 400,
            body: rpcError(null, RPC_INVALID_REQUEST, 'No method.'),
          };
    }
    if (id === undefined) {
      // A notification — `notifications/initialized`, a cancellation. Every
      // call here finishes on its own, so none of them changes anything.
      return { status: 202 };
    }
    if (!isRpcId(id)) {
      return {
        status: 400,
        body: rpcError(null, RPC_INVALID_REQUEST, 'Bad id.'),
      };
    }
    if (!isRecord(params)) {
      return {
        status: 200,
        body: rpcError(id, RPC_INVALID_PARAMS, 'Params must be an object.'),
      };
    }
    return { status: 200, body: await answer(id, method, params) };
  };
};
