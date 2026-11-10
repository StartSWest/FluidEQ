/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain } from 'electron';
import { ANIMATION_NAME } from '../../common/studioAnimation';
import { readArtworkSources } from '../memberScenes/artworkSources';
import {
  moveHistory,
  readHistory,
  readHistoryVersion,
  readPlay,
  recordSheet,
  renameAnimation,
  type IHistoryList,
  type THistoryOutcome,
  type TVersionId,
} from '../memberScenes/animationHistory';

/**
 * The Animations tab's hold on an animation's history
 * (`animationHistory.ts`): list it, undo, redo, go back to the original,
 * delete and bring back, record a sheet the member changed in the window
 * (rescaled, background taken out), and read one version's sheet. NO PATH
 * COMES FROM THE PAGE: the folder is the open project's and the animation
 * is a name.
 */

export type TAnimationHistoryRequest =
  | { action: 'list'; name: string }
  | {
      action:
        | 'undo'
        | 'redo'
        | 'restore-original'
        | 'delete'
        | 'undelete'
        | 'bring-back';
      name: string;
    }
  | { action: 'rename'; name: string; to: string }
  | {
      action: 'record';
      name: string;
      sheet: Uint8Array;
      count: number;
      columns: number;
      fps: number;
      loop: boolean;
      ground: string;
      label: string;
    }
  | { action: 'read'; name: string; id: TVersionId };

export type TAnimationHistoryOutcome =
  | { ok: true; history: IHistoryList | undefined }
  | {
      ok: true;
      sheet: Uint8Array;
      play: {
        count: number;
        columns: number;
        fps: number;
        loop: boolean;
        ground: string;
      };
      files: string[];
    }
  | {
      ok: false;
      reason: 'closed' | 'invalid' | 'taken' | 'missing' | 'failed';
      detail?: string;
    };

const MOVES = {
  undo: 'undo',
  redo: 'redo',
  'restore-original': 'original',
  delete: 'delete',
  undelete: 'bring-back',
  'bring-back': 'bring-back',
} as const;

/** A history call's answer as the page reads it. */
const answered = (
  outcome: THistoryOutcome<IHistoryList | undefined>,
): TAnimationHistoryOutcome =>
  outcome.ok
    ? { ok: true, history: outcome.value }
    : { ok: false, reason: outcome.code, detail: outcome.reason };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isVersionId = (value: unknown): value is TVersionId =>
  value === 'original' ||
  (typeof value === 'number' && Number.isInteger(value) && value >= 1);

/** One request from the page, answered for the open project. */
export const answerHistory = async (
  folder: string,
  raw: unknown,
): Promise<TAnimationHistoryOutcome> => {
  if (
    !isRecord(raw) ||
    typeof raw.name !== 'string' ||
    !ANIMATION_NAME.test(raw.name)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const { name, action } = raw;
  if (action === 'list') {
    return { ok: true, history: readHistory(folder, name) };
  }
  if (action === 'read') {
    if (!isVersionId(raw.id)) {
      return { ok: false, reason: 'invalid' };
    }
    const version = readHistoryVersion(folder, name, raw.id);
    return version
      ? {
          ok: true,
          sheet: new Uint8Array(version.png),
          play: version.play,
          files: version.files,
        }
      : { ok: false, reason: 'failed' };
  }
  if (action === 'record') {
    const play = readPlay(raw);
    if (!(raw.sheet instanceof Uint8Array) || !play) {
      return { ok: false, reason: 'invalid' };
    }
    return answered(
      await recordSheet(folder, name, raw.sheet, play, {
        label: typeof raw.label === 'string' ? raw.label : 'Change',
      }),
    );
  }
  if (action === 'rename') {
    return typeof raw.to === 'string' && ANIMATION_NAME.test(raw.to)
      ? answered(await renameAnimation(folder, name, raw.to))
      : { ok: false, reason: 'invalid' };
  }
  if (
    typeof action === 'string' &&
    Object.prototype.hasOwnProperty.call(MOVES, action)
  ) {
    return answered(
      await moveHistory(folder, name, MOVES[action as keyof typeof MOVES]),
    );
  }
  return { ok: false, reason: 'invalid' };
};

/** Registers the handler; the returned function takes it away. */
export const registerStudioAnimationHistory = ({
  mayEdit,
  activeFolder,
}: {
  mayEdit: () => boolean;
  activeFolder: () => string | undefined;
}): (() => void) => {
  ipcMain.handle(
    'studio-animation-history',
    async (_event, raw: unknown): Promise<TAnimationHistoryOutcome> => {
      const folder = activeFolder();
      // Reading is for a project the member may look at; every change for
      // one they may edit, which is the same rule here: the open project.
      if (!folder || !mayEdit()) {
        return { ok: false, reason: 'closed' };
      }
      return answerHistory(folder, raw);
    },
  );
  // Which picture each artwork region was packed from (`artworkSources.ts`):
  // how the Animations tab tells an animation the scene plays from one it
  // does not. The open project's, asked with nothing.
  ipcMain.handle('studio-artwork-sources', (): TArtworkSourcesOutcome => {
    const folder = activeFolder();
    return folder && mayEdit()
      ? { ok: true, sources: readArtworkSources(folder) }
      : { ok: false, reason: 'closed' };
  });
  return () => {
    ipcMain.removeHandler('studio-animation-history');
    ipcMain.removeHandler('studio-artwork-sources');
  };
};

/** Region id → `art/<name>.png`, for the regions the record knows. */
export type TArtworkSourcesOutcome =
  | { ok: true; sources: Record<string, string> }
  | { ok: false; reason: 'closed' };
