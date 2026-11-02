/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import path from 'path';
import type { TTrayAction } from '../trayView';

/**
 * What main and FluidEQ-Tray say to each other: one JSON object a line, each
 * way, on `\\.\pipe\FluidEQ-Tray-<key>` (`native/tray-host`). Main sends the
 * state to show, and the quit recipe whenever its engine folder changes; the
 * tray says hello once a connection is made, and which item was pressed.
 */

/**
 * `resetEngineForQuit` as data, for a tray that has to do it after main has
 * gone (`engineQuitReset.ts`, `tray_model.h`).
 */
export interface ITrayQuitRecipe {
  configDir: string;
  rootName: string;
  rootText: string;
  removeNames: string[];
  /** Every per-output file whose name is one of these and an endpoint id. */
  removePrefixes: string[];
}

export interface ITrayHostMenuItem {
  id: TTrayAction;
  label: string;
  /** An .ico beside the label. */
  icon?: string;
  separatorAfter?: boolean;
}

export interface ITrayHostState {
  tooltip: string;
  /** The .ico in the notification area. */
  icon: string;
  menu: ITrayHostMenuItem[];
}

export type TTrayHostEvent =
  | { type: 'hello'; pid: number; ownerPipe: boolean }
  | { type: 'pressed'; id: TTrayAction };

const ACTIONS: readonly TTrayAction[] = [
  'open',
  'recover-window',
  'install-update',
  'check-updates',
  'quit',
];

const isAction = (value: unknown): value is TTrayAction =>
  typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);

export const stateLine = (state: ITrayHostState): string =>
  `${JSON.stringify({ type: 'state', ...state })}\n`;

/** None while this run has written no engine folder: a quit undoes nothing. */
export const recipeLine = (recipe: ITrayQuitRecipe | undefined): string =>
  `${JSON.stringify(recipe ? { type: 'recipe', recipe } : { type: 'recipe' })}\n`;

/** A line from the tray; undefined for anything that is not one of its words. */
export const readTrayHostLine = (line: string): TTrayHostEvent | undefined => {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const record = message as Record<string, unknown>;
  if (
    record.type === 'hello' &&
    typeof record.pid === 'number' &&
    Number.isInteger(record.pid) &&
    typeof record.ownerPipe === 'boolean'
  ) {
    return { type: 'hello', pid: record.pid, ownerPipe: record.ownerPipe };
  }
  if (record.type === 'pressed' && isAction(record.id)) {
    return { type: 'pressed', id: record.id };
  }
  return undefined;
};

/**
 * One tray per FluidEQ data folder: the installed app, `pnpm dev` and a
 * sandbox each keep their own, and two windows of one never start two.
 * Letters and digits only (`is_key` in `main.cpp`).
 */
export const trayHostKey = (userDataDir: string): string =>
  createHash('sha256')
    .update(path.resolve(userDataDir).toLowerCase())
    .digest('hex')
    .slice(0, 32);

export const trayHostPipe = (key: string): string =>
  `\\\\.\\pipe\\FluidEQ-Tray-${key}`;
