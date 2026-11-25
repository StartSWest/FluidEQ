/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDspSettings } from '../../common/dsp/chain';
import type { TGameSoundPart } from '../../common/gameSoundParts';
import type { TranslationKey } from '../../common/i18n/en';
import type { ITone } from '../../common/tone';
import { dspStageIsOn } from '../dsp/dspStageSwitch';
import { DSP_LEVEL_SECTIONS, DSP_SECTIONS, TDspSection } from '../dsp/sections';

/**
 * Every part of a game's sound, as the Gaming Lab's rail lists them: the
 * Game filter first, because it is what a game's sound is for; then what the
 * EQ page shapes — the bands with the Tone row under them, as that page has
 * them, and the curve; then the rack in its signal order, as the DSP page
 * lists it. A part's id is the one "tuned" is measured by
 * (`gameSoundParts.ts`).
 */
export type TGamingStage = TGameSoundPart;

export type TGamingStageGroup = 'game' | 'sound' | 'dsp';

const SOUND_LABEL_KEYS: Record<
  'footsteps' | 'mainEq' | 'curve',
  TranslationKey
> = {
  footsteps: 'gaming.stage.footsteps',
  mainEq: 'gaming.stage.mainEq',
  curve: 'gaming.stage.curve',
};

export interface IGamingStageDef {
  id: TGamingStage;
  group: TGamingStageGroup;
  labelKey: TranslationKey;
}

const isRackPart = (id: string): id is TGamingStage =>
  id !== 'crossfade' && id !== 'footsteps';

export const GAMING_STAGES: readonly IGamingStageDef[] = [
  { id: 'footsteps', group: 'game', labelKey: SOUND_LABEL_KEYS.footsteps },
  { id: 'mainEq', group: 'sound', labelKey: SOUND_LABEL_KEYS.mainEq },
  { id: 'curve', group: 'sound', labelKey: SOUND_LABEL_KEYS.curve },
  // The Normalizer leads the music rail in a group of its own; a game's
  // sound lists it with the rest of its rack, as it always did.
  ...[...DSP_LEVEL_SECTIONS, ...DSP_SECTIONS]
    .filter((section) => isRackPart(section.id))
    .map((section) => ({
      id: section.id as TGamingStage,
      group: 'dsp' as const,
      labelKey: section.labelKey,
    })),
];

/** A part's name on screen, for the rail and the "Tuned: …" line alike. */
export const gamingStageLabelKey = (part: TGamingStage): TranslationKey =>
  GAMING_STAGES.find((stage) => stage.id === part)?.labelKey ??
  SOUND_LABEL_KEYS.mainEq;

export const GAMING_GROUP_KEYS: Record<TGamingStageGroup, TranslationKey> = {
  game: 'gaming.rail.game',
  sound: 'gaming.rail.sound',
  dsp: 'gaming.rail.dsp',
};

/**
 * The stage of the rack a part is, for a part with an on/off of its own: the
 * Game filter and the rack's stages. The EQ page's two have none - the bands
 * and the curve are on by being there.
 */
export const gamingStageSection = (
  part: TGamingStage,
): TDspSection | undefined =>
  part === 'mainEq' || part === 'curve' ? undefined : part;

/**
 * Whether a part is doing anything in the sound playing now: the rail's
 * lamp, read as the DSP page reads its own.
 */
export const gamingStageIsOn = (
  part: TGamingStage,
  rack: IDspSettings,
  sound: {
    hasBands: boolean;
    tone: ITone | undefined;
    hasCurve: boolean;
  },
): boolean => {
  switch (part) {
    case 'mainEq':
      return (
        sound.hasBands ||
        (sound.tone !== undefined &&
          (sound.tone.bass !== 0 ||
            sound.tone.mid !== 0 ||
            sound.tone.treble !== 0))
      );
    case 'curve':
      return sound.hasCurve;
    default:
      return dspStageIsOn(part, rack);
  }
};
