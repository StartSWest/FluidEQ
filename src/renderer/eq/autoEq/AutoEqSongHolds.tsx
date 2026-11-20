/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { isBandEnabled } from 'common/constants';
import type { Translate } from 'common/i18n';
import { getResponseGainAtFrequencies } from 'common/response';
import type { ISongSound } from 'common/songSound';
import { TONE_KNOBS } from 'common/tone';
import { resolveDspPresetCurve } from '../../dsp/dspPresetCatalog';
import songSoundPresetName from '../../components/songSoundPresetName';
import { useTranslation } from '../../utils/I18nContext';

/**
 * What a song's saved sound holds, listed in Auto EQ's panel while it plays
 * (Ivan, 2026-11-20: "we can show what is recorded for the song, eq, tone,
 * curves"; the mockup he approved): the preset, Your EQ with a curve the size
 * of a word, the Tone, and the preset's curve. Label beside value, one line
 * each, in the panel's own flat style. The headphone correction is not the
 * song's — it stays with the output — and the line under the curves says so.
 */

/** Where the little curve is drawn, 20 Hz to 20 kHz on a log scale. */
const CURVE_POINTS = 48;
const FREQUENCIES = Array.from(
  { length: CURVE_POINTS },
  (_, index) => 20 * 1000 ** (index / (CURVE_POINTS - 1)),
);
const CURVE_WIDTH = 92;
const CURVE_HEIGHT = 22;
/** ±12 dB fills the height; anything past it stands at the edge. */
const CURVE_RANGE_DB = 12;

const curvePath = (filters: ISongSound['filters']): string => {
  const gains = getResponseGainAtFrequencies(
    { filters: Object.values(filters).filter(isBandEnabled) },
    FREQUENCIES,
  );
  return gains
    .map((gain, index) => {
      const x = (index / (CURVE_POINTS - 1)) * CURVE_WIDTH;
      const clamped = Math.max(-CURVE_RANGE_DB, Math.min(CURVE_RANGE_DB, gain));
      const y =
        CURVE_HEIGHT / 2 - (clamped / CURVE_RANGE_DB) * (CURVE_HEIGHT / 2 - 1);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
};

/** A dial's value as the Tone panel reads it: signed, a minus that is one. */
const signed = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) {
    return '0';
  }
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
};

const toneLine = (sound: ISongSound, t: Translate): string => {
  const { tone } = sound;
  if (!tone || TONE_KNOBS.every((knob) => tone[knob] === 0)) {
    return t('autoEq.holds.flat');
  }
  return TONE_KNOBS.map(
    (knob) => `${t(`eq.tone.${knob}`)} ${signed(tone[knob])}`,
  ).join(' · ');
};

const presetLine = (presetId: string, t: Translate): string => {
  if (presetId === 'none') {
    return t('autoEq.holds.none');
  }
  return songSoundPresetName(presetId, t) ?? t('songSound.noPresetName');
};

const AutoEqSongHolds = ({ sound }: { sound: ISongSound }) => {
  const { t } = useTranslation();
  const path = useMemo(() => curvePath(sound.filters), [sound.filters]);
  const bandCount = Object.values(sound.filters).filter(isBandEnabled).length;
  const preset = presetLine(sound.presetId, t);
  const hasCurve =
    sound.presetId !== '' &&
    resolveDspPresetCurve(sound.presetId) !== undefined;

  return (
    <dl className="eq-auto-holds">
      <dt>{t('autoEq.holds.preset')}</dt>
      <dd>{preset}</dd>
      <dt>{t('autoEq.holds.eq')}</dt>
      <dd>
        <svg
          className="eq-auto-holds__curve"
          viewBox={`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`}
          aria-hidden="true"
        >
          <path
            className="eq-auto-holds__zero"
            d={`M0 ${CURVE_HEIGHT / 2} H${CURVE_WIDTH}`}
          />
          <path className="eq-auto-holds__line" d={path} />
        </svg>
        {bandCount === 1
          ? t('autoEq.holds.bandsOne')
          : t('autoEq.holds.bands', { count: bandCount })}
      </dd>
      <dt>{t('eq.tone')}</dt>
      <dd className="eq-auto-holds__tone">{toneLine(sound, t)}</dd>
      <dt>{t('autoEq.holds.curves')}</dt>
      <dd>
        {hasCurve
          ? t('autoEq.holds.curve', { preset })
          : t('autoEq.holds.none')}
        <small>{t('autoEq.holds.correction')}</small>
      </dd>
    </dl>
  );
};

export default AutoEqSongHolds;
