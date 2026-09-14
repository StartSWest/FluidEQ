import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { PRODUCT_VERSION } from '../common/branding';
import { MAX_SHADER_BYTES } from '../common/scenePacks';
import writeFileAtomically from './atomicWrite';

/**
 * Scene code this computer will not run again, whichever scene carries it.
 *
 * The looks' own quarantines name a scene by its look id, which covers a scene
 * once it is installed and nothing else: the gallery's preview of the same
 * scene plays it under another identity, and so do the lamps and the worker
 * that draws its picture. A scene that reset the graphics driver from the
 * graph was played again by the next page that opened it — and five driver
 * resets in a minute is a Windows bugcheck, which is the one outcome a
 * visualizer must never be able to cause. So a refusal is also kept by what
 * actually ran: the SHA-256 of the shader source.
 *
 * The source, not a hash handed over by the window, is what the report
 * carries (`scene-source-refused`): the key is computed here, the same way the
 * gallery's preview computes it for a file it has just downloaded, so the two
 * cannot disagree about which scene is meant.
 *
 * HOW LONG A REFUSAL LASTS depends on why:
 * - `gpu-reset` — the context was lost right after one of the scene's own
 *   frames held the GPU (`BLAMED_FRAME_MS`), so the reset was the scene's —
 *   is about what it asks of this GPU, which no app update changes. Kept
 *   across builds. A scene fixed by its maker is different source, and so a
 *   different key.
 * - `context-lost` with nothing to blame is honoured only under the build
 *   that wrote it. Sleep, a driver update and another program's crash lose
 *   every context on the machine too, and whichever scene was on screen then
 *   must not be hidden for good.
 * - `compile` likewise: the program around a scene is the app's, and the
 *   next build's may compile it.
 * - `too-heavy` — a frame that would take the GPU far past Windows' two
 *   second limit — likewise. It is a timing, and a timing taken while
 *   something else held the GPU can be wrong; one that was heals at the next
 *   update instead of hiding a scene for good.
 *
 * Bounded, oldest first out, because the window can report as many sources as
 * it likes and this file is read at every launch.
 */

export type TSceneRefusal =
  'compile' | 'context-lost' | 'gpu-reset' | 'too-heavy';

export interface ISceneRefusals {
  /** Remembers that `source` would not run here; false if it was known. */
  refuse(source: string, reason: TSceneRefusal): boolean;
  /** Why `source` will not be run here, if it will not. */
  refusalOf(source: string): TSceneRefusal | undefined;
}

export interface ISceneRefusalsOptions {
  userDataDir: string;
  logger?: { warn(message: string): void };
  /** The build every refusal but `gpu-reset` is kept for. Defaults to this. */
  appVersion?: string;
}

const FILE = 'scene-refusals.json';

/** Far more scenes than anybody has broken; a few kilobytes at most. */
export const MAX_SCENE_REFUSALS = 256;

const REASONS: readonly TSceneRefusal[] = [
  'compile',
  'context-lost',
  'gpu-reset',
  'too-heavy',
];

export const isSceneRefusal = (value: unknown): value is TSceneRefusal =>
  REASONS.includes(value as TSceneRefusal);

/** A report's source, if it is one a scene could have carried. */
export const readRefusedSource = (value: unknown): string | undefined =>
  typeof value === 'string' &&
  value.length > 0 &&
  Buffer.byteLength(value, 'utf8') <= MAX_SHADER_BYTES
    ? value
    : undefined;

const keyOf = (source: string) =>
  createHash('sha256').update(source, 'utf8').digest('hex');

const readEntries = (file: string): [string, string][] => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return [];
    }
    return Object.entries(parsed)
      .filter(
        (entry): entry is [string, string] =>
          /^[0-9a-f]{64}$/.test(entry[0]) && typeof entry[1] === 'string',
      )
      .slice(-MAX_SCENE_REFUSALS);
  } catch {
    return [];
  }
};

export const createSceneRefusals = ({
  userDataDir,
  logger,
  appVersion = PRODUCT_VERSION,
}: ISceneRefusalsOptions): ISceneRefusals => {
  const file = path.join(userDataDir, FILE);
  // Insertion order is age: a refusal made again moves to the end.
  const entries = new Map(readEntries(file));

  const reasonOf = (key: string): TSceneRefusal | undefined => {
    const entry = entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    const at = entry.lastIndexOf('@');
    const reason = at < 0 ? entry : entry.slice(0, at);
    if (!isSceneRefusal(reason)) {
      return undefined;
    }
    return reason === 'gpu-reset' ||
      (at >= 0 && entry.slice(at + 1) === appVersion)
      ? reason
      : undefined;
  };

  return {
    refuse: (source, reason) => {
      const key = keyOf(source);
      const known = reasonOf(key);
      // Nothing shortens a refusal that outlives builds.
      if (known === reason || known === 'gpu-reset') {
        return false;
      }
      entries.delete(key);
      entries.set(key, `${reason}@${appVersion}`);
      while (entries.size > MAX_SCENE_REFUSALS) {
        const [oldest] = entries.keys();
        entries.delete(oldest);
      }
      try {
        writeFileAtomically(file, JSON.stringify(Object.fromEntries(entries)));
      } catch (error) {
        // Still refused for this session; only the next launch forgets.
        logger?.warn(`Could not keep a scene refusal: ${String(error)}`);
      }
      logger?.warn(`Scene source ${key.slice(0, 12)} refused: ${reason}.`);
      return true;
    },
    refusalOf: (source) => reasonOf(keyOf(source)),
  };
};
