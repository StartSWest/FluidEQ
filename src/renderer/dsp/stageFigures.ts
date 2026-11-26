/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IBassForgePresetSettings } from '../../common/dsp/bassForgePresets';
import type { IBassPunchPresetSettings } from '../../common/dsp/bassPunchPresets';
import type { TDeEsserMode } from '../../common/dsp/deEsser';
import type { IDeEsserPresetSettings } from '../../common/dsp/deEsserPresets';
import type { IDenoisePresetSettings } from '../../common/dsp/denoisePresets';
import type { IDimensionPresetSettings } from '../../common/dsp/dimensionPresets';
import type { IExciterPresetSettings } from '../../common/dsp/exciterProfile';
import type { IMasterPresetSettings } from '../../common/dsp/masterPresets';
import type { IMaximizerPresetSettings } from '../../common/dsp/maximizerPresets';
import type { Translate } from '../../common/i18n';
import type { TranslationKey } from '../../common/i18n/en';

/**
 * What each stage's figures are, as a line: the hint its picker on the DSP
 * page prints under a profile, and what the Preset tab's notes print under
 * the stage a preset runs. One function per stage, given the stage's own
 * settings, so a profile and a preset that set a stage the same way read the
 * same in both places.
 *
 * Derived rather than written out, for the reason every hint in this rack is:
 * a sentence describing a profile survives somebody changing the profile, and
 * the line lies from then on. These cannot be wrong unless the settings are.
 */

export const DE_ESSER_MODE_KEYS: Record<TDeEsserMode, TranslationKey> = {
  spectral: 'dsp.deEsser.mode.spectral',
  treble: 'dsp.deEsser.mode.treble',
  whole: 'dsp.deEsser.mode.whole',
};

const EXCITER_BAND_LABELS: readonly TranslationKey[] = [
  'dsp.exciter.band.low',
  'dsp.exciter.band.mid',
  'dsp.exciter.band.high',
];

/**
 * A bipolar figure with its sign always shown, so `0` reads as a centre.
 *
 * `+0.60` and `-0.15` are two directions from one rest position; `0.60` and
 * `-0.15` read as an amount next to a correction. Two decimals because the
 * catalogue uses them — `rock` sits at -0.15 and `dnb` at 0.9, and one decimal
 * would round the first into the second's neighbourhood.
 */
const signed = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

/**
 * The Maximizer's four figures, in the order the dials sit on the page. A
 * limiter has no curve to look at, so the numbers ARE the difference.
 */
export const maximizerFigures = (settings: IMaximizerPresetSettings): string =>
  [
    `${settings.driveDb > 0 ? '+' : ''}${settings.driveDb.toFixed(1)} dB`,
    `${settings.ceilingDb.toFixed(1)} dBTP`,
    `${settings.lookAheadMs} ms`,
    `${settings.releaseMs} ms`,
  ].join(' · ');

/**
 * Bass Forge's five figures. `splitHz` is deliberately absent — the
 * catalogue sits at 80, 90 or 100 almost throughout, and a column that says
 * the same thing every time would push the parts that actually differ off
 * the end of the line. Texture is NOT
 * absent, even though it looks like a variant of drive: it picks the recipe
 * the presence harmonics are built from, drive pushes whatever that recipe
 * produced into the saturator, and `hot` against `round` is exactly the pair
 * that cannot be told apart without both numbers.
 */
export const bassForgeFigures = (settings: IBassForgePresetSettings): string =>
  [
    // Sub and Presence are plain numbers rather than percentages, and Mix
    // stays a percentage, because that is what each one is: the two amounts
    // reach 2 and say how much content the generators make relative to the
    // band, while Mix is a fraction of what they made. Rendering `1.85` as
    // "185%" both reads as a mistake and disagrees with the dial beneath it.
    settings.subAmount.toFixed(2),
    settings.presenceAmount.toFixed(2),
    settings.texture.toFixed(2),
    `+${settings.driveDb.toFixed(1)} dB`,
    `${Math.round(settings.mix * 100)}%`,
  ].join(' · ');

