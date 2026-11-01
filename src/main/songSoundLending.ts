/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IState } from '../common/constants';
import {
  resolveDspPreset,
  resolveDspPresetCurve,
} from '../common/dsp/presetPick';
import type { IUserDspPreset } from '../common/dsp/userPresets';
import type { ISongSound, ISongSoundEntry } from '../common/songSound';
import songSoundOf from '../common/songSoundOf';
import type { IMainSession } from './mainSession';
import { ownsTemporaryRack, playingRack } from './outputRack';
import {
  keepSongSound,
  putSongSoundOn,
  returnSongSound,
} from './songSoundLoan';

export interface ISongSoundLendingDeps {
  state: IState;
  session: IMainSession;
  savedChains: () => readonly IUserDspPreset[];
  /** Write it down and tell the window; whether it landed. */
  land: (label: string) => Promise<boolean>;
}

/**
 * A song's sound put on the edited output and taken off it, for the song
 * memory (`songMemory.ts`): its EQ and Tone through the state's loan
 * (`songSoundLoan.ts`), its rack as the rack that plays while the output
 * keeps its own (`outputRack.ts`) — one write each.
 */
export const createSongSoundLending = ({
  state,
  session,
  savedChains,
  land,
}: ISongSoundLendingDeps) => {
  const audibleRack = () => playingRack(state, session);
  const lentRack = () =>
    session.outputDspOverrides?.get(session.activeAudioDeviceId);

  /** The sound playing, as the memory reads it. */
  const soundNow = () =>
    songSoundOf(
      {
        filters: state.filters,
        tone: state.tone,
        voicing: state.voicing,
        eqFormat: state.eqFormat,
      },
      audibleRack(),
    );

  /**
   * The rack the output plays: lent, or its own as well. None is none — an
   * output with no rack saved plays none once a lent one is taken off.
   */
  const playRack = (rack: IState['dsp'], isOwn: boolean) => {
    if (!rack) {
      session.outputDspOverrides?.delete(session.activeAudioDeviceId);
      return;
    }
    session.outputDspOverrides ??= new Map();
    session.outputDspOverrides.set(session.activeAudioDeviceId, rack);
    if (isOwn) {
      state.dsp = rack;
    }
  };

  return {
    soundNow,
    /**
     * Put a sound on: lent while it is a song's own, handed back when not.
     * A hand-back restores the exact borrowed rack, manual changes included,
     * rather than the preset's defaults; the loan puts back the matching
     * curve. Other sounds follow the picker, with the rack held off under
     * Equalizer APO. Whether it landed.
     */
    putOn: async (sound: ISongSound, isLent: boolean): Promise<boolean> => {
      const isRestoring = !isLent && ownsTemporaryRack(state, lentRack());
      const saved = savedChains();
      const rack = isRestoring
        ? undefined
        : resolveDspPreset(sound.presetId, audibleRack(), saved);
      // None, or a preset with no curve, takes a preset's curve away
      // (`null`); a hand-back the loan puts back, or a preset nobody can
      // name, leaves the voicing alone (`undefined`).
      const curve = rack
        ? (resolveDspPresetCurve(sound.presetId, saved) ?? null)
        : undefined;
      putSongSoundOn(state, sound, isLent, curve);
      if (isRestoring) {
        playRack(state.dsp, false);
      } else if (rack) {
        playRack(
          session.audioEngine === 'apo' && sound.presetId !== 'none'
            ? { ...rack, enabled: false, gameMode: false }
            : rack,
          !isLent,
        );
      }
      return land('applySongSound');
    },
    /** What plays is the listener's own from here, the rack included. */
    keep: async (): Promise<void> => {
      const lent = lentRack();
      if (!state.songSoundLoan && !ownsTemporaryRack(state, lent)) {
        return;
      }
      keepSongSound(state);
      playRack(lent, true);
      await land('keepSongSound');
    },
    /**
     * A loan left from before this run of the core — a crash, a power cut —
     * handed back: nothing in this run will ever hand it back.
     */
    giveBackLeftover: async (): Promise<void> => {
      const hadRack = ownsTemporaryRack(state, lentRack());
      if (!returnSongSound(state) && !hadRack) {
        return;
      }
      playRack(state.dsp, false);
      await land('returnSongSound');
    },
    /** A missing remembered preset lends only its Tone and bands. */
    playable: (
      entry: ISongSoundEntry | undefined,
      live: ISongSound | undefined,
    ): ISongSoundEntry | undefined => {
      if (
        !entry ||
        !live ||
        resolveDspPreset(entry.sound.presetId, audibleRack(), savedChains())
      ) {
        return entry;
      }
      return { ...entry, sound: { ...entry.sound, presetId: live.presetId } };
    },
  };
};
