/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mix the native mirror keeps the host at: the listener volume, and a
 * layer on the deck in use — a second file the deck plays in lockstep with
 * its own, each at a gain of its own.
 *
 * The Library has neither. Its fader is the system's, so the mirror says full
 * level once and never again, and a Library track is one file. The Karaoke
 * has both: a backing fader that scales the song under the system volume, and
 * once a song is separated a voice that sits over the backing at a fader of
 * its own. Those used to be an `<audio>` element's volume and a Web Audio
 * buffer started beside it and resynchronised whenever the two drifted 120 ms
 * apart; in the host they are two gains on one deck, which cannot drift.
 *
 * Steps in the mirror's own worker (`nativeMirror.ts`), each recorded as told
 * before it is sent, so a step that fails is not asked for again on every
 * pass — the same rule as every other step there.
 */
import { INativeTransport } from './nativeBackend';
import { INativeMirrorMix } from './nativeMirrorTypes';

type TStep = () => Promise<void>;

/** What the host has been told about the mix, as the last steps left it. */
export interface IMixTold {
  volume: number;
  layer?: {
    deck: number;
    path: string;
    deckGain?: number;
    gain?: number;
  };
}

/**
 * Full level and no layer: what the mirror says to the host as it is made
 * (`controller.transport.setVolume(1)` there), and what a host process
 * starts with.
 */
export const createMixTold = (): IMixTold => ({ volume: 1 });

/**
 * A deck was loaded: LOAD_DECK takes the deck's layer off in the host
 * (`setDeckGain` in main's `wire.ts`), so what was told about it is over.
 */
export const forgetLayerOn = (told: IMixTold, deck: number): void => {
  if (told.layer?.deck === deck) {
    // eslint-disable-next-line no-param-reassign -- the record IS the subject.
    told.layer = undefined;
  }
};

/**
 * The volume first of every step, ahead of a change of track: a cue plays in
 * the same step that loads it, and a level sent after it would be heard as a
 * blip at full volume on every song.
 */
export const nextVolumeStep = (
  want: INativeMirrorMix | undefined,
  told: IMixTold,
  transport: INativeTransport,
): TStep | undefined => {
  const volume = want?.volume ?? 1;
  if (volume === told.volume) {
    return undefined;
  }
  // eslint-disable-next-line no-param-reassign -- the record IS the subject.
  told.volume = volume;
  return async () => {
    await transport.setVolume(volume);
  };
};

/**
 * The layer, once the host plays the track: onto the deck the track is on,
 * then its two gains — or off the deck it was left on, when it is no longer
 * wanted there.
 */
export const nextLayerStep = (
  want: INativeMirrorMix | undefined,
  told: IMixTold,
  deck: number,
  hostOwnsTransport: boolean,
  transport: INativeTransport,
): TStep | undefined => {
  if (!hostOwnsTransport) {
    return undefined;
  }
  const layer = want?.layer;
  const held = told.layer;
  if (held && (layer === undefined || held.deck !== deck)) {
    // eslint-disable-next-line no-param-reassign -- the record IS the subject.
    told.layer = undefined;
    return async () => {
      await transport.loadLayer(held.deck, undefined);
      await transport.setDeckGain(held.deck, 1);
    };
  }
  if (layer === undefined) {
    return undefined;
  }
  if (held === undefined || held.path !== layer.path) {
    // eslint-disable-next-line no-param-reassign -- the record IS the subject.
    told.layer = { deck, path: layer.path };
    // A refusal — a file the host could not open — is not asked again: the
    // record keeps the path, and only a different file is a new step.
    return async () => {
      await transport.loadLayer(deck, layer.path);
    };
  }
  if (held.deckGain !== layer.deckGain) {
    held.deckGain = layer.deckGain;
    return async () => {
      await transport.setDeckGain(deck, layer.deckGain);
    };
  }
  if (held.gain !== layer.gain) {
    held.gain = layer.gain;
    return async () => {
      await transport.setLayerGain(deck, layer.gain);
    };
  }
  return undefined;
};
