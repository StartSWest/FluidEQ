/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import { isBandEnabled } from 'common/constants';
import type { Translate } from 'common/i18n';
import type { ISongSound } from 'common/songSound';
import { TONE_KNOBS } from 'common/tone';
import { resolveDspPresetCurve } from '../../dsp/dspPresetCatalog';
import songSoundPresetName from '../../components/songSoundPresetName';
import { useTranslation } from '../../utils/I18nContext';
import AutoEqMiniCurve from './AutoEqMiniCurve';

/**
 * What a sound holds, listed in Auto EQ's panel: a song's saved sound while
 * it plays (Ivan, 2026-11-20: "we can show what is recorded for the song, eq,
 * tone, curves"; the mockup he approved), and what Save this EQ will keep.
 * The preset, Your EQ with a curve the size of a word, the Tone, and the
 * preset's curve; label beside value, one line each, in the panel's own flat
 * style. The headphone correction is not the song's — it stays with the
 * output — and the line under the curves says so.
 */

/** A dial's value as the Tone panel reads it: signed, a minus that is one. */
const signed = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) {
    return '0';
  }
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
};

/** Whether the Tone does anything at all. */
export const isToneFlat = (sound: ISongSound): boolean =>
  !sound.tone || TONE_KNOBS.every((knob) => sound.tone?.[knob] === 0);

export const toneLine = (sound: ISongSound, t: Translate): string =>
  isToneFlat(sound)
    ? t('autoEq.holds.flat')
    : TONE_KNOBS.map(
        (knob) => `${t(`eq.tone.${knob}`)} ${signed(sound.tone?.[knob] ?? 0)}`,
      ).join(' · ');

export const presetLine = (presetId: string, t: Translate): string => {
  if (presetId === 'none') {
    return t('autoEq.holds.none');
  }
  return songSoundPresetName(presetId, t) ?? t('songSound.noPresetName');
};

/** "15 bands", "1 band". */
export const bandsLine = (sound: ISongSound, t: Translate): string => {
  const count = Object.values(sound.filters).filter(isBandEnabled).length;
  return count === 1
    ? t('autoEq.holds.bandsOne')
    : t('autoEq.holds.bands', { count });
};

const AutoEqSongHolds = ({
  sound,
  presetValue,
  correctionNote,
}: {
  sound: ISongSound;
  /** In place of the preset's line: Save this EQ's switch to keep it. */
  presetValue?: ReactNode;
  /** In place of the line saying the headphone correction stays with the
   * output: Save this EQ says Smart correction stays too. */
  correctionNote?: string;
}) => {
  const { t } = useTranslation();
  const preset = presetLine(sound.presetId, t);
  const hasCurve =
    sound.presetId !== '' &&
    resolveDspPresetCurve(sound.presetId) !== undefined;

  // Four cells, a label over its value, each on a step of light (Ivan chose
  // design A on 2026-11-24: "is all together, no separation"): a list of
  // label beside value ran on into the part's words above and its line
  // below, and read as one grey block.
  return (
    <>
      <dl className="eq-auto-holds">
        <div className="eq-auto-holds__cell">
          <dt>{t('autoEq.holds.preset')}</dt>
          <dd>{presetValue ?? preset}</dd>
        </div>
        <div className="eq-auto-holds__cell">
          <dt>{t('autoEq.holds.eq')}</dt>
          <dd>
            <AutoEqMiniCurve
              filters={sound.filters}
              width={70}
              height={20}
              className="eq-auto-holds__curve"
            />
            <small>{bandsLine(sound, t)}</small>
          </dd>
        </div>
        <div className="eq-auto-holds__cell">
          <dt>{t('eq.tone')}</dt>
          <dd className="eq-auto-holds__tone">{toneLine(sound, t)}</dd>
        </div>
        <div className="eq-auto-holds__cell">
          <dt>{t('autoEq.holds.curves')}</dt>
          <dd>
            {hasCurve
              ? t('autoEq.holds.curve', { preset })
              : t('autoEq.holds.none')}
          </dd>
        </div>
      </dl>
      <p className="eq-auto-holds__note">
        {correctionNote ?? t('autoEq.holds.correction')}
      </p>
    </>
  );
};

export default AutoEqSongHolds;
