/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack the Library's host runs, and the player's half of where it runs.
 *
 * The window hands over the rack and its half of the gate (`common/library/
 * playerRack.ts`); this adds whether the Library is heard from the host — or
 * about to be, while the transport is being prepared — and whether the
 * FluidEQ Engine took the song itself, and sends the host the line the gate
 * leaves it. The rack runs in exactly one place: the window keeps sending the
 * engine's copy from the same rule (`common/dsp/rackPlacement.ts`), told this
 * half through the player's view.
 */
import type {
  ILibraryRackGate,
  IPlayerRackCopy,
} from '../../common/library/playerRack';
import type { IDspSettings } from '../../common/dsp/chain';
import { playerChainLine } from './deckWants';
import type { ISourcePublication } from './sourcePublication';

export interface ILibraryRack {
  /** The window's newest copy. */
  setCopy: (copy: IPlayerRackCopy) => void;
  copy: () => IPlayerRackCopy | undefined;
  settings: () => IDspSettings | undefined;
  gate: () => ILibraryRackGate;
  /** Whether the player wants the host heard: the song is the host's, playing. */
  setWanted: (audible: boolean) => void;
  setHostOwns: (owns: boolean) => void;
  /** Before the transport starts from stopped; see `hostDeck.ts`. */
  prepare: () => Promise<void>;
  finish: (stopped?: Promise<unknown>) => Promise<void>;
  /** Told whenever the player's half of the gate moves. */
  onGate: (listener: () => void) => void;
}

export const createLibraryRack = (options: {
  sources: ISourcePublication;
  /** Sends the host a rack line; answers whether it took it. */
  pushLine: (line: readonly number[]) => Promise<boolean>;
}): ILibraryRack => {
  const { sources, pushLine } = options;
  let gateMoved: (() => void) | undefined;
  let copy: IPlayerRackCopy | undefined;
  let gate: ILibraryRackGate = {
    libraryAudible: false,
    librarySourceReady: false,
  };
  let wanted = false;
  let hostOwns = false;
  let preparing = false;

  const push = (): Promise<boolean> =>
    copy ? pushLine(playerChainLine(copy, gate)) : Promise.resolve(false);

  const update = (librarySourceReady = gate.librarySourceReady): void => {
    const libraryAudible = wanted && (hostOwns || preparing);
    if (
      libraryAudible === gate.libraryAudible &&
      librarySourceReady === gate.librarySourceReady
    ) {
      return;
    }
    const audibleMoved = libraryAudible !== gate.libraryAudible;
    gate = { libraryAudible, librarySourceReady };
    if (audibleMoved) {
      sources.setPlayback(libraryAudible, copy?.gate.sendingRawAudio === true);
    }
    push().catch(() => undefined);
    gateMoved?.();
  };

  return {
    setCopy: (next) => {
      const sendingMoved =
        copy?.gate.sendingRawAudio !== next.gate.sendingRawAudio;
      copy = next;
      if (sendingMoved) {
        sources.setPlayback(
          gate.libraryAudible,
          next.gate.sendingRawAudio === true,
        );
      }
      push().catch(() => undefined);
    },
    copy: () => copy,
    settings: () => copy?.settings,
    gate: () => gate,
    setWanted: (audible) => {
      wanted = audible;
      update();
    },
    setHostOwns: (owns) => {
      hostOwns = owns;
      update();
    },
    prepare: async () => {
      preparing = true;
      update();
      let native = false;
      try {
        native = await sources.prepareStart(
          copy?.gate.engine === 'fluid' &&
            copy.gate.eqLoaded &&
            !copy.gate.engineOff,
        );
      } finally {
        preparing = false;
        update(native);
      }
      // The host's copy as the gate now places it, acknowledged before Play.
      await push();
    },
    finish: async (stopped) => {
      if (await sources.release(stopped)) {
        update(false);
      }
    },
    onGate: (listener) => {
      gateMoved = listener;
    },
  };
};
