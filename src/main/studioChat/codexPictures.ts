/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { nativeImage, type NativeImage } from 'electron';
import type { TStudioChatCodex } from '../../common/studioChat';
import { keyOut, premultiply, type TKey } from './chromaKey';
import { startClaudeCode as startInstalled } from './claudeCode';
import endProcessTree from './endProcessTree';

/**
 * Pictures from ChatGPT, through the member's own Codex (Ivan, 2026-10-09:
 * "if they have gpt … connected gpt account codex … so it knows how to use
 * gpt to generate textures and images for the visualizers").
 *
 * The same terms as the chat's Claude Code: the member's Codex, unmodified
 * and as installed, signed in by the member with ChatGPT. FluidEQ never
 * reads, keeps or passes on that sign-in and pays for nothing; it asks
 * `login status` only whether it is ChatGPT, and an API-key sign-in is
 * treated as signed out, because the picture is meant to come out of the
 * member's plan. Each picture is one `codex exec` turn told to use its
 * built-in image tool once and nothing else, in an empty folder, read-only,
 * and runs only after the member said yes to it (`chatAsks.ts`).
 *
 * The approach and the prompt rules are gpt-studio's (Ivan's own plugin,
 * MIT), measured there on his subscription: the tool takes no size or
 * transparency, so the framing goes in the words, the picture is cropped to
 * size afterwards, and a subject is cut out of a flat key colour.
 */

export interface ICodexDeps {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
}

export const systemCodexDeps = (): ICodexDeps => ({
  platform: process.platform,
  env: process.env,
  home: os.homedir(),
});

const listDirs = (dir: string) => {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
};

const isFile = (target: string) => {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
};

/**
 * Every Codex this computer has: the desktop app's (which carries the newest,
 * one folder per update), the VS Code extension's, and the member's PATH.
 */
