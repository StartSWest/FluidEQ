/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What FluidEQ and the process holding its chats across a restart say to
 * each other (`chatRelayHost.ts`, `chatRelayClient.ts`): one JSON object a
 * line, over a pipe only this account's FluidEQ knows the name and key of.
 */

/** A line a chat's Claude Code wrote, numbered from its start. */
export interface IRelayLine {
  seq: number;
  line: string;
}

/** A held Claude Code as the host hands it to a FluidEQ that comes back. */
export interface IRelayChild {
  id: string;
  pid?: number;
  /** Its lines since the turn FluidEQ last saw it finish began. */
  lines: IRelayLine[];
  /** The number its next line will have. */
  next: number;
  /** It ended, or could not start, while FluidEQ was away. */
  ended: boolean;
  failed: boolean;
}

export type TRelayRequest =
  | { type: 'hello'; token: string }
  | {
      type: 'start';
      id: string;
      executable: string;
      args: string[];
      cwd: string;
    }
  | { type: 'write'; id: string; text: string }
  | { type: 'end'; id: string };

export type TRelayReport =
  | { type: 'welcome'; children: IRelayChild[] }
  | { type: 'started'; id: string; pid: number }
  | ({ type: 'line'; id: string } & IRelayLine)
  | { type: 'errors'; id: string; chunk: string }
  | { type: 'failed'; id: string }
  | { type: 'closed'; id: string };

/**
 * What the host says on the line to the FluidEQ that started it once it
 * listens, with its process id; `failed` and the reason if it cannot.
 */
export const RELAY_READY = 'ready';
export const RELAY_FAILED = 'failed';

/** How the FluidEQ that starts the host tells it where and how to be. */
export interface IRelaySettings {
  /** The starter's own pipe, which the host calls first. */
  ready: string;
  /** The host's pipe. */
  pipe: string;
  token: string;
  /** Where it writes what nobody collected. */
  left: string;
}

/**
 * The one variable the settings travel in, as JSON; read and taken out by
 * `chatRelayBoot.cjs`, which names it too.
 */
export const RELAY_ENV = 'FLUIDEQ_CHAT_RELAY';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const parse = (line: string): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(line);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const relayLine = (message: TRelayRequest | TRelayReport) =>
  `${JSON.stringify(message)}\n`;

export const readRelayRequest = (line: string): TRelayRequest | undefined => {
  const message = parse(line);
  if (!message) {
    return undefined;
  }
  const { type, id } = message;
  if (type === 'hello') {
    return isText(message.token) ? { type, token: message.token } : undefined;
  }
  if (!isText(id) || id === '') {
    return undefined;
  }
  if (type === 'start') {
    const { executable, args, cwd } = message;
    return isText(executable) &&
      isText(cwd) &&
      Array.isArray(args) &&
      args.every(isText)
      ? { type, id, executable, args, cwd }
      : undefined;
  }
  if (type === 'write') {
    return isText(message.text) ? { type, id, text: message.text } : undefined;
  }
  return type === 'end' ? { type, id } : undefined;
};

const readLines = (value: unknown): IRelayLine[] | undefined =>
  Array.isArray(value) &&
  value.every(
    (entry) => isRecord(entry) && isCount(entry.seq) && isText(entry.line),
  )
    ? (value as IRelayLine[])
    : undefined;

export const readRelayChild = (value: unknown): IRelayChild | undefined => {
  if (!isRecord(value) || !isText(value.id) || !isCount(value.next)) {
    return undefined;
  }
  const lines = readLines(value.lines);
  if (!lines) {
    return undefined;
  }
  return {
    id: value.id,
    ...(isCount(value.pid) ? { pid: value.pid } : {}),
    lines,
    next: value.next,
    ended: value.ended === true,
    failed: value.failed === true,
  };
};

export const readRelayReport = (line: string): TRelayReport | undefined => {
  const message = parse(line);
  if (!message) {
    return undefined;
  }
  const { type, id } = message;
  if (type === 'welcome') {
    if (!Array.isArray(message.children)) {
      return undefined;
    }
    const children = message.children.flatMap(
      (child) => readRelayChild(child) ?? [],
    );
    return { type, children };
  }
  if (!isText(id)) {
    return undefined;
  }
  switch (type) {
    case 'started':
      return isCount(message.pid) ? { type, id, pid: message.pid } : undefined;
    case 'line':
      return isCount(message.seq) && isText(message.line)
        ? { type, id, seq: message.seq, line: message.line }
        : undefined;
    case 'errors':
      return isText(message.chunk)
        ? { type, id, chunk: message.chunk }
        : undefined;
    case 'failed':
    case 'closed':
      return { type, id };
    default:
      return undefined;
  }
};
