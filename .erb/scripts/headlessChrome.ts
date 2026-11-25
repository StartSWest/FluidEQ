/**
 * Evaluate one expression in the system's headless Chrome (or Edge) and hand
 * back its value: the SVG renderer behind `make-app-icons.ts`, so the icon
 * files are painted by the same engine the window paints with, with no
 * package to install.
 *
 * Driven over the DevTools protocol on a port Chrome picks for itself, and
 * the expression's own promise is what is waited on (`awaitPromise`): the
 * answer arrives when the drawing is done, never after a guessed time.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

interface IProtocolReply {
  id?: number;
  result?: unknown;
  error?: { message: string };
}

/** The browser's DevTools address, from the line it prints when it listens. */
const listeningAt = (stderr: NodeJS.ReadableStream): Promise<string> =>
  new Promise((resolve, reject) => {
    let seen = '';
    const onData = (chunk: Buffer) => {
      seen += chunk.toString('utf8');
      const match = seen.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        stderr.off('data', onData);
        resolve(match[1]);
      }
    };
    stderr.on('data', onData);
    stderr.once('end', () =>
      reject(new Error(`The browser exited before listening:\n${seen}`)),
    );
  });

/** Runs `expression` in a blank page and returns what its promise resolves to. */
export const evaluateInChrome = async <T>(expression: string): Promise<T> => {
  const browser = BROWSERS.find((candidate) => fs.existsSync(candidate));
  if (!browser) {
    throw new Error('No Chrome or Edge found to render with.');
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-icons-'));
  const child = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-device-scale-factor=1',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    // A browser that could not start emits this and never 'exit'.
    child.once('error', () => resolve());
  });
  let closing = false;
  try {
    const address = await listeningAt(child.stderr);
    const socket = new WebSocket(address);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error(address)), {
        once: true,
      });
    });
    let nextId = 0;
    const pending = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    socket.addEventListener('message', (event) => {
      const reply = JSON.parse(String(event.data)) as IProtocolReply;
      const waiting =
        reply.id === undefined ? undefined : pending.get(reply.id);
      if (!waiting || reply.id === undefined) {
        return;
      }
      pending.delete(reply.id);
      if (reply.error) {
        waiting.reject(new Error(reply.error.message));
      } else {
        waiting.resolve(reply.result);
      }
    });
    const send = (
      method: string,
      params: Record<string, unknown> = {},
      sessionId?: string,
    ) =>
      new Promise<unknown>((resolve, reject) => {
        nextId += 1;
        pending.set(nextId, { resolve, reject });
        socket.send(JSON.stringify({ id: nextId, method, params, sessionId }));
      });

    const { targetId } = (await send('Target.createTarget', {
      url: 'about:blank',
    })) as { targetId: string };
    const { sessionId } = (await send('Target.attachToTarget', {
      targetId,
      flatten: true,
    })) as { sessionId: string };
    const evaluated = (await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )) as {
      result: { value?: unknown };
      exceptionDetails?: { exception?: { description?: string }; text: string };
    };
    if (evaluated.exceptionDetails) {
      throw new Error(
        evaluated.exceptionDetails.exception?.description ??
          evaluated.exceptionDetails.text,
      );
    }
    // Not awaited: the browser closes the socket instead of answering, and
    // its process ending, awaited below, is the answer.
    socket.send(JSON.stringify({ id: nextId + 1, method: 'Browser.close' }));
    closing = true;
    return evaluated.result.value as T;
  } finally {
    if (!closing) {
      child.kill();
    }
    await exited;
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch (error) {
      process.stderr.write(
        `Could not remove the browser profile ${profile}: ${String(error)}\n`,
      );
    }
  }
};
