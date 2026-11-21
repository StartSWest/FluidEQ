/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { NEW_TOPIC_DRAFT, writeDraft } from './forumDrafts';

/**
 * A topic about one of the listener's presets, started from the preset's
 * Share (Ivan, 2026-11-20: "a share button so they share it on the
 * community … let's create one for presets").
 *
 * The board is the repository's own "Presets" category, created by hand on
 * GitHub like Tips & tricks. Until it exists a preset goes to Show and tell,
 * which is the board GitHub made for showing what somebody built.
 */
export const PRESETS_BOARD = 'presets';
const STAND_IN_BOARD = 'show-and-tell';

/** Asked of the window: the Forum's page, on the new topic (`App.tsx`). */
export const OPEN_FORUM_COMPOSE_EVENT = 'fluideq:open-forum-compose';

/** The preset a topic carries, as its share code (`presetShareCode.ts`). */
export interface ITopicPreset {
  name: string;
  code: string;
}

const CODE = /^FQP\d{1,3}\.[A-Za-z0-9_-]{8,4000}$/;

export const readTopicPreset = (value: unknown): ITopicPreset | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { name, code } = value as Record<string, unknown>;
  return typeof name === 'string' &&
    name.trim() !== '' &&
    typeof code === 'string' &&
    CODE.test(code)
    ? { name: name.trim(), code }
    : undefined;
};

/**
 * Where a topic picked for `picked` goes, among the boards this reader can
 * start one in: the Presets board, or its stand-in while it does not exist.
 * Anything else as `NewTopicForm` always chose it.
 */
export const boardForTopic = (
  picked: string | undefined,
  canStartIn: readonly string[],
): string | undefined => {
  if (
    picked === PRESETS_BOARD &&
    !canStartIn.includes(PRESETS_BOARD) &&
    canStartIn.includes(STAND_IN_BOARD)
  ) {
    return STAND_IN_BOARD;
  }
  return picked;
};

/**
 * The new topic as Share leaves it — the Presets board, the preset's name as
 * the title, the post's prompts and the preset attached — and the Forum
 * asked for. Written over any topic being started: a press on Share is a
 * choice to start this one, and `NewTopicForm` reads it again when it is
 * already open.
 */
export const startPresetTopic = (preset: ITopicPreset, body: string): void => {
  writeDraft(
    NEW_TOPIC_DRAFT,
    JSON.stringify({
      board: PRESETS_BOARD,
      title: preset.name,
      body,
      preset,
    }),
  );
  window.dispatchEvent(new Event(OPEN_FORUM_COMPOSE_EVENT));
};
