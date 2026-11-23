/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Thin companion CLI for FluidEQ's Tuning Agent Door (`tuning-agent.json`).
 *
 * Talks exclusively to the running FluidEQ main process over its local
 * 127.0.0.1 Streamable HTTP MCP endpoint so all safety guardrails, live
 * acoustic metering, A/B snapshots, and UI sync stay in one place.
 */

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

interface IDoorConfig {
  open: boolean;
  port: number;
  key: string;
}

interface IConnection {
  url: string;
  key: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const candidateConfigFiles = (): string[] => {
  const dirs: string[] = [];
  if (process.env.APPDATA) {
    dirs.push(
      path.join(process.env.APPDATA, 'FluidEQ'),
      path.join(process.env.APPDATA, 'fluideq-app'),
    );
  }
  const home = os.homedir();
  dirs.push(
    path.join(home, 'Library', 'Application Support', 'FluidEQ'),
    path.join(home, 'Library', 'Application Support', 'fluideq-app'),
    path.join(home, '.config', 'FluidEQ'),
    path.join(home, '.config', 'fluideq-app'),
  );
  return dirs.map((dir) => path.join(dir, 'tuning-agent.json'));
};

const readDoorFile = (filePath: string): IDoorConfig | undefined => {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (
      isRecord(raw) &&
      typeof raw.open === 'boolean' &&
      typeof raw.port === 'number' &&
      typeof raw.key === 'string'
    ) {
      return { open: raw.open, port: raw.port, key: raw.key };
    }
  } catch {
    // Missing or unreadable candidate file; try the next directory.
  }
  return undefined;
};

const discoverConnection = (
  urlFlag?: string,
  keyFlag?: string,
): IConnection => {
  const url = urlFlag ?? process.env.FLUIDEQ_TUNING_URL;
  const key = keyFlag ?? process.env.FLUIDEQ_TUNING_KEY;
  if (url && key) {
    return { url, key };
  }
  const files = candidateConfigFiles();
  for (let i = 0; i < files.length; i += 1) {
    const config = readDoorFile(files[i]);
    if (config && config.open) {
      return {
        url: url ?? `http://127.0.0.1:${config.port}/mcp`,
        key: key ?? config.key,
      };
    }
  }
  throw new Error(
    'Could not find an open FluidEQ Tuning MCP Door. Open FluidEQ -> Menu -> AI Tuning (MCP) and enable it, or pass --url and --key.',
  );
};