/**
 * Bass Punch's four figures. Attack and sustain carry an explicit sign, which
 * is the one thing a reader has to see here: every other figure on the line
 * is an amount that starts at nothing, so `+0.60 · -0.15` says at a glance
 * that `rock` hits harder and decays shorter, where `0.60 · 0.15` says only
 * that it does more of two things. `splitHz` is absent for the same reason
 * Forge's is —
 * the whole catalogue sits at 90, 100 or 110. Bloom's decay is absent too,
 * but for a different reason: it is inert wherever the amount is 0, and four
 * of the profiles set exactly that.
 */
export const bassPunchFigures = (settings: IBassPunchPresetSettings): string =>
  [
    signed(settings.attack),
    signed(settings.sustain),
    `${Math.round(settings.bloomAmount * 100)}%`,
    `${Math.round(settings.duck * 100)}%`,
  ].join(' · ');

/**
 * Dimension's three widths and its spread. The crossover corners are left
 * out — they are the same in almost every profile and would push the part
 * that actually differs off the end of the line.
 */
export const dimensionFigures = (settings: IDimensionPresetSettings): string =>
  [
    `${settings.lowWidth.toFixed(2)}x`,
    `${settings.midWidth.toFixed(2)}x`,
    `${settings.highWidth.toFixed(2)}x`,
    `${Math.round(settings.decorrelation * 100)}%`,
  ].join(' · ');

/** The three figures a Master destination is. */
export const masterFigures = (settings: IMasterPresetSettings): string =>
  [
    `${settings.loudnessTargetLufs.toFixed(1)} LUFS`,
    `${settings.ceilingDb.toFixed(1)} dBTP`,
    `${settings.peakLimitingDb.toFixed(0)} dB`,
  ].join(' · ');

/**
 * The three things that tell one de-esser setting from another: how deep it
 * may cut (the figure each is known by), how, and where it listens.
 */
export const deEsserFigures = (
  settings: Pick<IDeEsserPresetSettings, 'rangeDb' | 'mode' | 'centreOnly'>,
  t: Translate,
): string =>
  [
    t('dsp.deEsser.upTo', {
      db: `−${Number(settings.rangeDb.toFixed(1)).toString()} dB`,
    }),
    t(DE_ESSER_MODE_KEYS[settings.mode]),
    settings.centreOnly
      ? t('dsp.deEsser.where.centre')
      : t('dsp.deEsser.where.all'),
  ].join(' · ');

/** How the restoration listens, and the modules it starts. */
export const denoiseFigures = (
  settings: Pick<
    IDenoisePresetSettings,
    'profileSource' | 'hiss' | 'hum' | 'click'
  >,
  t: Translate,
): string => {
  const modules = [
    settings.hiss.enabled ? t('dsp.denoise.hiss') : '',
    settings.hum.enabled ? t('dsp.denoise.hum') : '',
    settings.click.enabled ? t('dsp.denoise.click') : '',
  ].filter(Boolean);
  const source = t(
    settings.profileSource === 'adaptive'
      ? 'dsp.denoise.adaptive'
      : 'dsp.denoise.scanned',
  );
  return [source, ...modules].join(' · ');
};

/** The Exciter's audible sections: its bands, its stereo, Organic, Align. */
export const exciterFigures = (
  settings: IExciterPresetSettings,
  t: Translate,
): string => {
  const parts = settings.bands.flatMap((band, index) =>
    band.enabled && EXCITER_BAND_LABELS[index]
      ? [t(EXCITER_BAND_LABELS[index])]
      : [],
  );
  if (settings.stereo !== 'stereo') {
    parts.unshift(t(`dsp.eqStereo.${settings.stereo}` as TranslationKey));
  }
  if (settings.organic.enabled) {
    parts.push(t('dsp.exciter.organic'));
  }
  if (settings.align.enabled) {
    parts.push(t('dsp.exciter.align'));
  }
  return parts.join(' · ');
};
