/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { IStudioChatStep, TStudioChatEntry } from 'common/studioChat';

/** Each step as the chat says it: done, and while it is happening. */
export const STEP_WORDS: Record<
  IStudioChatStep['kind'],
  { done: TranslationKey; now: TranslationKey }
> = {
  look: { done: 'studioChat.step.look', now: 'studioChat.step.lookNow' },
  hear: { done: 'studioChat.step.hear', now: 'studioChat.step.hearNow' },
  read: { done: 'studioChat.step.read', now: 'studioChat.step.readNow' },
  write: { done: 'studioChat.step.write', now: 'studioChat.step.writeNow' },
  search: { done: 'studioChat.step.search', now: 'studioChat.step.searchNow' },
  picture: {
    done: 'studioChat.step.picture',
    now: 'studioChat.step.pictureNow',
  },
  pack: { done: 'studioChat.step.pack', now: 'studioChat.step.packNow' },
  compact: {
    done: 'studioChat.step.compact',
    now: 'studioChat.step.compactNow',
  },
  other: { done: 'studioChat.step.other', now: 'studioChat.step.otherNow' },
};

type TTranslate = (
  key: TranslationKey,
  vars?: Record<string, string>,
) => string;

/** A step in words, as its line in the reply says it. */
export const stepLabel = (t: TTranslate, step: IStudioChatStep) => {
  const words = STEP_WORDS[step.kind];
  return t(step.state === 'running' ? words.now : words.done, {
    file: step.file ?? t('studioChat.step.theScene'),
  });
};

/** One picture in the conversation, as the viewer shows it. */
export interface IChatPicture {
  key: string;
  src: string;
  name: string;
  /** Made by ChatGPT on transparency: shown on the checks. */
  cutOut: boolean;
}

/** A picture's key: its message, or its reply and step. */
export const pictureKey = (entryId: string, stepId?: string) =>
  stepId === undefined ? entryId : `${entryId}/${stepId}`;

/**
 * Every picture in the conversation, in the order they appear: the stage as
 * the member attached it, each look Claude took, each picture ChatGPT made.
 * The viewer steps through them all.
 */
export const chatPicturesOf = (
  entries: readonly TStudioChatEntry[],
  t: TTranslate,
): IChatPicture[] =>
  entries.flatMap((entry): IChatPicture[] => {
    if (entry.kind === 'me') {
      return entry.picture
        ? [
            {
              key: pictureKey(entry.id),
              src: entry.picture,
              name: t('studioChat.attachedNote'),
              cutOut: false,
            },
          ]
        : [];
    }
    return entry.steps.flatMap((step) =>
      step.picture
        ? [
            {
              key: pictureKey(entry.id, step.id),
              src: step.picture,
              name: stepLabel(t, step),
              cutOut: step.kind === 'picture',
            },
          ]
        : [],
    );
  });
