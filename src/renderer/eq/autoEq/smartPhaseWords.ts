/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { LocaleCode, Translate } from 'common/i18n';
import type { ISmartEqPreview } from '../../utils/smartEqPreview';
import { balanceRangeName } from '../../utils/autoBalanceNarration';

/**
 * What Smart correction is doing for the song, said the same on the graph
 * and in the panel: a word for the phase, the music heard beside it, and the
 * panel's line under it.
 */

export const smartPhaseWord = (preview: ISmartEqPreview, t: Translate) => {
  if (preview.phase === 'held') {
    return t('autoEq.smart.phase.held');
  }
  // Nothing heard of a song yet, and nothing playing: there is no song.
  if (preview.phase === 'idle' || (preview.isSilent && preview.heardMs <= 0)) {
    return t('autoEq.smart.waiting');
  }
  if (preview.isSilent) {
    return t('autoEq.smart.phase.paused');
  }
  return preview.phase === 'settling'
    ? t('autoEq.smart.phase.settling')
    : t('autoEq.smart.phase.listening');
};

/** "3.5 s" while it listens; nothing before the first half second or once held. */
export const smartHeardSeconds = (
  preview: ISmartEqPreview,
  t: Translate,
  locale: LocaleCode,
): string =>
  preview.phase === 'held' || preview.phase === 'idle' || preview.heardMs <= 0
    ? ''
    : t('autoEq.smart.heard', {
        seconds: new Intl.NumberFormat(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(preview.heardMs / 1000),
      });

const namesOf = (labels: readonly string[], t: Translate) =>
  labels
    .map((label) => balanceRangeName(label, t))
    .join(t('eq.smart.range.separator'));

/** The panel's line under the phase. */
export const smartPhaseNote = (
  preview: ISmartEqPreview,
  t: Translate,
): string => {
  if (preview.phase === 'held') {
    if (preview.outcome === 'short') {
      return t('autoEq.smart.note.heldShort');
    }
    return preview.missing.length > 0
      ? t('autoEq.smart.note.heldMissing', {
          ranges: namesOf(preview.missing, t),
        })
      : t('autoEq.smart.note.held');
  }
  if (preview.phase === 'settling') {
    return t('autoEq.smart.note.settling');
  }
  // The least heard range that something has reached: one the record never
  // reaches has no confidence at all and is not something it waits on.
  const waiting = preview.regions
    .filter((region) => !region.isCovered)
    .filter((region) => region.confidence > 0)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 1)
    .map((region) => region.label);
  return waiting.length > 0 && preview.heardMs > 0
    ? t('autoEq.smart.note.waitingOn', { ranges: namesOf(waiting, t) })
    : t('autoEq.smart.note.listening');
};
