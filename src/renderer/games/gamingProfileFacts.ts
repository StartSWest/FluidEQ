/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a ready-made Gaming profile does, for its card on the profiles page
 * (Ivan, 2026-11-04: "improve gaming profiles page and those cards"): its
 * game curve, how far each part of the Game filter reaches, the gaming chain
 * under it and what it does to the Room. Forty-two cards said the same three
 * things — a controller, "No game starts from it yet", Use — and nothing a
 * reader could choose between them by.
 *
 * Every number is the filter's own (`footsteps.ts`): a dial times its stage's
 * reach, the dB a listener would see on the Game filter's page.
 */

import {
  environmentDb,
  FOOTSTEPS_MAX_LIFT_DB,
  VOICES_MAX_LIFT_DB,
} from '../../common/dsp/footsteps';
import {
  IFootstepsPreset,
  isGameRoom,
} from '../../common/dsp/footstepsPresets';
import {
  gameCurveForProfile,
  gameCurveOfVoicing,
  IGameCurve,
} from '../../common/dsp/gameCurves';
import { roomPresetOf } from '../../common/dsp/roomPresets';
import {
  gamingProfileRef,
  IYoursSoundSummary,
  readyGamingChain,
} from '../../common/gaming';
import type { Translate } from '../../common/i18n';
import type { TranslationKey } from '../../common/i18n/en';

/** The picture a card wears: the kind of game, never the same controller. */
export type TGamingProfileGlyph =
  | 'competitive'
  | 'battle'
  | 'tactical'
  | 'story'
  | 'room'
  | 'topDown'
  | 'worlds'
  | 'speed'
  | 'impact'
  | 'yours';

const KIND_GLYPHS: Record<string, TGamingProfileGlyph> = {
  competitive: 'competitive',
  battleRoyale: 'battle',
  tactical: 'tactical',
  story: 'story',
  immersive: 'room',
  topDown: 'topDown',
  worlds: 'worlds',
  speed: 'speed',
  impact: 'impact',
};

const GROUP_GLYPHS: Record<string, TGamingProfileGlyph> = {
  competitive: 'competitive',
  battle: 'battle',
  tactical: 'tactical',
  moba: 'topDown',
  rpg: 'worlds',
  story: 'story',
};

/** How far each part of the Game filter reaches, in its own dB. */
export interface IGameFilterReach {
  /** How far a quiet step comes up. */
  footstepsDb: number;
  /** How far a voice comes forward. */
  dialogueDb: number;
  /** The bed's gain: down below zero, up above it. */
  environmentDb: number;
}

export interface IGamingProfileFacts {
  glyph: TGamingProfileGlyph;
  /** Its game curve. */
  curve?: IGameCurve;
  /**
   * Whether the card has a curve to speak of: a ready-made profile always
   * does (none is "as the game was mixed"); one of the listener's own only
   * when it plays a game curve.
   */
  showsCurve: boolean;
  /** The Game filter's reach; none while a saved profile has it off. */
  filter?: IGameFilterReach;
  /** The gaming chain the copy's rack starts from. */
  chainId?: string;
  /** What it does to the Room, in the Game filter's words; none to say. */
  roomNote?: string;
}

const reachOf = ({
  lift,
  voices,
  environment,
}: {
  lift: number;
  voices: number;
  environment: number;
}): IGameFilterReach => ({
  footstepsDb: lift * FOOTSTEPS_MAX_LIFT_DB,
  dialogueDb: voices * VOICES_MAX_LIFT_DB,
  environmentDb: environmentDb(environment),
});

/** A profile of the listener's own wears its own picture and no facts. */
export const gamingProfileGlyph = (id: string): TGamingProfileGlyph => {
  const ref = gamingProfileRef(id);
  if (ref?.kind !== 'ready') {
    return 'yours';
  }
  const { preset } = ref;
  return (
    (preset.group === 'kinds'
      ? KIND_GLYPHS[preset.id]
      : GROUP_GLYPHS[preset.group]) ?? 'room'
  );
};

/**
 * What the Room does under it, as the Game filter's picker says it: its own
 * 3D sound, best without the Room, or the room it is best in on headphones.
 * A kind of game leaves the Room as the chain has it: nothing to say.
 */
const roomNoteOf = (
  preset: IFootstepsPreset,
  t: Translate,
): string | undefined => {
  if (preset.room === 'own3d') {
    return t('dsp.game.hintOwn3d');
  }
  if (preset.room === 'none') {
    return t('dsp.game.hintNoRoom');
  }
  const room = isGameRoom(preset.room) ? roomPresetOf(preset.room) : undefined;
  return room
    ? t('dsp.game.hintRoom', { room: t(room.labelKey as TranslationKey) })
    : undefined;
};

/** The facts of a ready-made profile; none for one of the listener's own. */
export const gamingProfileFacts = (
  id: string,
  t: Translate,
): IGamingProfileFacts | undefined => {
  const ref = gamingProfileRef(id);
  if (ref?.kind !== 'ready') {
    return undefined;
  }
  const { preset } = ref;
  return {
    glyph: gamingProfileGlyph(id),
    curve: gameCurveForProfile(preset),
    showsCurve: true,
    filter: reachOf(preset.settings),
    chainId: readyGamingChain(preset),
    roomNote: roomNoteOf(preset, t),
  };
};

/**
 * The facts of one of the listener's own, from what main read of its saved
 * sound: the game curve on its Preset layer, the Game filter while it is on,
 * and its chain (Ivan, 2026-11-04: "make curve also on saved").
 *
 * No Preset layer at all is "no curve", drawn flat as a ready-made one with
 * none is. A Preset layer that is not a game curve (an old row's chain
 * curve) is not drawn: the card has no bands of it to draw, and a flat line
 * would say it plays nothing. Nothing read (an older main) says nothing.
 */
export const yoursProfileFacts = (
  summary: IYoursSoundSummary | undefined,
): IGamingProfileFacts => {
  const curve = summary?.curveId
    ? gameCurveOfVoicing(summary.curveId)
    : undefined;
  return {
    glyph: 'yours',
    curve,
    showsCurve:
      summary !== undefined &&
      (curve !== undefined || summary.curveId === undefined),
    ...(summary?.footsteps ? { filter: reachOf(summary.footsteps) } : {}),
    ...(summary?.chainId ? { chainId: summary.chainId } : {}),
  };
};

/**
 * Lower case and without accents, so "pokemon" finds "Pokémon" and "ÉTÉ"
 * finds "été" in any language the page is in.
 */
export const searchFold = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** Whether every word of a search stands somewhere in a card's words. */
export const matchesSearch = (
  words: readonly string[],
  query: string,
): boolean => {
  const asked = searchFold(query).split(/\s+/).filter(Boolean);
  if (asked.length === 0) {
    return true;
  }
  const haystack = searchFold(words.join(' '));
  return asked.every((word) => haystack.includes(word));
};
