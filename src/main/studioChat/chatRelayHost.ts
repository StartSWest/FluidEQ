/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { timingSafeEqual } from 'crypto';
import {
  readRelayRequest,
  relayLine,
  type IRelayChild,
  type IRelayLine,
  type TRelayReport,
} from './chatRelayProtocol';

/**
 * The Studio's chats held while FluidEQ restarts for a change to its own
 * code (Ivan, 2026-11-07: "I hate the app auto restart when changing making
 * chats to stop on studio"): each chat's Claude Code runs under this
 * process instead of FluidEQ's, so FluidEQ quitting closes nothing of it,
 * and the FluidEQ that starts next takes every chat up again where it is,
 * with what it said meanwhile.
 *
 * It keeps itself only as long as there is a reason to:
 * - With a FluidEQ connected, it relays and keeps each chat's lines since
 *   the turn FluidEQ last saw finish.
 * - With none, a Claude Code between turns is ended at once — the
 *   conversation is on disk and the next message carries it on — and one in
 *   the middle of a turn is let finish it and then ended.
 * - With none connected and nothing running, it writes down what nobody
 *   collected (`left`) and exits; the next FluidEQ reads that file instead.
 *
 * A turn waiting on the member's answer to a card waits until a FluidEQ
 * comes back to ask it again; nothing here answers for the member.
 */

/** A Claude Code the host started, as the host drives it. */
export interface IHeldProcess {
  pid?: number;
  write(text: string): void;
  /** Its input closed: Claude Code finishes what it is doing and exits. */
  closeInput(): void;
  /** Ended now, with everything it started. */
  end(): void;
}

export interface IRelayHostDeps {
  token: string;
  spawn(
    command: { executable: string; args: string[]; cwd: string },
    events: {
      line(line: string): void;
      errors(chunk: string): void;
      failed(): void;
      closed(): void;
    },
  ): IHeldProcess;
  /** What ended with no FluidEQ there to read it, for the next one. */
  writeLeft(children: IRelayChild[]): void;
  exit(): void;
}

interface IHeld {
  id: string;
  process: IHeldProcess;
  next: number;
  /** Lines since the turn FluidEQ last saw finish, a question's id beside it. */
  kept: (IRelayLine & { asks?: string })[];
  /** Questions FluidEQ answered, never asked again of a FluidEQ that returns. */
  answered: Set<string>;
  /** A turn's `result` went out; the next message FluidEQ writes starts afresh. */
  finished: boolean;
  /** FluidEQ wrote it a message: it has a turn, or is about to. */
  working: boolean;
  ended: boolean;
  failed: boolean;
}

export interface IRelayLink {
  receive(line: string): void;
  gone(): void;
}

const parsed = (line: string): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

/** The question a `control_request` line asks, by its id, when it is one. */
const questionOf = (line: string): string | undefined => {
  const message = parsed(line);
  return message?.type === 'control_request' &&
    typeof message.request_id === 'string'
    ? message.request_id
    : undefined;
};

