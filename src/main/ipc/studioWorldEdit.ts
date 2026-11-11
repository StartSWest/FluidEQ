import { ipcMain } from 'electron';
import type { TWorldEditOp, TWorldEditOutcome } from '../../common/sceneEdit';
import { editProjectWorld } from '../memberScenes/worldEdits';

/**
 * The Studio's Edit mode, as the renderer reaches the open project's world:
 * a hand's edits written into it, a step back or forward over them, and
 * whether there is one to take (`memberScenes/worldEdits.ts`).
 *
 * Always the project on the bench, and only one that may be edited; the
 * page names no folder and no file.
 */

const CHANNELS = ['studio-world-edit'] as const;

export interface IStudioWorldEditDeps {
  mayEdit: () => boolean;
  activeFolder: () => string | undefined;
}

const CLOSED: TWorldEditOutcome = { ok: false, reason: 'closed' };

/** One save is every change since the last: a long sitting's worth. */
const MAX_EDITS = 4096;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPath = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 16 &&
  value.every((step) => Number.isInteger(step) && step >= 0 && step < 4096);

const isTriple = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(
    (part) =>
      typeof part === 'number' && Number.isFinite(part) && Math.abs(part) < 1e6,
  );

const optionalTriple = (value: unknown) =>
  value === undefined || isTriple(value);

/** One edit as the page sent it, or undefined for anything else. */
const readOp = (raw: unknown): TWorldEditOp | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  const { kind, path } = raw;
  const name = typeof raw.name === 'string' ? raw.name.slice(0, 64) : '';
  switch (kind) {
    case 'move':
      return isPath(path) &&
        optionalTriple(raw.position) &&
        optionalTriple(raw.rotation) &&
        optionalTriple(raw.scale)
        ? {
            kind,
            path,
            ...(isTriple(raw.position) ? { position: raw.position } : {}),
            ...(isTriple(raw.rotation) ? { rotation: raw.rotation } : {}),
            ...(isTriple(raw.scale) ? { scale: raw.scale } : {}),
          }
        : undefined;
    case 'pin':
      return isPath(path) &&
        isTriple(raw.values) &&
        (raw.field === 'position' ||
          raw.field === 'rotation' ||
          raw.field === 'scale')
        ? { kind, path, field: raw.field, values: raw.values }
        : undefined;
    case 'rename':
      return isPath(path) ? { kind, path, name } : undefined;
    case 'show':
      return isPath(path) && typeof raw.shown === 'boolean'
        ? { kind, path, shown: raw.shown }
        : undefined;
    case 'shadow':
      return isPath(path) && typeof raw.cast === 'boolean'
        ? { kind, path, cast: raw.cast }
        : undefined;
    case 'delete':
    case 'copy':
      return isPath(path) ? { kind, path } : undefined;
    case 'group':
      return Array.isArray(raw.paths) &&
        raw.paths.length > 0 &&
        raw.paths.length <= 512 &&
        raw.paths.every(isPath)
        ? { kind, paths: raw.paths, name }
        : undefined;
    case 'add':
      return isTriple(raw.at) &&
        (raw.shape === 'box' ||
          raw.shape === 'ball' ||
          raw.shape === 'light' ||
          raw.shape === 'group')
        ? { kind, shape: raw.shape, name, at: raw.at }
        : undefined;
    case 'camera':
      return isTriple(raw.position) && isTriple(raw.target)
        ? { kind, position: raw.position, target: raw.target }
        : undefined;
    default:
      return undefined;
  }
};

/** Registers the handlers; the returned function takes them away. */
export const registerStudioWorldEdit = ({
  mayEdit,
  activeFolder,
}: IStudioWorldEditDeps): (() => void) => {
  const folderNow = () => (mayEdit() ? activeFolder() : undefined);
  ipcMain.handle(
    'studio-world-edit',
    async (_event, raw: unknown): Promise<TWorldEditOutcome> => {
      const folder = folderNow();
      if (!folder) {
        return CLOSED;
      }
      const list = Array.isArray(raw) ? raw.slice(0, MAX_EDITS + 1) : [];
      const ops = list.map(readOp);
      if (
        ops.length === 0 ||
        ops.length > MAX_EDITS ||
        ops.some((op) => op === undefined)
      ) {
        return { ok: false, reason: 'failed' };
      }
      return editProjectWorld(folder, ops as TWorldEditOp[]);
    },
  );
  return () => CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
};
