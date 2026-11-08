/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The Studio's chats go on across FluidEQ restarting for a change to its own
 * code (Ivan, 2026-11-07: "I hate the app auto restart when changing making
 * chats to stop on studio"): a real host process, a stand-in Claude Code
 * that answers in two halves, one FluidEQ that goes away mid-reply and
 * another that takes the reply up and hears the rest - and a real quit
 * that leaves nothing running.
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  IChatAdoption,
  IChatProcessEvents,
} from '../../../main/studioChat/chatProcess';
import { relayLauncher } from '../../../main/studioChat/chatRelayClient';
import { endProcessTreeById } from '../../../main/studioChat/endProcessTree';

/**
 * Claude Code as far as the chat reads it: a message is read back and
 * answered "part one"; the rest, "part two" and the turn's end, comes when
 * it is told to go on.
 */
const STAND_IN = `
let pending = '';
const say = (message) => process.stdout.write(JSON.stringify(message) + '\\n');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  pending += chunk;
  let at = pending.indexOf('\\n');
  while (at !== -1) {
    const line = pending.slice(0, at);
    pending = pending.slice(at + 1);
    at = pending.indexOf('\\n');
    const message = JSON.parse(line);
    if (message.type === 'user') {
      say({ type: 'user', isReplay: true, uuid: message.uuid, message: { content: 'hi' } });
      say({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'part one' } } });
    } else if (message.type === 'go') {
      say({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'part two' } } });
      say({ type: 'result', subtype: 'success', result: 'done' });
    }
  }
});
process.stdin.on('end', () => process.exit(0));
`;

const userLine = (uuid: string) =>
  `${JSON.stringify({ type: 'user', uuid, message: { role: 'user', content: 'hi' } })}\n`;

/** Events that record every line and say when one holding `text` arrives. */
const recorder = () => {
  const lines: string[] = [];
  const waiting: { text: string; resolve: () => void }[] = [];
  let resolveClosed: () => void = () => undefined;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const events: IChatProcessEvents = {
    line: (line) => {
      lines.push(line);
      waiting
        .filter(({ text }) => line.includes(text))
        .forEach(({ resolve }) => resolve());
    },
    errors: () => undefined,
    failed: () => resolveClosed(),
    closed: () => resolveClosed(),
  };
  const heard = (text: string) =>
    lines.some((line) => line.includes(text))
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          waiting.push({ text, resolve });
        });
  return { lines, events, heard, closed };
};

/**
 * Where the stand-ins run: never in the test's own folder, which Windows
 * will not remove while a process works in it - and a killed process lets
 * go of it a moment after the kill returns, which failed the clean-up.
 */
const AWAY = os.tmpdir();

const noRestarts = () =>
  new EventEmitter() as unknown as Pick<NodeJS.Process, 'prependListener'>;

it('a reply goes on across a restart, and a real quit ends everything', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-relay-'));
  const standIn = path.join(dir, 'claude.js');
  fs.writeFileSync(standIn, STAND_IN);
  try {
    // The FluidEQ before the restart: a message, and half a reply.
    const before = relayLauncher({ dir, hostProcess: noRestarts() });
    const first = recorder();
    const chat = before.start(
      'lake',
      { executable: process.execPath, args: [standIn], cwd: AWAY },
      first.events,
    );
    chat.write(userLine('u-1'));
    await first.heard('part one');
    expect(chat.position()).toBe(2);

    // The FluidEQ after it takes the chat up, with what was said so far.
    const after = relayLauncher({ dir, hostProcess: noRestarts() });
    const adopted: IChatAdoption[] = [];
    await after.takeUp((adoption) => adopted.push(adoption));
    expect(adopted.map(({ child }) => child.id)).toEqual(['lake']);
    const [taken] = adopted;
    const second = recorder();
    taken.attach(second.events);
    expect(second.lines.map((line) => line.includes('part one'))).toEqual([
      false,
      true,
    ]);
    expect(taken.process.position()).toBe(2);

    // The rest of the reply reaches the FluidEQ that is there now.
    taken.process.write(`${JSON.stringify({ type: 'go' })}\n`);
    await second.heard('"result"');
    expect(second.lines.some((line) => line.includes('part two'))).toBe(true);
    expect(first.lines.some((line) => line.includes('part two'))).toBe(false);

    // A real quit: the host and its Claude Code end, and the address goes.
    taken.process.write(userLine('u-2'));
    await second.heard('"u-2"');
    after.close();
    await second.closed;
    expect(fs.existsSync(path.join(dir, 'relay.json'))).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, 60000);

it('a host that dies takes its chats with it, and the next chat starts a new one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-relay-'));
  const standIn = path.join(dir, 'claude.js');
  fs.writeFileSync(standIn, STAND_IN);
  const launcher = relayLauncher({ dir, hostProcess: noRestarts() });
  try {
    const first = recorder();
    launcher
      .start(
        'lake',
        { executable: process.execPath, args: [standIn], cwd: AWAY },
        first.events,
      )
      .write(userLine('u-1'));
    await first.heard('part one');
    const { pid } = JSON.parse(
      fs.readFileSync(path.join(dir, 'relay.json'), 'utf8'),
    ) as { pid: number };
    endProcessTreeById(pid);
    await first.closed;

    const second = recorder();
    launcher
      .start(
        'city',
        { executable: process.execPath, args: [standIn], cwd: AWAY },
        second.events,
      )
      .write(userLine('u-2'));
    await second.heard('part one');
    const { pid: next } = JSON.parse(
      fs.readFileSync(path.join(dir, 'relay.json'), 'utf8'),
    ) as { pid: number };
    expect(next).not.toBe(pid);
    // Gone, with the stand-in under it, before its folder is.
    launcher.close();
    await second.closed;
  } finally {
    launcher.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, 60000);

it('a host that cannot start says so, and the chat fails instead of working for ever', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-relay-'));
  // A host whose TypeScript would not load: it calls back and says why.
  const boot = path.join(dir, 'boot.cjs');
  fs.writeFileSync(
    boot,
    [
      "const net = require('net');",
      'const { ready } = JSON.parse(process.env.FLUIDEQ_CHAT_RELAY);',
      "const line = net.connect(ready, () => line.end('failed it would not load\\n'));",
    ].join('\n'),
  );
  try {
    const launcher = relayLauncher({
      dir,
      hostEntry: boot,
      hostProcess: noRestarts(),
    });
    const chat = recorder();
    launcher.start(
      'lake',
      { executable: process.execPath, args: [], cwd: AWAY },
      chat.events,
    );
    await chat.closed;
    expect(chat.lines).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'relay.json'))).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, 60000);
