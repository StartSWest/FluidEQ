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
import { getTrayLocale } from './tray';

/**
 * Text the main process shows or sends — a file dialog's title, what an
 * import did, why it was refused — in the language the window is in.
 *
 * The window tells main its language and main loads that dictionary before
 * taking it up (`ipc/window.ts`); until it has, and in a test, English. Read
 * at the moment the text is made, so a language changed between two dialogs
 * never leaves one of them behind.
 */
const mainText = (key: TranslationKey, vars?: TranslateVars): string =>
  translate(getTrayLocale(), key, vars);

export default mainText;