const sendRpc = (
  connection: IConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const target = new URL(connection.url);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = http.request(
      {
        hostname: target.hostname,
        port: Number(target.port) || 80,
        path: target.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${connection.key}`,
          'MCP-Protocol-Version': '2025-11-25',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`FluidEQ refused (${res.statusCode}): ${text}`));
            return;
          }
          try {
            const parsed: unknown = JSON.parse(text);
            if (!isRecord(parsed)) {
              reject(new Error('Unexpected non-object JSON-RPC response.'));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

const printToolResult = (reply: Record<string, unknown>): number => {
  if (isRecord(reply.error)) {
    process.stderr.write(`${String(reply.error.message ?? 'RPC error')}\n`);
    return 1;
  }
  const { result } = reply;
  if (isRecord(result) && Array.isArray(result.content)) {
    result.content.forEach((item) => {
      if (
        isRecord(item) &&
        item.type === 'text' &&
        typeof item.text === 'string'
      ) {
        process.stdout.write(`${item.text}\n`);
      }
    });
    return result.isError === true ? 1 : 0;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
};

const parseCliArgs = (argv: string[]) => {
  let urlFlag: string | undefined;
  let keyFlag: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--url' && argv[i + 1]) {
      urlFlag = argv[i + 1];
      i += 1;
    } else if (token === '--key' && argv[i + 1]) {
      keyFlag = argv[i + 1];
      i += 1;
    } else if (token !== '--') {
      positional.push(token);
    }
  }
  return { urlFlag, keyFlag, positional };
};

const HELP_TEXT = [
  'FluidEQ Audio Tuning CLI (connects to local Tuning MCP Door)',
  '',
  'Commands:',
  '  status                            Inspect engine, now-playing track, outputs, effective EQ curve, DSP, and session',
  '  measure [frames]                  Sample live 15-band ISO spectrum, reference deviation, LUFS, diagnostics, and delta',
  '  guide [goal] [stage]              Look up perceptual tuning recipes and exact DSP stage ranges',
  '  opra <query>                      Search built-in OPRA headphone correction curves',
  '  presets [kind] [query]            List presets (all|dsp|voicing|driver|mic|user)',
  '  ab [original|tuned]               Toggle or select A/B comparison side',
  '  revert                            Revert all AI tuning changes to baseline',
  '  snapshot                          Capture a fresh baseline snapshot',
  '  save-preset <name>                Save current DSP tuning as a user preset',
  '  tools                             List every MCP tool and schema',
  '  call <toolName> [jsonArgs]        Call any MCP tool directly with JSON arguments',
  '',
  'Global flags: --url <http://127.0.0.1:PORT/mcp> --key <token>',
].join('\n');

const main = async (): Promise<number> => {
  const { urlFlag, keyFlag, positional } = parseCliArgs(process.argv.slice(2));
  const [command, ...rest] = positional;

  if (
    !command ||
    command === 'help' ||
    command === '--help' ||
    command === '-h'
  ) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  const connection = discoverConnection(urlFlag, keyFlag);

  if (command === 'tools') {
    const reply = await sendRpc(connection, 'tools/list', {});
    return printToolResult(reply);
  }

  const callTool = (name: string, args: Record<string, unknown> = {}) =>
    sendRpc(connection, 'tools/call', { name, arguments: args }).then(
      printToolResult,
    );

  switch (command) {
    case 'status':
      return callTool('get_audio_context');
    case 'measure': {
      const framesArg = rest[0] === '--frames' ? rest[1] : rest[0];
      const frames = framesArg ? Number(framesArg) : undefined;
      return callTool(
        'measure_live_audio',
        frames && Number.isFinite(frames) ? { frames } : {},
      );
    }
    case 'guide': {
      const [goal, stage] = rest;
      return callTool('get_tuning_guide', {
        ...(goal ? { goal } : {}),
        ...(stage ? { stage } : {}),
      });
    }
    case 'opra':
      return callTool('search_headphone_correction', { query: rest.join(' ') });
    case 'presets': {
      const [kind, ...queryParts] = rest;
      return callTool('list_presets', {
        ...(kind ? { kind } : {}),
        ...(queryParts.length > 0 ? { query: queryParts.join(' ') } : {}),
      });
    }
    case 'ab':
      return callTool('tuning_session', {
        action: 'ab_compare',
        ...(rest[0] ? { mode: rest[0] } : {}),
      });
    case 'revert':
      return callTool('tuning_session', { action: 'revert' });
    case 'snapshot':
      return callTool('tuning_session', { action: 'snapshot' });
    case 'save-preset':
      return callTool('tuning_session', {
        action: 'save_preset',
        presetName: rest.join(' '),
      });
    case 'call': {
      const [toolName, ...jsonParts] = rest;
      if (!toolName) {
        process.stderr.write('Usage: call <toolName> [jsonArgs]\n');
        return 1;
      }
      const rawJson = jsonParts.join(' ').trim();
      let parsedArgs: Record<string, unknown> = {};
      if (rawJson) {
        const parsed: unknown = JSON.parse(rawJson);
        if (!isRecord(parsed)) {
          process.stderr.write('Tool arguments must be a JSON object.\n');
          return 1;
        }
        parsedArgs = parsed;
      }
      return callTool(toolName, parsedArgs);
    }
    default:
      process.stderr.write(
        `Unknown command "${command}". Run "help" for usage.\n`,
      );
      return 1;
  }
};

main()
  .then((code) => {
    process.exitCode = code;
    return undefined;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
