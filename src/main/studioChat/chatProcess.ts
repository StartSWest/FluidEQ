/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IRelayChild } from './chatRelayProtocol';
import { createLineReader } from './chatStream';
import { startClaudeCode } from './claudeCode';
import endProcessTree from './endProcessTree';

/**
 * A chat's Claude Code as the chat talks to it: lines in, lines out, and an
 * end. Started by FluidEQ itself (`directLauncher`), or held for it by a
 * process that outlives it (`chatRelayClient.ts`), which is how a chat goes
 * on working while FluidEQ restarts for a change to its own code.
 */

/** What a started Claude Code says, as it says it. */
export interface IChatProcessEvents {
  /** One line of its stream, whole, without its newline. */
  line(line: string): void;
  /** What it wrote to stderr, as it came. */
  errors(chunk: string): void;
  /** It could not be started. */
  failed(): void;
  /** It ended. */
  closed(): void;
}

export interface IChatProcess {
  /** Text into its input, newline-ended lines of its stream-json. */
  write(text: string): void;
  /** Ends it and everything it started. */
  end(): void;
  /**
   * How many lines it has handed over, counting the one being handed over
   * now: where a reply opened in its stream, so a restart can read it again
   * from there (`chatAdopt.ts`).
   */
  position(): number;
}

export interface IChatCommand {
  executable: string;
  args: string[];
  cwd: string;
}

/** A chat held across a restart, as the FluidEQ that follows takes it up. */
export interface IChatAdoption {
  child: IRelayChild;
  process: IChatProcess;
  /**
   * Its events from here on. What it said while FluidEQ was away is handed
   * over first, a line at a time with `position` at that line, then whether
   * it ended meanwhile, then what it says live.
   */
  attach(events: IChatProcessEvents): void;
}

export interface IChatLauncher {
  start(
    id: string,
    command: IChatCommand,
    events: IChatProcessEvents,
  ): IChatProcess;
  /**
   * Whether FluidEQ is closing only to start again at once: its chats are
   * then left running, to be taken up by the FluidEQ that follows.
   */
  restarting(): boolean;
  /**
   * The chats a FluidEQ before this one left running, each handed to
   * `adopt`; settled once all are.
   */
  takeUp(adopt: (adoption: IChatAdoption) => void): Promise<void>;
  /**
   * FluidEQ is really quitting: whatever holds its chats ends with it, and
   * every Claude Code under it (Ivan, 2026-11-07: "make sure that process
   * doesn't get loose when app closes ... real app closing not the dev
   * reloading").
   */
  close(): void;
}

/** Claude Code as FluidEQ's own child, ending when FluidEQ does. */
export const directLauncher = (): IChatLauncher => ({
  start: (_id, { executable, args, cwd }, events) => {
    const child = startClaudeCode(executable, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let lines = 0;
    const reader = createLineReader((line) => {
      lines += 1;
      events.line(line);
    });
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => reader.push(chunk));
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => events.errors(chunk));
    child.on('error', () => events.failed());
    child.on('close', () => events.closed());
    // A write to a process that has just ended is reported here, and its
    // close follows; the reply is finished there.
    child.stdin?.on('error', () => undefined);
    return {
      write: (text) => {
        child.stdin?.write(text);
      },
      end: () => endProcessTree(child),
      position: () => lines,
    };
  },
  restarting: () => false,
  takeUp: async () => undefined,
  close: () => undefined,
});
