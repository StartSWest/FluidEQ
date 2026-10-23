/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { useTranslation } from '../utils/I18nContext';
import type { ITransportSource } from './transportSource';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

/**
 * The bar's third line for another computer's sound: which computer, and how
 * far behind its sound plays here once that is known — "Playing remote ·
 * SWEST-YOGA · 145 ms" (Ivan, 2026-10-02). One wording for the bar under the
 * pages and both compact players.
 */
const remoteOriginLine = (
  t: TranslateFn,
  source: Pick<ITransportSource, 'origin' | 'delayMs'>,
): string =>
  source.delayMs === undefined
    ? t('library.remoteAudio', { name: source.origin ?? '' })
    : t('library.remoteAudioDelay', {
        name: source.origin ?? '',
        milliseconds: Math.round(source.delayMs),
      });

export default remoteOriginLine;
