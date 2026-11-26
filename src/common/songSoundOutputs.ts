/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongSoundState } from './songSoundEvents';
import { TStep, close, lookupOpen, open } from './songSoundSteps';

/**
 * A switch of output, as a step of `reduceSongSound` (`songSoundRecorder.ts`):
 * the song carries on there with nothing lent, and a song's sound still lent
 * on the output left is parked with it (`ISongSoundParked`) — resumed when
 * the window comes back to that output while the same song plays, handed
 * back there otherwise. Apart from `songSoundSteps.ts` for the line ceiling.
 */
const deviceChanged = (state: ISongSoundState, deviceId: string): TStep => {
  if (deviceId === state.deviceId) {
    return [state, []];
  }
  if (state.deviceId === '') {
    // The window learning which output it starts on is not a switch: the song
    // playing at launch is the listener's like any other, and is looked up
    // now if it opened before the output was known.
    const known: ISongSoundState = { ...state, deviceId };
    return [known, lookupOpen(known)];
  }
  // Nothing handed back here: the new output brings its own Tone and EQ, and
  // the lent one never reached the old output's profile. Main keeps the old
  // output's state with its loan and puts both back when the window returns
  // there, so the loan is parked with it — left to nobody, it was never
  // handed back, the song's sound played on into every later song, and no
  // change reached the listener's own EQ again.
  const [closed, effects] = close(state, { nextSong: false, handBack: false });
  const { session, owed } = state;
  const held = session?.handBack ?? owed?.sound;
  const { [deviceId]: back, ...others } = {
    ...state.parked,
    ...(held
      ? {
          [state.deviceId]: {
            handBack: held,
            ...(session?.handBack ? { session } : {}),
          },
        }
      : {}),
  };
  const moved: ISongSoundState = {
    ...closed,
    deviceId,
    pending: undefined,
    owed: undefined,
    parked: others,
  };
  const { playing } = moved;
  if (back) {
    const resumed = back.session;
    if (
      resumed &&
      playing?.isPlaying &&
      playing.identity.key === resumed.identity.key
    ) {
      // The same song still plays there: its sound and its loan go on.
      return [
        {
          ...moved,
          session: { ...resumed, phase: 'playing', suspendedSince: undefined },
        },
        [...effects, { kind: 'release' }],
      ];
    }
    // Its song is over: the listener's own goes back on there.
    return [
      {
        ...moved,
        session: playing?.isPlaying
          ? { ...open(moved, playing.identity), isLoaded: true }
          : undefined,
      },
      [...effects, { kind: 'release' }, { kind: 'return' }],
    ];
  }
  return [
    {
      ...moved,
      // The song carries on there, reached by the switch: nothing it ends
      // with is the listener's choice, and nothing is lent to it this play.
      session: playing?.isPlaying
        ? { ...open(moved, playing.identity), isLoaded: true }
        : undefined,
    },
    [...effects, { kind: 'release' }],
  ];
};

export default deviceChanged;