export const codexCandidates = ({ platform, env, home }: ICodexDeps) => {
  const windows = platform === 'win32';
  const found: string[] = [];
  if (windows) {
    const local = env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
    listDirs(path.join(local, 'OpenAI', 'Codex', 'bin')).forEach((dir) =>
      found.push(path.join(dir, 'codex.exe')),
    );
    listDirs(path.join(home, '.vscode', 'extensions'))
      .filter((dir) => /openai\.chatgpt-/.test(dir))
      .forEach((dir) =>
        found.push(path.join(dir, 'bin', 'windows-x86_64', 'codex.exe')),
      );
  } else if (platform === 'darwin') {
    found.push(
      '/Applications/Codex.app/Contents/Resources/codex',
      '/Applications/ChatGPT.app/Contents/Resources/codex',
    );
  }
  const names = windows ? ['codex.exe', 'codex.cmd'] : ['codex'];
  (env.PATH ?? env.Path ?? '')
    .split(windows ? ';' : ':')
    .filter(Boolean)
    .forEach((dir) =>
      names.forEach((name) => found.push(path.join(dir, name))),
    );
  const seen = new Set<string>();
  return found.filter((candidate) => {
    const key = windows ? candidate.toLowerCase() : candidate;
    if (seen.has(key) || !isFile(candidate)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

interface IOutput {
  code: number | null;
  stdout: string;
  stderr: string;
}

const outputOf = (child: ChildProcess) =>
  new Promise<IOutput>((resolve) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on('error', () => resolve({ code: null, stdout, stderr }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

/** "codex-cli 0.160.1" as [0, 160, 1]; undefined when it is not a version. */
export const codexVersion = (text: string) => {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : undefined;
};

const newer = (a: number[], b: number[]) => {
  const at = a.findIndex((part, index) => part !== b[index]);
  return at !== -1 && a[at] > b[at];
};

const run = (executable: string, args: string[]) =>
  outputOf(
    startInstalled(executable, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }),
  );

/** The newest Codex that answers to `--version`, or undefined. */
export const findCodex = async (deps: ICodexDeps = systemCodexDeps()) => {
  const answers = await Promise.all(
    codexCandidates(deps).map(async (candidate) => ({
      candidate,
      version: codexVersion((await run(candidate, ['--version'])).stdout),
    })),
  );
  return answers.reduce<{ candidate: string; version: number[] } | undefined>(
    (best, { candidate, version }) =>
      version && (!best || newer(version, best.version))
        ? { candidate, version }
        : best,
    undefined,
  )?.candidate;
};

/** What `codex login status` says, read for one thing: is it ChatGPT. */
export const readCodexLogin = (text: string): TStudioChatCodex =>
  /logged in using chatgpt/i.test(text) ? 'ready' : 'signed-out';

/** Whether ChatGPT pictures can be made here, and with which Codex. */
export const codexState = async (
  deps: ICodexDeps = systemCodexDeps(),
): Promise<{ state: TStudioChatCodex; executable?: string }> => {
  const executable = await findCodex(deps);
  if (!executable) {
    return { state: 'missing' };
  }
  const { stdout, stderr } = await run(executable, ['login', 'status']);
  return { state: readCodexLogin(`${stdout}\n${stderr}`), executable };
};

/**
 * Codex's own sign-in, in a console window of its own on Windows, so its
 * question to choose ChatGPT is in front of the member. Settles when it ends.
 */
export const signInToCodex = async (executable: string) => {
  const child =
    process.platform === 'win32'
      ? spawn(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', `"start "Codex" /wait "${executable}" login"`],
          { windowsVerbatimArguments: true, stdio: 'ignore' },
        )
      : startInstalled(executable, ['login'], { stdio: 'ignore' });
  await new Promise<void>((resolve) => {
    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
};

/** Flat colours a subject is drawn on, the first the prompt does not name. */
const KEYS: { name: string; rgb: TKey; named: RegExp }[] = [
  {
    name: 'pure green (#00FF00)',
    rgb: [0, 255, 0],
    named: /\b(green|lime|grass|leaf|leaves|mint|emerald|forest|moss)\b/i,
  },
  {
    name: 'pure magenta (#FF00FF)',
    rgb: [255, 0, 255],
    named: /\b(magenta|pink|fuchsia|purple|violet|lilac)\b/i,
  },
  {
    name: 'pure blue (#0000FF)',
    rgb: [0, 0, 255],
    named: /\b(blue|navy|cyan|sky|cobalt|ocean|sea|water)\b/i,
  },
];

export const keyFor = (prompt: string) =>
  KEYS.find((key) => !key.named.test(prompt)) ?? KEYS[0];

const RULES =
  'Rules: use your built-in image generation tool exactly once. Do not write code, do not create SVG or HTML, do not run shell commands, and do not create, copy or move any files. When the tool has returned the image, reply with the single word DONE.';

export interface IPictureRequest {
  prompt: string;
  width: number;
  height: number;
  transparent: boolean;
  /** A picture to edit rather than start from nothing (a PNG on disk). */
  reference?: string;
}

/** The words Codex is given: the request, its framing, its background. */
export const pictureInstructions = ({
  prompt,
  width,
  height,
  transparent,
  reference,
}: IPictureRequest) => {
  const key = keyFor(prompt);
  const shape =
    width === height
      ? 'square'
      : `${width > height ? 'landscape' : 'portrait'} ${width}:${height}`;
  return [
    reference
      ? 'Edit the attached image with your built-in image generation tool.'
      : 'Generate one image with your built-in image generation tool.',
    RULES,
    '',
    reference ? `Edit request: ${prompt}` : `Primary request: ${prompt}`,
    ...(reference
      ? [
          'Keep everything the request does not mention unchanged: composition, identity, colours and lighting, so the two images stay in register.',
        ]
      : []),
    `Framing: ${shape}, composed for a ${width}x${height} frame with the subject well inside the edges.`,
    ...(transparent
      ? [
          `Background: one perfectly flat, solid ${key.name} chroma-key colour for background removal: no shadows, gradients, texture, floor, reflections or lighting variation. Keep the subject fully separated from it with crisp edges and generous padding, and use no ${key.name} anywhere in the subject.`,
        ]
      : []),
    'Constraints: no watermark, no signature, and no text unless the request quotes exact text.',
  ].join('\n');
};

export type TPictureResult =
  | { ok: true; png: Buffer; keyedCorners?: number[] }
  | {
      ok: false;
      reason: 'stopped' | 'limit' | 'signed-out' | 'refused' | 'failed';
      /** What Codex said, for Claude to read; never shown to the member. */
      said?: string;
    };

const codexHome = (deps: ICodexDeps) =>
  deps.env.CODEX_HOME ?? path.join(deps.home, '.codex');

/** The newest image Codex saved for a thread, or undefined. */
const imageOf = (deps: ICodexDeps, thread: string) => {
  const dir = path.join(codexHome(deps), 'generated_images', thread);
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
      .map((name) => path.join(dir, name))
      .map((file) => ({ file, at: fs.statSync(file).mtimeMs }))
      .sort((a, b) => b.at - a.at)[0]?.file;
  } catch {
    return undefined;
  }
};

/** What one `codex exec --json` turn said, from its event lines. */
export const readCodexTurn = (stdout: string) =>
  stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce<{ thread?: string; errors: string[]; said: string[] }>(
      (turn, line) => {
        try {
          const event: unknown = JSON.parse(line);
          if (typeof event !== 'object' || event === null) {
            return turn;
          }
          const record = event as Record<string, unknown>;
          if (record.type === 'thread.started') {
            return typeof record.thread_id === 'string'
              ? { ...turn, thread: record.thread_id }
              : turn;
          }
          if (record.type === 'turn.failed' || record.type === 'error') {
            const error = record.error as Record<string, unknown> | undefined;
            const message =
              typeof record.message === 'string'
                ? record.message
                : error?.message;
            return typeof message === 'string'
              ? { ...turn, errors: [...turn.errors, message] }
              : turn;
          }
          const item = record.item as Record<string, unknown> | undefined;
          if (
            record.type === 'item.completed' &&
            item?.type === 'agent_message' &&
            typeof item.text === 'string'
          ) {
            return { ...turn, said: [...turn.said, item.text] };
          }
        } catch {
          // A line that is not an event: Codex's own noise on stdout.
        }
        return turn;
      },
      { errors: [], said: [] },
    );

/** Codex's failure as one of the reasons the chat tells Claude. */
export const failureOf = (
  message: string,
): 'limit' | 'signed-out' | 'failed' => {
  if (/usage limit|rate limit|quota|try again (at|in)/i.test(message)) {
    return 'limit';
  }
  if (/not logged in|unauthori[sz]ed|\b401\b|log ?in/i.test(message)) {
    return 'signed-out';
  }
  return 'failed';
};

/** Cropped to fill `width` × `height` from the middle, then scaled to it. */
const cover = (image: NativeImage, width: number, height: number) => {
  const size = image.getSize();
  const wanted = width / height;
  const crop =
    size.width / size.height > wanted
      ? {
          width: Math.round(size.height * wanted),
          height: size.height,
        }
      : { width: size.width, height: Math.round(size.width / wanted) };
  return image
    .crop({
      x: Math.floor((size.width - crop.width) / 2),
      y: Math.floor((size.height - crop.height) / 2),
      ...crop,
    })
    .resize({ width, height, quality: 'best' });
};

/**
 * One picture: Codex draws it, and it comes back as a PNG at exactly the
 * size asked, a subject cut out of its key colour. `signal` is the member's
 * Stop, and the only thing that ends a run early: a picture takes the
 * minute or so it takes, and no clock here guesses at that.
 */
export const makePicture = async (
  executable: string,
  request: IPictureRequest,
  signal: AbortSignal,
  deps: ICodexDeps = systemCodexDeps(),
): Promise<TPictureResult> => {
  if (signal.aborted) {
    return { ok: false, reason: 'stopped' };
  }
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-picture-'));
  try {
    const args = [
      'exec',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '-s',
      'read-only',
      '-c',
      'model_reasoning_effort=low',
      '-C',
      folder,
      '-',
      ...(request.reference ? ['-i', request.reference] : []),
    ];
    const child = startInstalled(executable, args, {
      cwd: folder,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stop = () => endProcessTree(child);
    signal.addEventListener('abort', stop, { once: true });
    child.stdin?.on('error', () => undefined);
    child.stdin?.end(pictureInstructions(request));
    const output = await outputOf(child);
    signal.removeEventListener('abort', stop);
    if (signal.aborted) {
      return { ok: false, reason: 'stopped' };
    }
    const turn = readCodexTurn(output.stdout);
    const file = turn.thread ? imageOf(deps, turn.thread) : undefined;
    if (!file) {
      const message = [...turn.errors, output.stderr.trim()].find(Boolean);
      if (message) {
        return { ok: false, reason: failureOf(message), said: message };
      }
      return {
        ok: false,
        reason: 'refused',
        said: turn.said.join(' ').slice(0, 600),
      };
    }
    const image = cover(
      nativeImage.createFromPath(file),
      request.width,
      request.height,
    );
    if (image.isEmpty()) {
      return {
        ok: false,
        reason: 'failed',
        said: 'The picture was unreadable.',
      };
    }
    if (!request.transparent) {
      return { ok: true, png: image.toPNG() };
    }
    // Electron's bitmaps are BGRA, so the key is too.
    const [red, green, blue] = keyFor(request.prompt).rgb;
    const pixels = new Uint8Array(image.toBitmap());
    const keyedCorners = keyOut(pixels, request.width, request.height, [
      blue,
      green,
      red,
    ]);
    premultiply(pixels);
    const keyed = nativeImage.createFromBitmap(Buffer.from(pixels), {
      width: request.width,
      height: request.height,
    });
    return { ok: true, png: keyed.toPNG(), keyedCorners };
  } finally {
    // FluidEQ's own empty folder; Codex wrote its picture under its home.
    fs.rmSync(folder, { recursive: true, force: true });
  }
};
