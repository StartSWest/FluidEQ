/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The native host as the core's Library player drives it (`hostEngine.ts`),
 * or undefined on a machine that has never built it.
 *
 * The player reached every one of these from the window, over a channel
 * each; it lives in main now and calls the supervisor directly. The checks
 * the channels made stay, because the rule they keep is the host's and not
 * the window's: a truncated chain or table is refused rather than half
 * applied, and a deck number is one of the two there are.
 */
import { isChainWirePayload } from '../../common/dsp/chainWire';
import { CROSSFADE_TABLE_POINTS } from '../../common/dsp/crossfadeShape';
import { NOISE_PROFILE_WIRE_LENGTH } from '../../common/dsp/noiseProfile';
import type { DspHostSupervisor } from '../dspHost/supervisor';
import {
  dspHostAvailable,
  listenToDspHostTelemetry,
  noteDspHostPlaying,
  readyDspHost,
  startDspHost,
  stopDspHost,
} from '../ipc/dspHost';
import type { IHostPort } from './hostEngine';

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const isDeck = (deck: number): boolean => deck === 0 || deck === 1;

/** A command to a host that is not there, or that failed, took nothing. */
const ask = async <T>(
  command: (host: DspHostSupervisor) => Promise<T>,
  absent: T,
): Promise<T> => {
  const host = readyDspHost();
  if (!host) {
    return absent;
  }
  try {
    return await command(host);
  } catch {
    // The supervisor has already reported why through its diagnostics.
    return absent;
  }
};

const libraryHostPort = (): IHostPort | undefined => {
  if (!dspHostAvailable()) {
    return undefined;
  }
  return {
    start: startDspHost,
    stop: stopDspHost,
    applyChain: (values) =>
      isChainWirePayload(values)
        ? ask((host) => host.applyChain(values), false)
        : Promise.resolve(false),
    openDevice: () => ask((host) => host.openDevice(), false),
    closeDevice: () => ask((host) => host.closeDevice(), false),
    // Clamped again in the host.
    setVolume: (volume) =>
      ask((host) => host.setVolume(Math.min(1, Math.max(0, volume))), false),
    setTrackGains: (inputGainDb, masterGainDb) =>
      isFiniteNumber(inputGainDb) && isFiniteNumber(masterGainDb)
        ? ask(
            // Snapped, as the window always sent them.
            (host) => host.setTrackGains(inputGainDb, masterGainDb, true),
            false,
          )
        : Promise.resolve(false),
    setNoiseProfile: (values) =>
      values !== undefined &&
      (values.length !== NOISE_PROFILE_WIRE_LENGTH ||
        !values.every(isFiniteNumber))
        ? Promise.resolve(false)
        : ask((host) => host.setNoiseProfile(values), false),
    transport: {
      loadFor: async (purpose, mediaPath, startSeconds) => {
        const deck = await ask(
          (host) =>
            host.loadDeckFor(
              purpose,
              mediaPath,
              isFiniteNumber(startSeconds) && startSeconds > 0
                ? startSeconds
                : 0,
            ),
          undefined,
        );
        // Held to the two decks there are, whatever the host said.
        return deck !== undefined && isDeck(deck) ? deck : undefined;
      },
      unload: (deck) => {
        // An unload while playing is a stop by another name.
        noteDspHostPlaying(false);
        return isDeck(deck)
          ? ask((host) => host.unloadDeck(deck), false)
          : Promise.resolve(false);
      },
      play: async () => {
        const applied = await ask((host) => host.setPlaying(true), false);
        noteDspHostPlaying(applied);
        return applied;
      },
      pause: () => {
        noteDspHostPlaying(false);
        return ask((host) => host.setPlaying(false), false);
      },
      seek: (deck, seconds) =>
        isDeck(deck) && isFiniteNumber(seconds)
          ? ask((host) => host.seekDeck(deck, seconds), false)
          : Promise.resolve(false),
      select: (deck) =>
        isDeck(deck)
          ? ask((host) => host.selectDeck(deck), false)
          : Promise.resolve(false),
      crossfade: (toDeck, durationMs, curveIndex) =>
        isDeck(toDeck) &&
        isFiniteNumber(durationMs) &&
        Number.isInteger(curveIndex)
          ? ask((host) => host.crossfade(toDeck, durationMs, curveIndex), false)
          : Promise.resolve(false),
      // The Custom crossfade curve, as 128 gains: outgoing then incoming.
      setCrossfadeTable: (values) =>
        values.length === CROSSFADE_TABLE_POINTS * 2 &&
        values.every(isFiniteNumber)
          ? ask((host) => host.setCrossfadeTable(values), false)
          : Promise.resolve(false),
    },
    onTelemetry: listenToDspHostTelemetry,
  };
};

export default libraryHostPort;
