/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import headphones from '../../../docs/04-eq-headphone-correction-and-import.png';
import convolution from '../../../docs/05-eq-convolution-library.png';
import config from '../../../docs/06-eq-equalizer-apo-config.png';
import engine from '../../../docs/15-engine-dialog.png';
import type { THelpPicture } from '../../common/helpGuide';

/**
 * Every capture, one set: taken at the middle of the Brightness slider, where
 * one picture reads on a dark window and a light one (2026-09-29; the Light
 * theme's twins went with the themes). Static imports make webpack include
 * each one in offline packaged builds.
 *
 * A live figure's still is not here: the app draws that figure from its own
 * components (`HelpLiveFigure`), and only the exported guide shows the still.
 */
const SHOTS: Record<THelpPicture, string> = {
  '04-eq-headphone-correction-and-import.png': headphones,
  '05-eq-convolution-library.png': convolution,
  '06-eq-equalizer-apo-config.png': config,
  '15-engine-dialog.png': engine,
};

/** A capture, as the guide shows it. */
const helpScreenshot = (image: THelpPicture): string => SHOTS[image];

export default helpScreenshot;
