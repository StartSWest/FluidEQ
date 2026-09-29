/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  translate,
  type TranslateVars,
  type TranslationKey,
} from '../common/i18n';
import mainText from './mainText';

/**
 * A refusal the user can act on — a file at the wrong rate, text that holds
 * no EQ. Its message is English, for the log; the user is told in the
 * window's language (`userMessageOf`). These were thrown as English sentences
 * and relayed as they were, so a German import was refused in English.
 */
export class Refusal extends Error {
  readonly key: TranslationKey;

  readonly vars: TranslateVars | undefined;

  constructor(key: TranslationKey, vars?: TranslateVars) {
    super(translate('en', key, vars));
    this.name = 'Refusal';
    this.key = key;
    this.vars = vars;
  }
}

/**
 * What to tell the user about a failure: a refusal in their language, and
 * anything else — a disk that is full, a file locked by another program — as
 * the system worded it, which is all there is to say about it.
 */
export const userMessageOf = (error: unknown): string | undefined => {
  if (error instanceof Refusal) {
    return mainText(error.key, error.vars);
  }
  return error instanceof Error ? error.message : undefined;
};