const sameToken = (given: string, token: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const createRelayHost = ({
  token,
  spawn,
  writeLeft,
  exit,
}: IRelayHostDeps) => {
  const held = new Map<string, IHeld>();
  let client: ((report: TRelayReport) => void) | undefined;
  let exited = false;

  const tell = (report: TRelayReport) => client?.(report);

  /** Nothing to keep the host for: what was not collected is written down. */
  const settle = () => {
    if (client || exited || [...held.values()].some(({ ended }) => !ended)) {
      return;
    }
    exited = true;
    const left = [...held.values()].map(snapshot);
    if (left.length > 0) {
      writeLeft(left);
    }
    exit();
  };

  const snapshot = (one: IHeld): IRelayChild => ({
    id: one.id,
    ...(one.process.pid === undefined ? {} : { pid: one.process.pid }),
    lines: one.kept
      .filter(({ asks }) => asks === undefined || !one.answered.has(asks))
      .map(({ seq, line }) => ({ seq, line })),
    next: one.next,
    ended: one.ended,
    failed: one.failed,
  });

  /** A Claude Code with no FluidEQ to answer: let go once it has no turn. */
  const letGoIfIdle = (one: IHeld) => {
    if (!one.ended && (!one.working || one.finished)) {
      one.process.closeInput();
    }
  };

  const start = (
    id: string,
    command: { executable: string; args: string[]; cwd: string },
  ) => {
    held.get(id)?.process.end();
    // The process's events reach `one` only once it exists: a spawn reports
    // its failure on a later turn of the event loop, never from inside.
    const ended = (failed: boolean) => {
      if (one.ended) {
        return;
      }
      one.ended = true;
      one.failed = failed;
      // One a newer start under the same id replaced says nothing: the
      // chat ended it, and its id is the newer process's now.
      if (held.get(id) !== one) {
        return;
      }
      tell(failed ? { type: 'failed', id } : { type: 'closed', id });
      // A FluidEQ that saw it end needs nothing more of it.
      if (client) {
        held.delete(id);
      }
      settle();
    };
    const one: IHeld = {
      id,
      next: 0,
      kept: [],
      answered: new Set(),
      finished: false,
      working: false,
      ended: false,
      failed: false,
      process: spawn(command, {
        line: (line) => {
          const seq = one.next;
          one.next += 1;
          const asks = questionOf(line);
          one.kept.push(
            asks === undefined ? { seq, line } : { seq, line, asks },
          );
          if (parsed(line)?.type === 'result') {
            one.finished = true;
            if (!client) {
              letGoIfIdle(one);
            }
          }
          tell({ type: 'line', id, seq, line });
        },
        errors: (chunk) => tell({ type: 'errors', id, chunk }),
        failed: () => ended(true),
        closed: () => ended(false),
      }),
    };
    held.set(id, one);
    if (one.process.pid !== undefined) {
      tell({ type: 'started', id, pid: one.process.pid });
    }
  };

  /** FluidEQ's text into a Claude Code, read for what the host must know. */
  const write = (id: string, text: string) => {
    const one = held.get(id);
    if (!one || one.ended) {
      return;
    }
    text.split('\n').forEach((line) => {
      const message = line.trim() ? parsed(line) : undefined;
      if (message?.type === 'user') {
        // A message after a finished turn starts the next: the finished
        // one's lines were all seen, and FluidEQ will never ask for them.
        if (one.finished) {
          one.kept = [];
          one.finished = false;
        }
        one.working = true;
      }
      const response = message?.response;
      if (
        message?.type === 'control_response' &&
        typeof response === 'object' &&
        response !== null &&
        typeof (response as Record<string, unknown>).request_id === 'string'
      ) {
        one.answered.add(
          (response as Record<string, unknown>).request_id as string,
        );
      }
    });
    one.process.write(text);
  };

  return {
    /**
     * The FluidEQ that started the host is gone before it said the key (it
     * quit or crashed on the way): with nothing held, nothing keeps it.
     */
    starterGone: settle,

    /** A connection: it is a FluidEQ once it has said the key. */
    connect: (send: (text: string) => void, close: () => void): IRelayLink => {
      let mine = false;
      const report = (message: TRelayReport) => send(relayLine(message));
      return {
        receive: (line) => {
          const request = readRelayRequest(line);
          if (!mine) {
            if (request?.type !== 'hello' || !sameToken(request.token, token)) {
              close();
              return;
            }
            mine = true;
            client = report;
            const children = [...held.values()].map(snapshot);
            // Those that ended while it was away are its own now.
            held.forEach((one, id) => {
              if (one.ended) {
                held.delete(id);
              }
            });
            report({ type: 'welcome', children });
            return;
          }
          if (request?.type === 'start') {
            start(request.id, request);
          } else if (request?.type === 'write') {
            write(request.id, request.text);
          } else if (request?.type === 'end') {
            held.get(request.id)?.process.end();
          }
        },
        gone: () => {
          if (!mine || client !== report) {
            return;
          }
          client = undefined;
          held.forEach(letGoIfIdle);
          settle();
        },
      };
    },
  };
};
