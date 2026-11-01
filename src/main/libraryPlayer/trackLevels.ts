/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the player tells the rack about the song it plays: the level it plays
 * at (Normalizer's gain and Master's makeup), the noise floor measured in it,
 * and which song it is — and WHEN, which is the whole of this file.
 *
 * Across a fade all three are held until the incoming song is all that is
 * heard. Sent at the start of the overlap, the incoming song's gain would
 * move the outgoing song's level for the length of the fade, and its floor
 * would be subtracted from a recording it was never measured on; held, the
 * level makes one transition from what is being heard. A song with no
 * measurement yet keeps the outgoing pair through the overlap, and the floor
 * goes once the overlap is over whether or not a new one has arrived: the
 * audio is all the new song then, and the old song's hiss is not its own.
 */
import type { IDspSettings } from '../../common/dsp/chain';
import type { INoiseProfile } from '../../common/dsp/noiseProfile';
import {
  masterLoudnessGainDb,
  normalizerGainDb,
} from '../../common/dsp/trackGains';
import type { ILibraryTrack } from '../../common/library/types';
import type { ISourcePublication } from './sourcePublication';

export interface ITrackLevelSink {
  setTrackGains: (inputGainDb: number, masterGainDb: number) => void;
  setNoiseProfile: (profile: INoiseProfile | undefined) => void;
}

export interface ITrackLevels {
  /**
   * A new song, or none. With `fadeEndsAtMs` it comes in over the one
   * playing, and what is sent about it waits until the fade has run to that
   * point in the new song.
   */
  trackChanged: (
    track: ILibraryTrack | undefined,
    fadeEndsAtMs?: number,
  ) => void;
  /** The same song, measured again (or for the first time). */
  measured: (track: ILibraryTrack) => void;
  /** The rack's settings moved: the gains are worked out again. */
  settingsChanged: () => void;
  /** Where the current song now is, which is what ends a held fade. */
  heardAt: (trackId: string, positionMs: number) => void;
  /** The host came up: it is told the current song's levels afresh. */
  resend: () => void;
}

export const createTrackLevels = (
  sink: ITrackLevelSink,
  sources: ISourcePublication,
  settings: () => IDspSettings | undefined,
): ITrackLevels => {
  let current: ILibraryTrack | undefined;
  /** Held across a fade: until where in the song, and whether anything waits. */
  let held: { trackId: string; untilMs: number } | undefined;

  const gainsOf = (track: ILibraryTrack): readonly [number, number] => {
    const rack = settings();
    const analysis = track.normalization;
    return rack
      ? [
          normalizerGainDb(rack.normalizer, analysis),
          masterLoudnessGainDb(rack.master, rack.normalizer, analysis),
        ]
      : [0, 0];
  };

  /** Everything about the current song, now. */
  const send = () => {
    if (!current) {
      sources.setSource(undefined, undefined);
      return;
    }
    const [inputGainDb, masterGainDb] = gainsOf(current);
    sink.setTrackGains(inputGainDb, masterGainDb);
    // Undefined when this song has no scan: keeping the previous song's
    // profile would subtract that recording's hiss from this one.
    sink.setNoiseProfile(current.normalization?.noise);
    sources.setSource(current.id, current.normalization);
  };

  const release = () => {
    if (!held || !current || held.trackId !== current.id) {
      held = undefined;
      return;
    }
    held = undefined;
    if (current.normalization) {
      send();
      return;
    }
    // Nothing measured yet: the outgoing level stays until a measurement
    // arrives, but its floor goes, and the song is announced.
    sink.setNoiseProfile(undefined);
    sources.setSource(current.id, undefined);
  };

  return {
    trackChanged: (track, fadeEndsAtMs) => {
      current = track;
      held =
        track !== undefined && fadeEndsAtMs !== undefined
          ? { trackId: track.id, untilMs: fadeEndsAtMs }
          : undefined;
      if (!held) {
        send();
      }
    },

    measured: (track) => {
      if (current?.id !== track.id) {
        return;
      }
      current = track;
      if (!held) {
        send();
      }
    },

    settingsChanged: () => {
      if (!held && current) {
        const [inputGainDb, masterGainDb] = gainsOf(current);
        sink.setTrackGains(inputGainDb, masterGainDb);
      }
    },

    heardAt: (trackId, positionMs) => {
      if (held?.trackId === trackId && positionMs >= held.untilMs) {
        release();
      }
    },

    resend: () => {
      if (!held) {
        send();
      }
    },
  };
};
